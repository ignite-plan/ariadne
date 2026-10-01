// BO는 MPASS MFA가 있어 자동 로그인이 안 된다. 직접 로그인한 세션을 저장한다.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium, type Page } from 'playwright'

export interface LoginOptions {
  baseUrl: string
  authFile: string
  // 사용자가 로그인을 마칠 때까지 기다린다. CLI는 Enter, 앱은 [완료] 버튼
  waitUntilDone: (page: Page) => Promise<void>
}

export async function login({ baseUrl, authFile, waitUntilDone }: LoginOptions) {
  const browser = await chromium.launch({ channel: 'chrome', headless: false })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.goto(baseUrl)
    await waitUntilDone(page)
    mkdirSync(dirname(authFile), { recursive: true })
    await context.storageState({ path: authFile })
  } finally {
    await browser.close()
  }
  return authFile
}
