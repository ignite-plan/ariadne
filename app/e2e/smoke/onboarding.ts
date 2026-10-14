// 첫 실행: GitHub 연결, 리포 내려받기, 환경 점검
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Smoke } from './context.ts'

export async function onboarding({ page, step, snap, token, workspace }: Smoke) {
  await step('온보딩: 토큰 연결', async () => {
    await page.getByRole('heading', { name: 'GitHub 연결' }).waitFor()
    await snap('01-token')
    await page.getByPlaceholder('github_pat_…').fill(token)
    await page.getByRole('button', { name: '연결' }).click()
    await page.getByRole('heading', { name: '매뉴얼 내려받기' }).waitFor({ timeout: 30000 })
  })

  await step('온보딩: 리포 내려받기 (net.fetch)', async () => {
    await snap('02-workspace')
    await page.getByRole('button', { name: '내려받기' }).click()
    await page.getByRole('heading', { name: '환경 점검' }).waitFor({ timeout: 180000 })
    assert.ok(existsSync(join(workspace, 'manuals/bo/manual.yaml')))
  })

  await step('온보딩: 환경 점검', async () => {
    await page.locator('.env-list li').first().waitFor()
    await snap('03-env')
    const ok = await page.locator('.env-list li.ok').count()
    assert.ok(ok >= 3, `통과 항목 ${ok}개`)
    await page.getByRole('button', { name: /시작하기/ }).click()
  })
}
