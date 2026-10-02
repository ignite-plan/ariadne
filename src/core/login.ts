// BO는 MPASS MFA가 있어 자동 로그인이 안 된다. 유지되는 Chrome 프로필에 사람이 직접 로그인한다 (session.ts)
import type { Page } from 'playwright'
import { markSession, openProfile } from './session.ts'

export interface LoginOptions {
  baseUrl: string
  profileDir: string
  // 사용자가 로그인을 마칠 때까지 기다린다. CLI는 Enter, 앱은 [완료] 버튼
  waitUntilDone: (page: Page) => Promise<void>
}

export async function login({ baseUrl, profileDir, waitUntilDone }: LoginOptions) {
  const { context, page } = await openProfile(profileDir, { headless: false })
  try {
    await page.goto(baseUrl)
    await waitUntilDone(page)
    await page.waitForLoadState('networkidle').catch(() => {})
    // 로그인 페이지(다른 origin)에 머물러 있으면 아직 로그인하지 않은 것이다
    if (new URL(page.url()).origin !== new URL(baseUrl).origin) {
      throw new Error(`아직 로그인 페이지입니다 (${page.url()}). STG 화면이 보인 뒤 완료를 누르세요`)
    }
    markSession(profileDir, baseUrl)
  } finally {
    await context.close().catch(() => {})
  }
  return profileDir
}
