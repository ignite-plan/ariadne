// STG 로그인 세션 = 매뉴얼마다 유지되는 Chrome 프로필 (Playwright MCP와 같은 방식).
// BO는 접속할 때마다 토큰을 갱신한다. storageState 파일로 새 컨텍스트를 여러 번 열면 예전 토큰으로 접속해 로그아웃되지만,
// 프로필은 갱신된 토큰을 스스로 저장한다. 프로필은 한 번에 브라우저 하나만 열 수 있다
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { DEFAULT_VIEWPORT, type ManualRef, type Viewport } from './manual.ts'
import { isOnStg } from './stg-url.ts'

// 로그인을 마쳤다는 표식. 세션 만료가 감지되면 지운다
export const SESSION_MARK = 'ariadne-session.json'

export interface StgSessionInfo {
  exists: boolean
  savedAt?: number
}

export function defaultProfileDir({ root, manual }: ManualRef) {
  return resolve(root, '.auth', `${manual}-profile`)
}

export function sessionInfo(profileDir: string): StgSessionInfo {
  const mark = join(profileDir, SESSION_MARK)
  return existsSync(mark) ? { exists: true, savedAt: statSync(mark).mtimeMs } : { exists: false }
}

export function markSession(profileDir: string, baseUrl: string) {
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, SESSION_MARK), JSON.stringify({ baseUrl, savedAt: new Date().toISOString() }, null, 2))
}

export function clearSession(profileDir: string) {
  rmSync(join(profileDir, SESSION_MARK), { force: true })
}

export function requireSession(profileDir: string) {
  if (!sessionInfo(profileDir).exists) throw new Error(`STG 로그인 세션 없음 (${profileDir}). 로그인 먼저 실행`)
}

export interface OpenProfileOptions {
  headless?: boolean
  viewport?: Viewport
  // 디버깅 포트를 연다. 앱의 공유 Chrome('0': 빈 포트, DevToolsActivePort로 읽음)과 E2E만 쓴다
  debugPort?: string
}

// 프로필로 Chrome을 연다. 이미 다른 작업이 같은 프로필을 쓰고 있으면 알아보기 쉬운 오류로 바꾼다
export async function openProfile(
  profileDir: string,
  { headless = true, viewport = DEFAULT_VIEWPORT, debugPort }: OpenProfileOptions = {},
): Promise<{ context: BrowserContext; page: Page }> {
  mkdirSync(profileDir, { recursive: true })
  let context: BrowserContext
  try {
    // 사내망에서 Playwright 브라우저 다운로드가 막혀 있어 설치된 Chrome을 쓴다
    context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      headless,
      viewport,
      deviceScaleFactor: 1,
      locale: 'en-US',
      args: debugPort ? [`--remote-debugging-port=${debugPort}`] : [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/ProcessSingleton|SingletonLock|already in use|user data directory/i.test(message)) {
      throw new Error('다른 STG 작업이 로그인 프로필을 쓰고 있습니다. 그 작업이 끝난 뒤 다시 하세요', { cause: error })
    }
    throw error
  }
  const page = context.pages()[0] ?? (await context.newPage())
  return { context, page }
}

// STG 탭 하나. close()는 단독 Chrome이면 브라우저까지, 공유 Chrome이면 탭만 닫는다
export interface StgTab {
  page: Page
  close(): Promise<void>
}

// 탭 여는 방법. CLI는 프로필로 Chrome을 단독으로 띄우고(profileTab), 앱은 공유 Chrome에서 탭을 빌린다.
// 공유 Chrome에서는 다른 탭에 번지지 않게 route·init script를 page 단위로만 건다
export type OpenTab = (options: { viewport: Viewport; headless?: boolean }) => Promise<StgTab>

export function profileTab(profileDir: string): OpenTab {
  return async ({ viewport, headless = true }) => {
    const { context, page } = await openProfile(profileDir, { headless, viewport })
    return { page, close: () => context.close().catch(() => {}) }
  }
}

// 다른 프로세스(앱 영상 worker)가 공유 Chrome에 붙어 탭을 하나 연다. 닫을 때 연결만 끊고 Chrome은 둔다
export function cdpTab(endpoint: string): OpenTab {
  return async ({ viewport }) => {
    const browser = await chromium.connectOverCDP(endpoint)
    try {
      const context = browser.contexts()[0]
      if (!context) throw new Error('공유 Chrome에 연결했지만 로그인 프로필이 없습니다')
      const page = await context.newPage()
      await page.setViewportSize(viewport)
      return {
        page,
        close: async () => {
          await page.close().catch(() => {})
          await browser.close().catch(() => {})
        },
      }
    } catch (error) {
      await browser.close().catch(() => {})
      throw error
    }
  }
}

// debugPort '0'으로 띄운 Chrome이 실제로 연 포트. Chrome이 프로필 폴더에 적는다
export const DEVTOOLS_PORT_FILE = 'DevToolsActivePort'

export async function readDevToolsPort(profileDir: string, timeoutMs = 10_000) {
  const file = join(profileDir, DEVTOOLS_PORT_FILE)
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const port = existsSync(file) ? readFileSync(file, 'utf8').split('\n')[0]?.trim() : ''
    if (port && /^\d+$/.test(port)) return Number(port)
    await sleep(100)
  }
  throw new Error('공유 Chrome의 디버깅 포트를 찾지 못했습니다')
}

export interface SessionCheck extends StgSessionInfo {
  // 실제로 STG 화면이 열렸는지 (false면 로그인 페이지로 튕김)
  valid: boolean
  url?: string
}

// 화면 없이 STG를 열어 로그인 페이지로 튕기는지 본다. 살아 있으면 표식 시각을 갱신하고, 만료됐으면 표식을 지운다
export async function checkSession(profileDir: string, baseUrl: string, openTab: OpenTab = profileTab(profileDir)): Promise<SessionCheck> {
  if (!sessionInfo(profileDir).exists) return { exists: false, valid: false }
  const { page, close } = await openTab({ viewport: DEFAULT_VIEWPORT })
  try {
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle').catch(() => {})
    const url = page.url()
    if (!isOnStg(url, baseUrl)) {
      clearSession(profileDir)
      return { exists: false, valid: false, url }
    }
    markSession(profileDir, baseUrl)
    return { ...sessionInfo(profileDir), valid: true, url }
  } finally {
    await close()
  }
}
