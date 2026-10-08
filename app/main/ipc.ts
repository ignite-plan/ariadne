// renderer 요청 처리. 채널 이름은 '<namespace>:<method>', preload와 1:1
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, shell } from 'electron'
import { findAffected } from '../../src/core/affected.ts'
import { buildDocx } from '../../src/core/build.ts'
import { adoptShots, capture } from '../../src/core/capture.ts'
import { login } from '../../src/core/login.ts'
import { loadManual, mergeManual, saveManual, type ManualRef, type SectionMeta } from '../../src/core/manual.ts'
import { deleteVideo, loadVideo, saveVideo, type VideoScenario } from '../../src/core/video/scenario.ts'
import { checkSession, sessionInfo } from '../../src/core/session.ts'
import type {
  UpdateState,
  AuthStatus,
  EnvCheck,
  FileChange,
  DraftInput,
  GithubUser,
  ImportImageInput,
  ImportInput,
  ManualConfig,
  ManualInfo,
  NewSectionInput,
  Settings,
  ShotInfo,
  VideoRunOptions,
  VideoRunResult,
  WorkspaceState,
} from '../shared/api.ts'
import { findChrome, findFfmpeg, findPandoc, formatAge, PANDOC_CANDIDATES } from './lib/environment.ts'
import { installedPandocPath, installPandoc } from './lib/pandoc-install.ts'
import { CLAUDE_CODE_VERSION, installClaude, installedClaudePath, type ToolProgress } from './lib/claude-install.ts'
import { downloadModel, modelStatus } from './lib/video-model.ts'
import { isRecording, startRecording, stopRecording } from './lib/video-record.ts'
import { createVideo, videoInfos } from './lib/videos.ts'
import { cancelVideo, runVideo, speak } from './video.ts'
import * as gitOps from './lib/git.ts'
import { cancelDraft, checkDraft, decideDraft, startDraft } from './draft.ts'
import { analyzeInWorker, importInWorker } from './importer.ts'
import { findClaude, setManagedClaude } from './lib/claude.ts'
import { checkRepoAccess, commitAuthor, createPullRequest, getUser, latestAppRelease } from './lib/github.ts'
import { renderSection } from './lib/preview.ts'
import {
  collectTodos,
  createSection,
  importImage,
  listImages,
  listManuals,
  moveChapter,
  moveSection,
  readSectionDoc,
  readTree,
  removeSection,
  resolveInside,
  suggestImageId,
  writeSectionDoc,
} from './lib/sections.ts'
import { loadShotsBundled, shotSections } from './lib/shots.ts'
import { acquireShared, onLockChange, profileHolders, withShared } from './lib/profile-lock.ts'
import { acquireExclusiveProfile, hostTab, leaseEndpoint, withExclusive } from './lib/browser-host.ts'
import { notifyTask, testNotification } from './notifier.ts'
import { log, logsDir } from './report-ipc.ts'
import { appBundlePath, downloadAsset, stageFromDmg, writeInstallScript, type ResolveRedirect } from './lib/app-update.ts'
import { clearToken, getSettings, profileDir, readToken, saveToken, updateSettings } from './settings.ts'

// 사내망은 TLS를 가로채는 프록시가 있어 Node fetch가 실패한다. Chromium 네트워크 스택(시스템 인증서)을 쓴다
const netFetch = (url: string, init?: RequestInit) => net.fetch(url, init)
const http = gitOps.makeHttp(netFetch)

// 고른 매뉴얼이 없어졌으면(되돌리기 등) 남은 매뉴얼로 바꾼다
const ref = (): ManualRef => {
  const { workspaceDir, manual } = getSettings()
  if (!existsSync(join(workspaceDir, 'manuals', manual, 'manual.yaml'))) {
    const fallback = listManuals(workspaceDir)
    const next = fallback.includes('bo') ? 'bo' : fallback[0]
    if (next && next !== manual) return { root: workspaceDir, manual: updateSettings({ manual: next }).manual }
  }
  return { root: workspaceDir, manual }
}

// E2E가 가짜 BO를 쓸 때만 덮어쓴다. 평소에는 manual.yaml capture.baseUrl
function captureBaseUrl() {
  const url = process.env.ARIADNE_CAPTURE_BASE_URL || loadManual(ref()).capture?.baseUrl
  if (!url) throw new Error('캡처 대상 주소가 없습니다. 설정 → 매뉴얼에서 지정하세요')
  return url
}

function manualInfos(root: string): ManualInfo[] {
  return listManuals(root).map((id) => {
    const m = loadManual({ root, manual: id })
    return { id, title: m.title, version: m.version }
  })
}

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
  const found = pandoc()
  if (!found) throw new Error('pandoc을 찾지 못했습니다. 환경 점검에서 설치 안내를 확인하세요')
  return found.path
}

// 내레이션 음성 모델. 작업 폴더가 바뀌어도 다시 받지 않게 userData에 둔다
// net.fetch는 redirect: 'manual'을 지원하지 않는다("Redirect was cancelled"). net.request로 넘겨받을 주소만 읽는다
const netRedirect: ResolveRedirect = (url, headers) =>
  new Promise((resolve, reject) => {
    const request = net.request({ url, headers, redirect: 'manual' })
    request.on('redirect', (_status, _method, location) => {
      resolve(location)
      request.abort()
    })
    // 넘겨 주지 않으면 본문은 받지 않고 끊는다 (downloadAsset이 토큰과 함께 다시 받는다)
    request.on('response', () => {
      resolve(undefined)
      request.abort()
    })
    request.on('error', reject)
    request.end()
  })

// 앱 안 업데이트: 받은 dmg와 꺼낸 새 앱을 두는 곳
const updatesDir = () => join(app.getPath('userData'), 'updates')
let updateState: UpdateState = { phase: 'idle' }

// 앱이 받아 두는 도구(pandoc). 작업 폴더와 상관없이 userData에 둔다
const toolsDir = () => join(app.getPath('userData'), 'tools')
// 앱 전용 Claude 설정 폴더 (--bare 실행의 CLAUDE_CONFIG_DIR, 대화 기록)
const claudeDataDir = () => join(app.getPath('userData'), 'claude')
// pandoc: 설정 경로 → 앱이 설치한 것 → Homebrew 등
const pandoc = () => findPandoc(getSettings().pandocPath || undefined, [installedPandocPath(toolsDir()), ...PANDOC_CANDIDATES])

const videoModelDir = () => process.env.ARIADNE_VIDEO_MODEL_DIR || join(app.getPath('userData'), 'models')

function requireFfmpeg() {
  const found = findFfmpeg()
  if (!found) throw new Error('ffmpeg를 찾지 못했습니다. 환경 점검을 확인하세요')
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

// registerIpc가 정한다. 작업이 끝났을 때 알림을 누르면 이 창을 앞으로
let windowRef: () => BrowserWindow | undefined = () => undefined

function handle<T extends unknown[], R>(channel: string, fn: (...args: T) => R | Promise<R>) {
  ipcMain.handle(channel, async (_event, ...args) => {
    const started = Date.now()
    try {
      const result = await fn(...(args as T))
      // 오래 걸리는 작업(Claude, 영상, 캡처, 가져오기 …)이 끝나면 알린다
      notifyTask(windowRef, channel, args, { result }, Date.now() - started)
      return result
    } catch (error) {
      // 화면에 오류로 보이는 실패는 모두 로그에 남긴다 (문제 신고에 첨부)
      log.error(`ipc:${channel}`, error)
      notifyTask(windowRef, channel, args, { error }, Date.now() - started)
      throw error
    }
  })
}

export function registerIpc(getWindow: () => BrowserWindow | undefined) {
  // 앱 전용 Claude Code가 설치돼 있으면 내 PC의 claude보다 먼저 쓴다
  const managedClaude = installedClaudePath(toolsDir())
  setManagedClaude(existsSync(managedClaude) ? managedClaude : undefined)
  windowRef = getWindow
  const send = (channel: string, payload: unknown) => getWindow()?.webContents.send(channel, payload)
  const setUpdateState = (state: UpdateState) => {
    updateState = state
    send('update-state', state)
    return state
  }
  onLockChange(() => {
    try {
      send('stg-tasks', profileHolders(profileDir(ref().manual)))
    } catch {
      // 작업 폴더가 없으면 알릴 작업도 없다
    }
  })

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
  // 앱이 대신 설치하는 도구: pandoc, 앱 전용 Claude Code
  handle('env:install', async (tool: 'pandoc' | 'claude') => {
    const progress = (p: ToolProgress) => send('install-progress', { tool, ...p })
    if (tool === 'pandoc') return installPandoc(toolsDir(), netFetch, progress)
    const installed = await installClaude(toolsDir(), netFetch, progress)
    setManagedClaude(installed.path)
    return installed
  })
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
    const foundPandoc = pandoc()
    checks.push({
      id: 'pandoc',
      ok: Boolean(foundPandoc),
      required: true,
      label: 'pandoc (미리보기, Word 만들기)',
      detail: foundPandoc
        ? `${foundPandoc.version} · ${foundPandoc.path.startsWith(toolsDir()) ? '앱이 설치함' : foundPandoc.path}`
        : '설치되어 있지 않습니다. 앱이 받아 설치할 수 있습니다 (약 40MB)',
      install: foundPandoc ? undefined : 'pandoc',
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
    const claude = await findClaude(settings.claudePath || undefined, false, settings.claudeAuth)
    const managed = claude?.managed
    checks.push({
      id: 'claude',
      // E2E(가짜 claude)나 직접 지정한 경로는 앱 전용 설치를 권하지 않는다
      ok: Boolean(managed || (claude && (settings.claudePath || process.env.ARIADNE_CLAUDE_PATH))),
      required: false,
      label: `Claude Code ${CLAUDE_CODE_VERSION} (Claude로 초안·최신화·영상)`,
      detail: managed
        ? `${claude!.version} · 앱 전용`
        : claude
          ? `내 PC의 ${claude.version}을 쓰는 중입니다. 사람마다 같은 버전으로 돌리려면 앱 전용으로 설치하세요 (약 220MB)`
          : '없습니다. 앱 전용으로 설치할 수 있습니다 (약 220MB). Claude 기능을 쓰지 않으면 없어도 됩니다',
      install: managed || settings.claudePath || process.env.ARIADNE_CLAUDE_PATH ? undefined : 'claude',
    })
    const ffmpeg = findFfmpeg()
    checks.push({
      id: 'ffmpeg',
      ok: Boolean(ffmpeg),
      required: false,
      label: 'ffmpeg (가이드 영상)',
      detail: ffmpeg ? (ffmpeg.bundled ? '앱에 들어 있음' : ffmpeg.path) : '찾지 못했습니다. 가이드 영상을 쓰지 않으면 없어도 됩니다',
    })
    const model = modelStatus(videoModelDir())
    checks.push({
      id: 'voice',
      ok: model.ready,
      required: false,
      label: '음성 모델 (가이드 영상 내레이션)',
      detail: model.ready
        ? `Kokoro · ${Math.round(model.bytes / 1e6)}MB`
        : '가이드 영상 화면에서 처음 만들 때 받습니다 (약 90MB). 자막만 쓰면 없어도 됩니다',
    })
    const session = sessionInfo(profileDir(workspaceState().cloned ? ref().manual : settings.manual))
    checks.push({
      id: 'session',
      ok: session.exists,
      required: false,
      label: '로그인 세션 (화면 캡처·가이드 영상)',
      detail: session.exists
        ? `${formatAge(Date.now() - session.savedAt!)} 로그인. 만료되면 캡처·영상 화면에서 다시 로그인하세요`
        : '캡처하거나 영상을 만들 때 로그인합니다',
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
  handle('workspace:diff', async (path: string) => {
    const root = requireWorkspace()
    const file = resolveInside(root, path)
    return { before: await gitOps.headContent(root, path), after: existsSync(file) ? readFileSync(file, 'utf8') : null }
  })
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
  handle('manual:list', () => manualInfos(requireWorkspace()))
  handle('manual:config', (): ManualConfig => {
    const { chapters: _chapters, ...config } = loadManual(ref())
    return config
  })
  handle('manual:updateConfig', (patch: Partial<ManualConfig>): ManualConfig => {
    const r = ref()
    const next = mergeManual(loadManual(r), patch)
    saveManual(r, next)
    const { chapters: _chapters, ...config } = next
    return config
  })
  handle('manual:pickDocx', async () => {
    const window = getWindow()
    const options = {
      title: '매뉴얼 Word 파일',
      properties: ['openFile' as const],
      filters: [{ name: 'Word', extensions: ['docx'] }],
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })
  handle('manual:analyzeDocx', (path: string) => analyzeInWorker(path, requirePandoc()))
  handle('manual:importDocx', async (input: ImportInput) => {
    const root = requireWorkspace()
    if (existsSync(join(root, 'manuals', input.id))) throw new Error(`이미 있는 매뉴얼 id입니다: ${input.id}`)
    const result = await importInWorker(
      {
        root,
        manual: input.id,
        docx: input.docx,
        pandoc: requirePandoc(),
        title: input.title.trim(),
        version: input.version.trim(),
        output: input.output.trim() || undefined,
        capture: {
          ...(input.capture.baseUrl.trim() ? { baseUrl: input.capture.baseUrl.trim() } : {}),
          viewport: input.capture.viewport,
        },
        code: input.code,
        keepSource: input.keepSource,
      },
      (progress) => send('import-progress', progress),
    )
    updateSettings({ manual: result.manual })
    return result.manual
  })
  handle('manual:tree', async () => {
    requireWorkspace()
    const modified = new Set((await gitOps.changes(ref().root)).map((c) => c.path))
    return readTree(ref(), modified)
  })
  handle('manual:read', (path: string) => readSectionDoc(ref(), path))
  handle('manual:write', (path: string, body: string, meta?: SectionMeta) => writeSectionDoc(ref(), path, body, meta))
  handle('manual:create', (input: NewSectionInput) => createSection(ref(), input))
  handle('manual:remove', (path: string) => removeSection(ref(), path))
  handle('manual:moveChapter', (dir: string, toIndex: number) => [...moveChapter(ref(), dir, toIndex)])
  handle('manual:moveSection', (path: string, toIndex: number) => {
    const renamed = moveSection(ref(), path, toIndex)
    return renamed.get(path) ?? path
  })
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
  handle('capture:session', () => sessionInfo(profileDir(ref().manual)))
  // 공유 Chrome의 탭으로 확인한다 (Claude 작업·영상 만들기 중에도 된다)
  handle('capture:checkSession', () => {
    const session = profileDir(ref().manual)
    return withShared(session, '세션 확인', () => checkSession(session, captureBaseUrl(), hostTab(session)))
  })
  // 지금 STG 로그인 프로필을 쓰는 작업 이름 (화면이 보이는 Chrome이 필요한 버튼을 끌 때 쓴다)
  handle('capture:tasks', () => profileHolders(profileDir(ref().manual)))
  handle('capture:login', async () => {
    if (!findChrome()) throw new Error('Google Chrome이 필요합니다')
    pendingLogin?.reject(new Error('새 로그인으로 대체되었습니다'))
    const r = ref()
    await withExclusive(profileDir(r.manual), 'STG 로그인', () =>
      login({
        baseUrl: captureBaseUrl(),
        profileDir: profileDir(r.manual),
        waitUntilDone: () =>
          new Promise<void>((resolve, reject) => {
            pendingLogin = { resolve, reject }
          }),
      }),
    ).finally(() => {
      pendingLogin = undefined
    })
  })
  handle('capture:finishLogin', () => pendingLogin?.resolve())
  handle('capture:cancelLogin', () => pendingLogin?.reject(new Error('로그인을 취소했습니다')))
  handle('capture:run', async (ids: string[]) => {
    const r = ref()
    const shots = await loadShotsBundled(r)
    const session = profileDir(r.manual)
    return withShared(session, '화면 캡처', () =>
      capture({
        ...r,
        baseUrl: captureBaseUrl(),
        profileDir: session,
        openTab: hostTab(session),
        shots,
        only: ids,
        apply: false,
        onProgress: (progress) => send('capture-progress', progress),
      }),
    )
  })
  handle('capture:adopt', (ids: string[]) => adoptShots(ref(), ids))

  // 가이드 영상
  handle('video:list', () => videoInfos(ref()))
  handle('video:load', (id: string) => loadVideo(ref(), id))
  handle('video:save', (scenario: VideoScenario) => saveVideo(ref(), scenario))
  handle('video:create', (input: { title: string; section?: string }) => createVideo(ref(), input))
  handle('video:remove', (id: string) => deleteVideo(ref(), id))
  handle('video:run', async (id: string, options: VideoRunOptions = {}): Promise<VideoRunResult> => {
    if (isRecording()) throw new Error('STG 기록을 먼저 끝내세요')
    const r = ref()
    if (!findChrome()) throw new Error('Google Chrome이 필요합니다')
    const session = profileDir(r.manual)
    if (!sessionInfo(session).exists) throw new Error('STG 로그인이 필요합니다')
    const narrate = !options.preview && options.tts !== false
    if (narrate && !modelStatus(videoModelDir()).ready) throw new Error('음성 모델이 없습니다. 먼저 음성 모델을 받으세요')
    // 앱은 사내 TLS 프록시 때문에 worker에서 외부 API를 부를 수 없어 Kokoro(로컬)만 쓴다
    const tts = narrate ? { ...loadManual(r).video?.tts, provider: 'kokoro' as const } : false
    // 미리보기는 화면이 보이는 Chrome을 따로 띄운다(단독). 영상 만들기는 공유 Chrome에 탭을 열어 Claude 작업과 동시에 돈다
    let release: () => void
    let endpoint: { url: string; release: () => void } | undefined
    if (options.preview) release = await acquireExclusiveProfile(session, '미리보기')
    else {
      release = acquireShared(session, '영상 만들기')
      try {
        endpoint = await leaseEndpoint(session)
      } catch (error) {
        release()
        throw error
      }
    }
    const result = await runVideo(
      {
        ...r,
        id,
        baseUrl: captureBaseUrl(),
        profileDir: session,
        cdpEndpoint: endpoint?.url,
        tts,
        modelDir: videoModelDir(),
        localModel: true,
        ffmpegPath: options.preview ? undefined : requireFfmpeg(),
        preview: options.preview,
        fromScene: options.fromScene,
      },
      (progress) => send('video-progress', progress),
    ).finally(() => {
      endpoint?.release()
      release()
    })
    if (!result.ok) return result
    const rel = (path?: string) => (path ? relative(r.root, path) : undefined)
    return { ...result, mp4: rel(result.mp4), srt: rel(result.srt), vtt: rel(result.vtt) }
  })
  handle('video:cancel', () => cancelVideo())
  handle('video:speak', async (text: string, speed?: number) => {
    const r = ref()
    if (!text.trim()) throw new Error('문장을 입력하세요')
    if (!modelStatus(videoModelDir()).ready) throw new Error('음성 모델이 없습니다. 먼저 음성 모델을 받으세요')
    const base = loadManual(r).video?.tts
    const tts = { ...base, provider: 'kokoro' as const, speed: speed ?? base?.speed }
    const clip = await speak({ op: 'speak', root: r.root, text: text.trim(), tts, modelDir: videoModelDir() })
    return { path: relative(r.root, clip.file), ms: clip.ms }
  })
  handle('video:record', async (id: string, scene: number) => {
    const r = ref()
    if (!findChrome()) throw new Error('Google Chrome이 필요합니다')
    const session = profileDir(r.manual)
    if (!sessionInfo(session).exists) throw new Error('STG 로그인이 필요합니다')
    // 기록이 끝날 때('stop')까지 프로필을 잡는다
    const release = await acquireExclusiveProfile(session, 'STG 기록')
    await startRecording({
      ...r,
      id,
      scene,
      baseUrl: captureBaseUrl(),
      profileDir: session,
      onEvent: (event) => {
        if (event.kind === 'stop') release()
        send('video-record', event)
      },
    }).catch((error) => {
      release()
      throw error
    })
  })
  handle('video:stopRecord', () => stopRecording())
  handle('video:model', () => modelStatus(videoModelDir()))
  handle('video:downloadModel', () =>
    downloadModel(videoModelDir(), (url) => netFetch(url), (progress) => send('video-model-progress', progress)),
  )

  // Claude로 초안 만들기
  handle('draft:check', (options?: { refresh?: boolean; confluence?: boolean }) =>
    checkDraft(getSettings().claudePath, options, getSettings().claudeAuth),
  )
  handle('draft:start', (input: DraftInput) => {
    requireWorkspace()
    const r = ref()
    // Claude 작업 내내 공유 잠금을 잡는다 (언제 STG를 열지 몰라 로그인·미리보기·기록은 막는다). 영상 만들기·캡처는 함께 돈다
    const session = profileDir(r.manual)
    return withShared(session, 'Claude 작업', () =>
      startDraft({
        ref: r,
        input,
        claudePath: getSettings().claudePath,
        claudeAuth: getSettings().claudeAuth,
        model: getSettings().claudeModel,
        effort: getSettings().claudeEffort,
        codeDir: getSettings().dealerhubWebDir || undefined,
        captureBaseUrl: captureBaseUrl(),
        profileDir: session,
        openTab: hostTab(session),
        claudeDataDir: claudeDataDir(),
        onEvent: (event) => send('draft-event', event),
      }),
    )
  })
  handle('draft:cancel', () => cancelDraft())
  handle('draft:decide', (id: string, proceed: boolean) => decideDraft(id, proceed))

  // affected (개발자용)
  handle('affected:run', (base: string, head: string) => {
    const { dealerhubWebDir } = getSettings()
    if (!dealerhubWebDir) throw new Error('설정에서 dealerhub-web 경로를 지정하세요')
    return findAffected({ ...ref(), repo: dealerhubWebDir, base, head: head || 'HEAD' })
  })

  // app
  handle('app:version', () => app.getVersion())
  handle('app:testNotification', () => testNotification(getWindow))
  handle('app:checkUpdate', async () => {
    const token = readToken()
    if (!token) return null
    return latestAppRelease(netFetch, token, getSettings().repoUrl, app.getVersion()).catch(() => null)
  })
  handle('app:updateState', () => updateState)
  handle('app:downloadUpdate', async (): Promise<UpdateState> => {
    if (updateState.phase === 'download' || updateState.phase === 'prepare') return updateState
    if (!app.isPackaged) throw new Error('개발 실행에서는 앱 안 업데이트를 쓸 수 없습니다')
    const token = readToken()
    if (!token) throw new Error('GitHub 토큰이 없습니다')
    const info = await latestAppRelease(netFetch, token, getSettings().repoUrl, app.getVersion())
    if (!info) return setUpdateState({ phase: 'idle' })
    if (!info.asset) throw new Error('릴리스에 dmg가 없습니다. 릴리스 페이지에서 직접 받으세요')
    const dir = updatesDir()
    try {
      setUpdateState({ phase: 'download', total: info.asset.size })
      const dmg = await downloadAsset(
        netFetch,
        token,
        info.asset,
        join(dir, info.asset.name),
        (p) => setUpdateState({ phase: 'download', loaded: p.loaded, total: p.total }),
        netRedirect,
      )
      setUpdateState({ phase: 'prepare' })
      await stageFromDmg(dmg, join(dir, 'Ariadne.app'), info.latest)
      rmSync(dmg, { force: true })
      log.write('info', 'update', `새 버전 ${info.latest} 준비됨`)
      return setUpdateState({ phase: 'ready', version: info.latest })
    } catch (error) {
      log.error('update', error)
      return setUpdateState({ phase: 'error', message: (error as Error).message })
    }
  })
  handle('app:installUpdate', async () => {
    if (updateState.phase !== 'ready') throw new Error('먼저 새 버전을 받으세요')
    const target = appBundlePath(app.getPath('exe'))
    if (!target) throw new Error('앱 위치를 찾지 못했습니다. 릴리스 페이지에서 직접 받아 설치하세요')
    // Claude 작업·영상 만들기가 돌고 있으면 끊기지 않게 막는다
    const busy = workspaceState().cloned ? profileHolders(profileDir(ref().manual)) : []
    if (busy.length) throw new Error(`${busy.join(', ')} 중에는 업데이트할 수 없습니다. 끝난 뒤 다시 누르세요`)
    const dir = updatesDir()
    const script = writeInstallScript(dir)
    log.write('info', 'update', `${updateState.version}(으)로 바꾸고 다시 엽니다: ${target}`)
    spawn('/bin/sh', [script, String(process.pid), join(dir, 'Ariadne.app'), target, join(logsDir(), 'update.log')], {
      detached: true,
      stdio: 'ignore',
    }).unref()
    app.quit()
  })
  handle('app:openExternal', (url: string) => {
    if (!/^https:\/\//.test(url)) throw new Error('https 링크만 열 수 있습니다')
    return shell.openExternal(url)
  })
}
