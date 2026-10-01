// renderer 요청 처리. 채널 이름은 '<namespace>:<method>', preload와 1:1
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, shell } from 'electron'
import { findAffected } from '../../src/core/affected.ts'
import { buildDocx } from '../../src/core/build.ts'
import { adoptShots, capture } from '../../src/core/capture.ts'
import { login } from '../../src/core/login.ts'
import type { ManualRef, SectionMeta } from '../../src/core/manual.ts'
import type {
  AuthStatus,
  EnvCheck,
  FileChange,
  GithubUser,
  ImportImageInput,
  NewSectionInput,
  Settings,
  ShotInfo,
  WorkspaceState,
} from '../shared/api.ts'
import { findChrome, findPandoc, formatAge } from './lib/environment.ts'
import * as gitOps from './lib/git.ts'
import { checkRepoAccess, commitAuthor, createPullRequest, getUser, latestAppRelease } from './lib/github.ts'
import { renderSection } from './lib/preview.ts'
import {
  collectTodos,
  createSection,
  importImage,
  listImages,
  listManuals,
  readSectionDoc,
  readTree,
  removeSection,
  resolveInside,
  suggestImageId,
  writeSectionDoc,
} from './lib/sections.ts'
import { loadShotsBundled, shotSections } from './lib/shots.ts'
import { authFile, clearToken, getSettings, readToken, saveToken, updateSettings } from './settings.ts'

// 사내망은 TLS를 가로채는 프록시가 있어 Node fetch가 실패한다. Chromium 네트워크 스택(시스템 인증서)을 쓴다
const netFetch = (url: string, init?: RequestInit) => net.fetch(url, init)
const http = gitOps.makeHttp(netFetch)

const ref = (): ManualRef => ({ root: getSettings().workspaceDir, manual: getSettings().manual })

function requireToken() {
  const token = readToken()
  if (!token) throw new Error('GitHub 토큰이 없습니다. 설정에서 입력하세요')
  return token
}

let user: GithubUser | undefined
async function currentUser() {
  user ??= await getUser(netFetch, requireToken())
  return user
}

function requirePandoc() {
  const found = findPandoc(getSettings().pandocPath || undefined)
  if (!found) throw new Error('pandoc을 찾지 못했습니다. 환경 점검에서 설치 안내를 확인하세요')
  return found.path
}

function requireWorkspace() {
  const { workspaceDir } = getSettings()
  if (!gitOps.isRepo(workspaceDir)) throw new Error('매뉴얼 리포를 아직 내려받지 않았습니다')
  return workspaceDir
}

async function gitContext(onProgress?: gitOps.GitContext['onProgress']): Promise<gitOps.GitContext> {
  const settings = getSettings()
  return {
    dir: settings.workspaceDir,
    http,
    url: settings.repoUrl,
    branch: settings.branch,
    token: requireToken(),
    author: commitAuthor(await currentUser()),
    onProgress,
  }
}

function workspaceState(): WorkspaceState {
  const { workspaceDir } = getSettings()
  return { dir: workspaceDir, cloned: gitOps.isRepo(workspaceDir) && existsSync(join(workspaceDir, 'manuals')) }
}

async function fileChanges(): Promise<FileChange[]> {
  const r = ref()
  const prefix = `manuals/${r.manual}/`
  const titles = new Map<string, string>()
  try {
    for (const chapter of readTree(r).chapters) {
      for (const section of chapter.sections) titles.set(`${prefix}${section.path}`, section.title)
    }
  } catch {
    // manual.yaml이 깨졌으면 경로만 보여 준다
  }
  return (await gitOps.changes(r.root)).map(({ path, status }): FileChange => {
    if (titles.has(path)) return { path, status, label: titles.get(path)!, kind: 'section' }
    const image = path.match(new RegExp(`^${prefix}images/(.+)\\.png$`))
    if (image) return { path, status, label: image[1], kind: 'image' }
    if (path === `${prefix}manual.yaml`) return { path, status, label: '목차 (manual.yaml)', kind: 'manual' }
    if (path.startsWith(prefix) && path.endsWith('.md')) return { path, status, label: path.slice(prefix.length), kind: 'section' }
    return { path, status, label: path, kind: 'other' }
  })
}

let pendingLogin: { resolve: () => void; reject: (error: Error) => void } | undefined

function handle<T extends unknown[], R>(channel: string, fn: (...args: T) => R | Promise<R>) {
  ipcMain.handle(channel, (_event, ...args) => fn(...(args as T)))
}

export function registerIpc(getWindow: () => BrowserWindow | undefined) {
  const send = (channel: string, payload: unknown) => getWindow()?.webContents.send(channel, payload)

  // settings
  handle('settings:get', () => getSettings())
  handle('settings:update', (patch: Partial<Settings>) => updateSettings(patch))
  handle('settings:pickDirectory', async (title: string) => {
    const window = getWindow()
    const options = { title, properties: ['openDirectory', 'createDirectory'] as const }
    const result = window
      ? await dialog.showOpenDialog(window, { ...options, properties: [...options.properties] })
      : await dialog.showOpenDialog({ ...options, properties: [...options.properties] })
    return result.canceled ? null : result.filePaths[0]
  })

  // auth
  handle('auth:status', async (): Promise<AuthStatus> => {
    const token = readToken()
    if (!token) return { hasToken: false }
    try {
      user = await getUser(netFetch, token)
      return { hasToken: true, user }
    } catch (error) {
      return { hasToken: true, error: (error as Error).message }
    }
  })
  handle('auth:setToken', async (token: string): Promise<AuthStatus> => {
    const trimmed = token.trim()
    if (!trimmed) throw new Error('토큰을 입력하세요')
    const found = await getUser(netFetch, trimmed)
    await checkRepoAccess(netFetch, trimmed, getSettings().repoUrl)
    saveToken(trimmed)
    user = found
    return { hasToken: true, user: found }
  })
  handle('auth:clearToken', () => {
    clearToken()
    user = undefined
  })

  // env
  handle('env:check', async (): Promise<EnvCheck[]> => {
    const settings = getSettings()
    const checks: EnvCheck[] = []
    const token = readToken()
    let tokenDetail = '설정에서 GitHub 토큰을 입력하세요'
    let tokenOk = false
    if (token) {
      try {
        const u = await getUser(netFetch, token)
        tokenOk = true
        tokenDetail = `${u.name ?? u.login} (@${u.login})`
      } catch (error) {
        tokenDetail = (error as Error).message
      }
    }
    checks.push({ id: 'token', ok: tokenOk, required: true, label: 'GitHub 토큰', detail: tokenDetail })
    const ws = workspaceState()
    checks.push({
      id: 'workspace',
      ok: ws.cloned,
      required: true,
      label: '매뉴얼 리포',
      detail: ws.cloned ? ws.dir : '아직 내려받지 않았습니다',
    })
    const pandoc = findPandoc(settings.pandocPath || undefined)
    checks.push({
      id: 'pandoc',
      ok: Boolean(pandoc),
      required: true,
      label: 'pandoc (미리보기, Word 만들기)',
      detail: pandoc ? `${pandoc.version} · ${pandoc.path}` : '설치되어 있지 않습니다',
      link: pandoc ? undefined : { label: '설치 파일 받기 (arm64 .pkg)', url: 'https://github.com/jgm/pandoc/releases/latest' },
    })
    const chrome = findChrome()
    checks.push({
      id: 'chrome',
      ok: Boolean(chrome),
      required: false,
      label: 'Google Chrome (화면 캡처)',
      detail: chrome ?? '설치되어 있지 않습니다. 캡처를 쓰지 않으면 없어도 됩니다',
      link: chrome ? undefined : { label: 'Chrome 받기', url: 'https://www.google.com/chrome/' },
    })
    const session = authFile(settings.manual)
    checks.push({
      id: 'session',
      ok: existsSync(session),
      required: false,
      label: 'BO 로그인 세션 (화면 캡처)',
      detail: existsSync(session)
        ? `${formatAge(Date.now() - statSync(session).mtimeMs)} 로그인. 만료되면 캡처 화면에서 다시 로그인하세요`
        : '캡처할 때 로그인합니다',
    })
    return checks
  })

  // workspace
  handle('workspace:state', () => workspaceState())
  handle('workspace:clone', async () => {
    const { workspaceDir } = getSettings()
    if (gitOps.isRepo(workspaceDir)) return workspaceState()
    if (existsSync(workspaceDir) && readdirSync(workspaceDir).length) {
      throw new Error(`${workspaceDir} 폴더가 비어 있지 않습니다. 다른 폴더를 고르세요`)
    }
    await gitOps.clone(await gitContext((p) => send('clone-progress', p)))
    return workspaceState()
  })
  handle('workspace:sync', async () => {
    requireWorkspace()
    return gitOps.sync(await gitContext())
  })
  handle('workspace:changes', () => {
    requireWorkspace()
    return fileChanges()
  })
  handle('workspace:revert', (paths: string[]) => gitOps.revert(requireWorkspace(), paths))
  handle('workspace:submit', async (message: string) => {
    requireWorkspace()
    const settings = getSettings()
    const token = requireToken()
    const me = await currentUser()
    return gitOps.submit(await gitContext(), {
      message: message.trim() || 'docs: 매뉴얼 수정',
      mode: settings.submitMode,
      login: me.login,
      createPullRequest: (input) => createPullRequest(netFetch, token, settings.repoUrl, input),
    })
  })
  handle('workspace:reveal', (relPath?: string) => {
    const root = requireWorkspace()
    if (relPath) shell.showItemInFolder(resolveInside(root, relPath))
    else void shell.openPath(root)
  })

  // manual
  handle('manual:list', () => listManuals(requireWorkspace()))
  handle('manual:tree', async () => {
    requireWorkspace()
    const modified = new Set((await gitOps.changes(ref().root)).map((c) => c.path))
    return readTree(ref(), modified)
  })
  handle('manual:read', (path: string) => readSectionDoc(ref(), path))
  handle('manual:write', (path: string, body: string, meta?: SectionMeta) => writeSectionDoc(ref(), path, body, meta))
  handle('manual:create', (input: NewSectionInput) => createSection(ref(), input))
  handle('manual:remove', (path: string) => removeSection(ref(), path))
  handle('manual:todos', () => collectTodos(ref()))
  handle('manual:images', () => listImages(ref()))
  handle('manual:suggestImageId', (caption: string) => suggestImageId(ref(), caption))
  handle('manual:pickImageFile', async () => {
    const window = getWindow()
    const options = {
      title: '이미지 선택',
      properties: ['openFile' as const],
      filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'heic'] }],
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })
  handle('manual:importImage', ({ id, sourcePath, data }: ImportImageInput) => {
    // PNG가 아니면 macOS 이미지 디코더로 PNG로 바꾼다 (스크린샷 붙여넣기는 대부분 PNG)
    const raw = data ? Buffer.from(data) : sourcePath ? readFileSync(sourcePath) : undefined
    if (!raw) throw new Error('이미지가 없습니다')
    const isPng = raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47
    if (isPng) return importImage(ref(), id, { data: raw })
    const image = nativeImage.createFromBuffer(raw)
    if (image.isEmpty()) throw new Error('이미지를 읽지 못했습니다')
    return importImage(ref(), id, { data: image.toPNG() })
  })

  // preview
  handle('preview:render', (_path: string, body: string) => {
    const versions = new Map(listImages(ref()).map((i) => [i.id, Math.round(i.mtime)]))
    return renderSection(requirePandoc(), ref().manual, body, versions)
  })

  // build
  handle('build:docx', (chapters?: number[]) => {
    const { docx, warnings } = buildDocx({ ...ref(), chapters, pandoc: requirePandoc() })
    return { docx, warnings }
  })
  handle('build:open', async (path: string) => {
    const root = requireWorkspace()
    const error = await shell.openPath(resolveInside(root, relative(root, path)))
    if (error) throw new Error(error)
  })

  // capture
  handle('capture:shots', async (): Promise<ShotInfo[]> => {
    const r = ref()
    const shots = await loadShotsBundled(r)
    const sections = shotSections(r)
    const images = new Set(listImages(r).map((i) => i.id))
    return shots.map((s) => ({
      id: s.id,
      path: s.path,
      manual: Boolean(s.manual),
      exists: images.has(s.id),
      sections: sections.get(s.id) ?? [],
    }))
  })
  handle('capture:session', () => {
    const file = authFile(getSettings().manual)
    return existsSync(file) ? { exists: true, savedAt: statSync(file).mtimeMs } : { exists: false }
  })
  handle('capture:login', async () => {
    if (!findChrome()) throw new Error('Google Chrome이 필요합니다')
    pendingLogin?.reject(new Error('새 로그인으로 대체되었습니다'))
    const settings = getSettings()
    await login({
      baseUrl: settings.boBaseUrl,
      authFile: authFile(settings.manual),
      waitUntilDone: () =>
        new Promise<void>((resolve, reject) => {
          pendingLogin = { resolve, reject }
        }),
    }).finally(() => {
      pendingLogin = undefined
    })
  })
  handle('capture:finishLogin', () => pendingLogin?.resolve())
  handle('capture:cancelLogin', () => pendingLogin?.reject(new Error('로그인을 취소했습니다')))
  handle('capture:run', async (ids: string[]) => {
    const settings = getSettings()
    const r = ref()
    return capture({
      ...r,
      baseUrl: settings.boBaseUrl,
      authFile: authFile(settings.manual),
      shots: await loadShotsBundled(r),
      only: ids,
      apply: false,
      onProgress: (progress) => send('capture-progress', progress),
    })
  })
  handle('capture:adopt', (ids: string[]) => adoptShots(ref(), ids))

  // affected (개발자용)
  handle('affected:run', (base: string, head: string) => {
    const { dealerhubWebDir } = getSettings()
    if (!dealerhubWebDir) throw new Error('설정에서 dealerhub-web 경로를 지정하세요')
    return findAffected({ ...ref(), repo: dealerhubWebDir, base, head: head || 'HEAD' })
  })

  // app
  handle('app:version', () => app.getVersion())
  handle('app:checkUpdate', async () => {
    const token = readToken()
    if (!token) return null
    return latestAppRelease(netFetch, token, getSettings().repoUrl, app.getVersion()).catch(() => null)
  })
  handle('app:openExternal', (url: string) => {
    if (!/^https:\/\//.test(url)) throw new Error('https 링크만 열 수 있습니다')
    return shell.openExternal(url)
  })
}
