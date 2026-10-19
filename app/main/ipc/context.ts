// IPC 핸들러가 같이 쓰는 것: 핸들러 등록, 창으로 이벤트 보내기, 지금 매뉴얼, 토큰·사용자, 도구 위치, 전제 조건 확인
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, net, type OpenDialogOptions } from 'electron'
import { loadManual, type ManualRef } from '../../../src/core/manual.ts'
import { sessionInfo } from '../../../src/core/session.ts'
import type { AriadneEvent, AriadneEvents, Channel, ChannelHandler, GithubUser, WorkspaceState } from '../../shared/api.ts'
import { findChrome, findFfmpeg, findPandoc, PANDOC_CANDIDATES } from '../lib/environment.ts'
import * as gitOps from '../lib/git.ts'
import { commitAuthor, getUser } from '../lib/github.ts'
import { installedPandocPath } from '../lib/pandoc-install.ts'
import { listManuals } from '../lib/sections.ts'
import { modelStatus } from '../lib/video-model.ts'
import { log } from '../log.ts'
import { notifyTask } from '../notifier.ts'
import { getSettings, profileDir, readToken, updateSettings } from '../settings.ts'

// 사내망은 TLS를 가로채는 프록시가 있어 Node fetch가 실패한다. Chromium 네트워크 스택(시스템 인증서)을 쓴다
export const netFetch = (url: string, init?: RequestInit) => net.fetch(url, init)
export const http = gitOps.makeHttp(netFetch)

// registerIpc가 정한다. 이벤트를 보내고, 작업이 끝났을 때 알림을 누르면 이 창을 앞으로
let windowRef: () => BrowserWindow | undefined = () => undefined
export const setWindow = (getWindow: () => BrowserWindow | undefined) => {
  windowRef = getWindow
}
export const currentWindow = () => windowRef()

// 파일·폴더 고르기. 고르지 않으면 null
export async function pickPath(options: OpenDialogOptions) {
  const window = windowRef()
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0]
}

export function send<E extends AriadneEvent>(event: E, payload: AriadneEvents[E]) {
  windowRef()?.webContents.send(event, payload)
}

export function handle<C extends Channel>(channel: C, fn: ChannelHandler<C>) {
  const call = fn as (...args: unknown[]) => unknown
  ipcMain.handle(channel, async (_event, ...args) => {
    const started = Date.now()
    try {
      const result = await call(...args)
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

// 지금 매뉴얼. 고른 매뉴얼이 없어졌으면(되돌리기 등) 남은 매뉴얼로 바꾼다
export const ref = (): ManualRef => {
  const { workspaceDir, manual } = getSettings()
  if (!existsSync(join(workspaceDir, 'manuals', manual, 'manual.yaml'))) {
    const fallback = listManuals(workspaceDir)
    const next = fallback.includes('bo') ? 'bo' : fallback[0]
    if (next && next !== manual) return { root: workspaceDir, manual: updateSettings({ manual: next }).manual }
  }
  return { root: workspaceDir, manual }
}

// 지금 매뉴얼의 STG 로그인 프로필
export const sessionDir = (r: ManualRef = ref()) => profileDir(r.manual)

// E2E가 가짜 BO를 쓸 때만 덮어쓴다. 평소에는 manual.yaml capture.baseUrl
export function captureBaseUrl(r: ManualRef = ref()) {
  const url = process.env.ARIADNE_CAPTURE_BASE_URL || loadManual(r).capture?.baseUrl
  if (!url) throw new Error('캡처 대상 주소가 없습니다. 설정 → 매뉴얼에서 지정하세요')
  return url
}

export function requireToken() {
  const token = readToken()
  if (!token) throw new Error('GitHub 토큰이 없습니다. 설정에서 입력하세요')
  return token
}

// GitHub 사용자. 토큰을 확인할 때마다 갱신하고, 지우면 잊는다
let user: GithubUser | undefined
export const rememberUser = (next: GithubUser | undefined) => {
  user = next
}
export async function currentUser() {
  user ??= await getUser(netFetch, requireToken())
  return user
}

// 기록(커밋만)의 작성자. 오프라인이라 GitHub 사용자를 못 읽으면 임시 이름 (제출할 때 다시 쓰는 커밋은 실제 작성자)
export async function recordAuthor() {
  return currentUser().then(commitAuthor, () => ({ name: 'Ariadne', email: 'ariadne@localhost' }))
}

// 앱이 받아 두는 도구(pandoc, Claude Code). 작업 폴더와 상관없이 userData에 둔다
export const toolsDir = () => join(app.getPath('userData'), 'tools')
// 앱 전용 Claude 설정 폴더 (--bare 실행의 CLAUDE_CONFIG_DIR, 대화 기록)
export const claudeDataDir = () => join(app.getPath('userData'), 'claude')
// 내레이션 음성 모델. 작업 폴더가 바뀌어도 다시 받지 않게 userData에 둔다
export const videoModelDir = () => process.env.ARIADNE_VIDEO_MODEL_DIR || join(app.getPath('userData'), 'models')
// pandoc: 설정 경로 → 앱이 설치한 것 → Homebrew 등
export const pandoc = () => findPandoc(getSettings().pandocPath || undefined, [installedPandocPath(toolsDir()), ...PANDOC_CANDIDATES])

export function requirePandoc() {
  const found = pandoc()
  if (!found) throw new Error('pandoc을 찾지 못했습니다. 환경 점검에서 설치 안내를 확인하세요')
  return found.path
}

export function requireFfmpeg() {
  const found = findFfmpeg()
  if (!found) throw new Error('ffmpeg를 찾지 못했습니다. 환경 점검을 확인하세요')
  return found.path
}

export function requireChrome() {
  if (!findChrome()) throw new Error('Google Chrome이 필요합니다')
}

// STG 로그인 프로필을 돌려준다. 로그인한 적이 없으면 거절
export function requireStgSession(r: ManualRef = ref()) {
  const session = sessionDir(r)
  if (!sessionInfo(session).exists) throw new Error('STG 로그인이 필요합니다')
  return session
}

export function requireVoiceModel() {
  if (!modelStatus(videoModelDir()).ready) throw new Error('음성 모델이 없습니다. 먼저 음성 모델을 받으세요')
}

export function requireWorkspace() {
  const { workspaceDir } = getSettings()
  if (!gitOps.isRepo(workspaceDir)) throw new Error('매뉴얼 리포를 아직 내려받지 않았습니다')
  return workspaceDir
}

export function workspaceState(): WorkspaceState {
  const { workspaceDir } = getSettings()
  return { dir: workspaceDir, cloned: gitOps.isRepo(workspaceDir) && existsSync(join(workspaceDir, 'manuals')) }
}

export async function gitContext(onProgress?: gitOps.GitContext['onProgress']): Promise<gitOps.GitContext> {
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
