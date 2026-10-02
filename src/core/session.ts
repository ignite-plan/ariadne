// STG 로그인 세션 = 매뉴얼마다 유지되는 Chrome 프로필 (Playwright MCP와 같은 방식).
// BO는 접속할 때마다 토큰을 갱신한다. storageState 파일로 새 컨텍스트를 여러 번 열면 예전 토큰으로 접속해 로그아웃되지만,
// 프로필은 갱신된 토큰을 스스로 저장한다. 프로필은 한 번에 브라우저 하나만 열 수 있다
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { DEFAULT_VIEWPORT, type ManualRef, type Viewport } from './manual.ts'

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

export function isSessionExpired(error: unknown) {
  return error instanceof Error && error.message.includes('세션 만료')
}

export interface OpenProfileOptions {
  headless?: boolean
  viewport?: Viewport
  // E2E가 이 브라우저를 조작할 수 있게 디버깅 포트를 연다 (평소에는 없음)
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

export interface SessionCheck extends StgSessionInfo {
  // 실제로 STG 화면이 열렸는지 (false면 로그인 페이지로 튕김)
  valid: boolean
  url?: string
}

// 화면 없이 STG를 열어 로그인 페이지로 튕기는지 본다. 살아 있으면 표식 시각을 갱신하고, 만료됐으면 표식을 지운다
export async function checkSession(profileDir: string, baseUrl: string): Promise<SessionCheck> {
  if (!sessionInfo(profileDir).exists) return { exists: false, valid: false }
  const { context, page } = await openProfile(profileDir)
  try {
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle').catch(() => {})
    const url = page.url()
    // 세션이 끝나면 다른 origin의 로그인·로그아웃 페이지(MPASS, stg-admin logout.html)로 넘어간다
    if (new URL(url).origin !== new URL(baseUrl).origin) {
      clearSession(profileDir)
      return { exists: false, valid: false, url }
    }
    markSession(profileDir, baseUrl)
    return { ...sessionInfo(profileDir), valid: true, url }
  } finally {
    await context.close().catch(() => {})
  }
}
