// 새 매뉴얼 가져오기와 목차 순서 바꾸기
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Smoke } from './context.ts'

export async function manuals({ app, page, step, snap, toast, workspace }: Smoke) {
  await step('새 매뉴얼 가져오기 (Word → FO) → 전환 → 되돌리기', async () => {
    // 파일 대화상자 대신 리포의 BO 원본을 고르게 한다
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [file] })) as typeof dialog.showOpenDialog
    }, resolve('manuals/bo/source/Hyundai.docx'))
    await page.locator('.manual-switch').click()
    await page.getByRole('button', { name: /새 매뉴얼 가져오기/ }).click()
    await page.getByRole('button', { name: 'Word 파일 고르기…' }).click()
    await page.locator('.import-stats', { hasText: '15장' }).waitFor({ timeout: 60000 })
    await page.locator('.import-stats', { hasText: '이미지 289장' }).waitFor()
    const title = page.locator('.import-form input').first()
    assert.equal(await title.inputValue(), 'Dealers Admin User Manual')
    await title.fill('Dealers FO User Manual E2E')
    assert.equal(await page.locator('.import-form input').nth(1).inputValue(), 'fo-e2e')
    assert.equal(await page.getByPlaceholder('https://stg-…').inputValue(), 'https://stg-dealers.hyundai-corp.io')
    await snap('10-import')
    await page.getByRole('dialog').getByRole('button', { name: '가져오기' }).click()
    await toast('새 매뉴얼을 가져왔습니다').waitFor({ timeout: 120000 })
    await page.locator('.manual-switch', { hasText: 'Dealers FO User Manual E2E' }).waitFor()
    await page.getByRole('tab', { name: '목차' }).click()
    assert.equal(await page.locator('.toc-chapter').count(), 15)
    // 미리보기가 새 매뉴얼 첫 화면으로 바뀐다
    await page.locator('.page', { hasText: 'While connected to the VPN' }).waitFor({ timeout: 15000 })
    await page.locator('.page img').first().waitFor({ timeout: 15000 })
    assert.ok(existsSync(join(workspace, 'manuals/fo-e2e/source/Hyundai.docx')))
    assert.match(readFileSync(join(workspace, 'manuals/fo-e2e/manual.yaml'), 'utf8'), /baseUrl: https:\/\/stg-dealers\.hyundai-corp\.io\n/)
    await snap('11-imported')

    await page.getByTitle('설정').click()
    await page.locator('.settings-nav button', { hasText: '매뉴얼' }).click()
    await page.getByPlaceholder('https://stg-…').waitFor()
    assert.equal(await page.getByPlaceholder('https://stg-…').inputValue(), 'https://stg-dealers.hyundai-corp.io')
    await page.keyboard.press('Escape')

    await page.locator('.manual-switch').click()
    await page.locator('.menu button', { hasText: 'Dealers Admin User Manual' }).click()
    await page.locator('.manual-switch', { hasText: 'Dealers Admin User Manual' }).waitFor()
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    assert.ok(!existsSync(join(workspace, 'manuals/fo-e2e/manual.yaml')))
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('매뉴얼 삭제: 다른 매뉴얼 지우기 → 변경 탭에 한 줄 → 되돌리면 복구', async () => {
    const target = join(workspace, 'manuals/front-en')
    assert.ok(existsSync(join(target, 'manual.yaml')), 'FO 매뉴얼이 리포에 있다')
    await page.locator('.manual-switch').click()
    // 지금 매뉴얼(BO)에는 삭제 버튼이 없다
    const current = page.locator('.manual-row', { has: page.locator('button.current') })
    assert.equal(await current.locator('.manual-delete').count(), 0)
    const row = page.locator('.manual-row', { hasText: 'front-en ·' })
    await row.hover()
    await row.locator('.manual-delete').click()
    const dialog = page.getByRole('dialog', { name: '매뉴얼 삭제' })
    // id를 입력해야 지울 수 있다
    assert.ok(await dialog.getByRole('button', { name: '삭제' }).isDisabled())
    await dialog.getByLabel('매뉴얼 id 확인').fill('front-en')
    await dialog.getByRole('button', { name: '삭제' }).click()
    await toast(/매뉴얼을 지웠습니다/).waitFor()
    assert.ok(!existsSync(target))
    const item = page.locator('.change-item', { hasText: /매뉴얼 삭제: front-en \(파일 \d+개\)/ })
    await item.waitFor({ timeout: 15000 })
    assert.equal(await page.locator('.change-item').count(), 1, '파일 수백 개가 아니라 한 줄')
    await snap('10b-delete-manual')
    await item.getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    assert.ok(existsSync(join(target, 'manual.yaml')), '되돌리면 매뉴얼이 돌아온다')
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('목차 끌어 놓기로 장 순서 바꾸기 → 되돌리기', async () => {
    const titles = () => page.locator('.toc-chapter-title .ellipsis').allTextContents()
    const before = await titles()
    await page.locator('.toc-chapter-row', { hasText: 'Job Management' }).dragTo(page.locator('.toc-chapter-row', { hasText: 'Dealer Management' }))
    await page.waitForFunction(() => document.querySelectorAll('.toc-chapter-title .ellipsis')[1]?.textContent === 'Job Management')
    const after = await titles()
    assert.equal(after[1], 'Job Management')
    assert.equal(after[2], before[1])
    assert.ok(existsSync(join(workspace, 'manuals/bo/02-job-management')))
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    await page.getByRole('tab', { name: '목차' }).click()
    await page.waitForFunction(() => document.querySelectorAll('.toc-chapter-title .ellipsis')[1]?.textContent === 'Dealer Management')
  })
}
