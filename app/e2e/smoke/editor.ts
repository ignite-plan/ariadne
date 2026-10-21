// 편집 화면: 목차, 미리보기, 자동 저장, 제출 다이얼로그, 되돌리기, 이미지, 새 화면, Word 만들기
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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

  await step('제출 다이얼로그 → 내 PC에 기록만 (원격에 올리지 않음)', async () => {
    await page.getByRole('button', { name: /제출/ }).first().click()
    await page.getByRole('dialog').getByText('변경사항 제출').waitFor()
    const message = await page.getByRole('dialog').locator('textarea').inputValue()
    assert.match(message, /Dealer List View/)
    await snap('06-submit')
    await page.getByRole('dialog').getByRole('button', { name: '내 PC에 기록만' }).click()
    await toast(/내 PC에 기록했습니다 \(제출 전 기록 1건\)/).waitFor()
    const log = execFileSync('git', ['-C', workspace, 'log', '-1', '--format=%B'], { encoding: 'utf8' })
    assert.match(log, /Dealer List View[\s\S]*Ariadne-Record: true/)
    // 기록만 한 변경도 제출 전이라 변경 탭에 남고, 상단에 기록 수가 보인다
    await page.locator('.change-item', { hasText: 'Dealer List View' }).waitFor()
    // 동기화 표시는 원격을 받아 온 뒤 바뀐다 (사내망이 느리면 오래 걸린다)
    await page.locator('.sync-badge', { hasText: '내 PC 기록 1' }).waitFor({ timeout: 90000 })
  })

  await step('되돌리기 (기록한 변경도 마지막 제출 상태로)', async () => {
    await page.locator('.change-item', { hasText: 'Dealer List View' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await toast('되돌렸습니다').waitFor()
    assert.equal(readFileSync(sectionFile, 'utf8'), original)
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor()
    // 다 되돌리면 빈 기록도 정리된다
    assert.doesNotMatch(execFileSync('git', ['-C', workspace, 'log', '-1', '--format=%B'], { encoding: 'utf8' }), /Ariadne-Record/)
  })

  await step('찾기·바꾸기 (지금 화면): ⌘F → 결과 수 → 모두 바꾸기 → 되돌리기', async () => {
    await page.locator('.breadcrumb', { hasText: 'Dealer List View' }).waitFor()
    await page.locator('.cm-content').click()
    await page.keyboard.press('Meta+f')
    const bar = page.getByRole('search', { name: '찾기·바꾸기' })
    await bar.getByLabel('찾을 말').fill('Dealer List')
    // 입력하면 가까운 결과로 옮겨 "n / 전체"를 보여 주고, 다음을 누르면 순서가 바뀐다
    const count = bar.locator('.cm-find-count', { hasText: /^\d+ \/ \d+$/ })
    await count.waitFor()
    const first = await count.innerText()
    assert.notEqual(first.split(' / ')[1], '1', 'Dealer List는 여러 곳에 있다')
    await bar.getByRole('button', { name: '다음 (Enter)' }).click()
    await page.waitForFunction((before) => document.querySelector('.cm-find-count')?.textContent !== before, first)
    assert.ok((await page.locator('.cm-searchMatch').count()) > 1, '찾은 곳을 편집기에 표시한다')
    await snap('06c-find')
    // ⌥⌘F는 바꿀 말 칸으로
    await page.keyboard.press('Meta+Alt+f')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '바꿀 말')
    await bar.getByLabel('바꿀 말').fill('Partner List')
    await bar.getByRole('button', { name: '이 화면에서 찾은 곳을 모두 바꾸기' }).click()
    await bar.locator('.cm-find-count', { hasText: '결과 없음' }).waitFor()
    await page.waitForFunction(() => document.querySelector('.save-state')?.textContent === '저장됨')
    await page.waitForTimeout(1500)
    // 본문만 바꾼다 (front-matter의 화면 제목은 편집기에 없다)
    const body = readFileSync(sectionFile, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '')
    assert.match(body, /Partner List/)
    assert.doesNotMatch(body, /Dealer List/)
    assert.match(readFileSync(sectionFile, 'utf8'), /images\/dealer-list\.png/, '이미지 경로는 대소문자·글자가 달라 그대로')
    // Esc로 닫고, 모두 바꾸기는 한 번에 되돌린다
    await page.keyboard.press('Escape')
    await bar.waitFor({ state: 'detached' })
    await page.getByTitle('되돌리기 (⌘Z)').click()
    await page.waitForFunction(() => document.querySelector('.save-state')?.textContent === '저장됨')
    await page.waitForTimeout(1500)
    assert.equal(readFileSync(sectionFile, 'utf8'), original)
  })

  await step('미리보기 범위: 전체(Word와 같은 내용) → 이 장 → 다른 화면 편집 → Word 메뉴의 만들기 전 전체 보기', async () => {
    const bar = page.locator('.preview-bar')
    await bar.getByRole('button', { name: '전체', exact: true }).click()
    await page.locator('.full-preview .full-section').nth(10).waitFor({ timeout: 60000 })
    const current = page.locator('.full-section.current')
    assert.equal(await current.getAttribute('data-path'), '02-dealer-management/01-dealer-list-view.md', '지금 화면을 강조한다')
    assert.ok((await page.locator('.full-chapter').count()) >= 10, '모든 장')
    assert.equal(await page.locator('.full-preview .todo').count(), 0, 'TODO는 Word처럼 뺀다')
    await snap('06d-full-preview')
    // 이 장만
    await bar.getByRole('button', { name: '이 장', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.full-chapter').length === 1, undefined, { timeout: 30000 })
    // 다른 화면을 편집기에 연다
    const other = page.locator('.full-section[data-path="02-dealer-management/02-dealer-creation-screen.md"]')
    await other.hover()
    await other.getByRole('button', { name: '이 화면 편집' }).click()
    await page.locator('.breadcrumb', { hasText: 'Dealer Creation' }).waitFor()
    await page.locator('.full-section.current[data-path="02-dealer-management/02-dealer-creation-screen.md"]').waitFor()
    // Word 만들기 메뉴: 미리보기만 + 전체
    await bar.getByRole('button', { name: '이 화면', exact: true }).click()
    await page.getByRole('button', { name: 'Word 만들기' }).click()
    await page.getByRole('button', { name: /만들기 전 전체 보기/ }).click()
    await page.locator('.panes.preview').waitFor()
    await bar.locator('button.active', { hasText: '전체' }).waitFor()
    await page.locator('.full-section.current').waitFor({ timeout: 60000 })
    // 뒤 단계를 위해 원래대로 (나란히, 이 화면, Dealer List View)
    await page.getByTitle('나란히').click()
    await bar.getByRole('button', { name: '이 화면', exact: true }).click()
    await page.getByRole('tab', { name: '목차' }).click()
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.locator('.breadcrumb', { hasText: 'Dealer List View' }).waitFor()
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
