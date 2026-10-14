// 편집 화면: 목차, 미리보기, 자동 저장, 제출 다이얼로그, 되돌리기, 이미지, 새 화면, Word 만들기
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Smoke } from './context.ts'

export async function editor({ page, step, snap, toast, workspace }: Smoke) {
  await step('편집 화면: 목차와 첫 화면', async () => {
    await page.locator('.toc-section').first().waitFor({ timeout: 30000 })
    assert.ok((await page.locator('.toc-chapter').count()) >= 10)
    await page.locator('.cm-content').waitFor()
    await page.locator('.sync-badge.synced').waitFor({ timeout: 30000 })
  })

  await step('Dealer List View 열기 + 미리보기 이미지', async () => {
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.locator('.breadcrumb', { hasText: 'Dealer List View' }).waitFor()
    await page.locator('.page h2', { hasText: 'Dealer List View' }).waitFor({ timeout: 15000 })
    const img = page.locator('.page img').first()
    await img.waitFor()
    assert.match((await img.getAttribute('src')) ?? '', /^ariadne:\/\/ws\/manuals\/bo\/images\//)
    await page.waitForFunction(() => {
      const el = document.querySelector('.page img') as HTMLImageElement | null
      return Boolean(el && el.complete && el.naturalWidth > 0)
    })
    assert.ok((await page.locator('.cm-size-chip').count()) > 0, '크기 칩')
    await snap('04-workbench')
  })

  const sectionFile = join(workspace, 'manuals/bo/02-dealer-management/01-dealer-list-view.md')
  const original = readFileSync(sectionFile, 'utf8')

  await step('편집 → 자동 저장 → 변경 탭', async () => {
    await page.locator('.cm-content').click()
    await page.keyboard.press('Meta+ArrowDown')
    await page.keyboard.type('\n- **E2E Label**: added by smoke test.')
    await page.locator('.save-state.saved').waitFor({ timeout: 5000 })
    await page.waitForFunction(() => document.querySelector('.save-state')?.textContent === '저장됨')
    assert.match(readFileSync(sectionFile, 'utf8'), /E2E Label\*\*: added by smoke test\./)
    await page.locator('.page strong', { hasText: 'E2E Label' }).waitFor({ timeout: 10000 })
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.change-item', { hasText: 'Dealer List View' }).waitFor({ timeout: 10000 })
    await snap('05-changes')
  })

  await step('제출 다이얼로그 (제출하지 않음)', async () => {
    await page.getByRole('button', { name: /제출/ }).first().click()
    await page.getByRole('dialog').getByText('변경사항 제출').waitFor()
    const message = await page.getByRole('dialog').locator('textarea').inputValue()
    assert.match(message, /Dealer List View/)
    await snap('06-submit')
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  })

  await step('되돌리기', async () => {
    await page.locator('.change-item', { hasText: 'Dealer List View' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await toast('되돌렸습니다').waitFor()
    assert.equal(readFileSync(sectionFile, 'utf8'), original)
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor()
  })

  await step('이미지 다이얼로그', async () => {
    await page.getByRole('tab', { name: '목차' }).click()
    await page.getByTitle('이미지 넣기').click()
    await page.locator('.image-tile').first().waitFor()
    assert.ok((await page.locator('.image-tile').count()) > 200)
    await page.getByPlaceholder('이미지 id 검색').fill('dealer-list')
    await snap('07-image')
    await page.keyboard.press('Escape')
  })

  await step('새 화면 추가 → 삭제', async () => {
    await page.getByRole('button', { name: '새 화면' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '빈 화면 직접 쓰기' }).click()
    await page.getByRole('dialog').locator('select').first().selectOption({ index: 15 }) // 마지막 장
    await page.getByPlaceholder('Menu List View').fill('E2E Smoke Screen')
    await page.getByRole('dialog').getByRole('button', { name: '추가' }).click()
    await page.locator('.breadcrumb', { hasText: 'E2E Smoke Screen' }).waitFor()
    await page.locator('.page .todo').first().waitFor()
    const item = page.locator('.toc-chapter li', { hasText: 'E2E Smoke Screen' })
    await item.hover()
    await item.getByTitle('화면 삭제').click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
    await item.waitFor({ state: 'detached' })
    await page.getByRole('tab', { name: /변경/ }).click()
    // manual.yaml을 원래대로 쓰므로 남는 변경이 없어야 한다
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('Word 만들기 (지금 장)', async () => {
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.getByRole('button', { name: 'Word 만들기' }).click()
    await page.getByRole('button', { name: /지금 장만/ }).click()
    await toast('Word 문서를 만들었습니다').waitFor({ timeout: 60000 })
    const docx = readdirSync(join(workspace, 'dist')).filter((f) => f.endsWith('_ch2.docx'))
    assert.equal(docx.length, 1)
  })
}
