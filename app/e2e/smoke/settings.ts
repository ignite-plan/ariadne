// 설정: 환경 점검, 고급, 변경 영향, 정보, 문제 신고
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Smoke } from './context.ts'

export async function settings({ page, step, snap, token, userData }: Smoke) {
  await step('설정: 환경 점검, 정보', async () => {
    await page.getByTitle('설정').click()
    const nav = (name: string) => page.locator('.settings-nav button', { hasText: name })
    await nav('환경 점검').click()
    await page.locator('.env-list li').first().waitFor()
    await nav('고급').click()
    const auth = page.locator('.field', { hasText: 'Claude 인증' }).locator('select')
    assert.equal(await auth.inputValue(), 'auto', '기본은 자동 (키가 있으면 API 키, 없으면 claude.ai 로그인)')
    await auth.selectOption('login')
    await page.getByText('claude.ai 로그인으로 실행합니다').waitFor()
    await auth.selectOption('apiKey')
    await page.getByText('로그인 셸(~/.zshrc)의 ANTHROPIC_API_KEY를 씁니다').waitFor()
    await auth.selectOption('auto')
    // 기본 모델은 Sonnet 1M
    assert.equal(await page.locator('.field', { hasText: 'Claude 모델' }).locator('input').inputValue(), 'claude-sonnet-5[1m]')
    await nav('변경 영향').click()
    await page.getByText('dealerhub-web 경로 지정하기').waitFor()
    await nav('정보').click()
    await page.getByText(/버전 \d/).waitFor()
    // 문제 신고: 보낼 내용 미리보기까지만 (실제 Issue는 만들지 않는다)
    await page.getByRole('button', { name: '문제 신고' }).click()
    await page.getByRole('heading', { name: '문제 신고' }).waitFor()
    await page.getByPlaceholder(/예: Dealer List View에서/).fill('E2E 신고 미리보기')
    await page.locator('.report-preview summary').click()
    await page.locator('.report-preview pre', { hasText: 'E2E 신고 미리보기' }).waitFor({ timeout: 15000 })
    const reportBody = await page.locator('.report-preview pre').innerText()
    assert.match(reportBody, /- 앱 버전: /)
    assert.ok(!reportBody.includes(token), '토큰은 신고에 들어가지 않는다')
    await page.getByRole('dialog', { name: '문제 신고' }).getByRole('button', { name: '취소' }).click()
    assert.ok(existsSync(join(userData, 'logs', 'ariadne.log')), '로그 파일')
    await snap('09-settings')
    await page.keyboard.press('Escape')
  })
}
