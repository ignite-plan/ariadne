// Claude로 초안 만들기·최신화 (가짜 claude → Ariadne MCP → STG)
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Smoke } from './context.ts'

export async function claude({ page, step, snap, toast, workspace, claudeHold }: Smoke) {
  await step('Claude로 초안 만들기 (가짜 claude → Ariadne MCP → STG)', async () => {
    await page.getByRole('button', { name: '새 화면' }).click()
    await page.getByPlaceholder('Menu Management').first().fill('Menu Management E2E')
    await page.getByRole('dialog').locator('select').nth(1).selectOption({ index: 8 }) // 8장 (기존 8장 앞)
    await page.getByRole('dialog').getByRole('button', { name: '다음' }).click()
    await page.getByRole('heading', { name: 'Claude로 초안 만들기' }).waitFor()
    await page.locator('.check-row.ok', { hasText: 'Claude Code' }).waitFor({ timeout: 30000 })
    await page.locator('.check-row.ok', { hasText: 'Confluence' }).waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: '초안 만들기 시작' }).click()
    await page.locator('.draft-summary', { hasText: '초안을 만들었습니다' }).waitFor({ timeout: 90000 })
    // 저장/삭제 버튼 거절이 로그에 보인다
    await page.locator('.log li.log-tool.failed', { hasText: 'STG 누르기: Delete' }).waitFor()
    await page.locator('.log li', { hasText: '캡처 저장: menu-e2e-list' }).waitFor()
    await snap('12-draft')
    assert.ok(existsSync(join(workspace, 'manuals/bo/08-menu-management-e2e/01-menu-list-view.md')))
    assert.ok(existsSync(join(workspace, 'manuals/bo/09-menu-management/00-intro.md')), '기존 8장이 9장으로 밀린다')
    assert.ok(existsSync(join(workspace, 'manuals/bo/images/menu-e2e-list.png')))
    assert.match(readFileSync(join(workspace, 'manuals/bo/shots.ts'), 'utf8'), /id: 'menu-e2e-list'/)
    await page.locator('.draft-summary button.link', { hasText: '08-menu-management-e2e/01-menu-list-view.md' }).click()
    await page.locator('.breadcrumb', { hasText: 'Menu List View' }).waitFor()
    await page.locator('.page .todo', { hasText: '최대 길이' }).waitFor({ timeout: 15000 })
    await page.getByRole('tab', { name: /TODO/ }).click()
    await page.locator('.todo-item', { hasText: '최대 길이' }).waitFor()

    await page.getByRole('tab', { name: /변경/ }).click()
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    assert.ok(existsSync(join(workspace, 'manuals/bo/08-menu-management/00-intro.md')), '되돌리면 8장이 제자리')
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('Claude로 최신화 (숨기고 그동안 영상 만들기) → 변경 보기 → 되돌리기', async () => {
    // 동시에 만들 영상 (가짜 BO에서 도는 시나리오)
    const concurrent = join(workspace, 'manuals/bo/videos/e2e-concurrent.yaml')
    writeFileSync(
      concurrent,
      'title: E2E Concurrent\nscenes:\n  - say: The dealer list opens.\n    steps:\n      - open: /dealer/company\n      - waitFor:\n          text: Total\n      - click:\n          role: button\n          name: Location\n',
    )
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.locator('.breadcrumb', { hasText: 'Dealer List View' }).waitFor()
    await page.locator('.doc-header').getByRole('button', { name: /Claude로 최신화/ }).click()
    await page.getByRole('heading', { name: 'Claude로 최신화' }).waitFor()
    await page.locator('.draft-input', { hasText: '02-dealer-management/01-dealer-list-view.md' }).waitFor()
    await page.getByRole('button', { name: '최신화 시작' }).click()
    // Claude가 STG 탭을 연 채로 기다린다. 패널을 숨겨도 작업은 이어지고, 고치는 화면은 편집이 막힌다
    // 기획서 요약을 먼저 한 번 만들고, 화면마다 따로 돈다
    await page.locator('.screen-chip.status-running', { hasText: '01-dealer-list-view' }).waitFor({ timeout: 60000 })
    await page.locator('.log li', { hasText: '캡처 저장: dealer-list' }).waitFor({ timeout: 60000 })
    await page.locator('.log li', { hasText: '기획서를 더 읽는 중' }).waitFor()
    await page.locator('.panel-header').getByRole('button', { name: '숨기기' }).click()
    await page.locator('.task-chip', { hasText: 'Claude 최신화' }).waitFor()
    await page.locator('.doc-lock').waitFor()
    assert.ok(await page.locator('.titlebar').getByRole('button', { name: /제출/ }).isDisabled(), 'Claude 작업 중에는 제출하지 않는다')

    // 그동안 영상 만들기 (공유 Chrome의 다른 탭). 미리보기(화면이 보이는 Chrome)는 막힌다
    await page.getByRole('button', { name: '영상', exact: true }).click()
    await page.locator('.video-item', { hasText: 'E2E Concurrent' }).click()
    await page.locator('.video-title h2', { hasText: 'E2E Concurrent' }).waitFor()
    assert.ok(await page.locator('.video-toolbar').getByRole('button', { name: '미리보기', exact: true }).isDisabled())
    await page.locator('.video-check input').uncheck()
    await page.locator('.video-toolbar').getByRole('button', { name: '영상 만들기' }).click()
    await page.locator('.task-chip', { hasText: '영상 만들기' }).waitFor()
    await snap('13a-concurrent')
    await toast(/"E2E Concurrent" 영상을 만들었습니다/).waitFor({ timeout: 120000 })
    assert.ok(existsSync(join(workspace, 'dist/videos/e2e-concurrent.mp4')), '최신화가 도는 동안 영상을 만들었다')
    assert.ok(await page.locator('.task-chip', { hasText: 'Claude 최신화' }).isVisible(), 'Claude 작업은 아직 돈다')
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    rmSync(concurrent)

    // Claude를 마치게 한다. 숨겨 둔 동안 끝나면 알리고, 칩에서 결과를 연다
    writeFileSync(claudeHold, '')
    await toast(/Claude 최신화 작업을 마쳤습니다/).waitFor({ timeout: 60000 })
    await page.locator('.task-chip', { hasText: 'Claude 최신화 완료' }).click()
    await page.locator('.draft-summary', { hasText: '최신화했습니다' }).waitFor({ timeout: 10000 })
    // 근거 기획서 버전을 남겨 다음 최신화에서 건너뛴다
    assert.match(readFileSync(join(workspace, 'manuals/bo/02-dealer-management/01-dealer-list-view.md'), 'utf8'), /refreshedFrom:\n {2}- page: "?900001"?\n {4}version: 3/)
    assert.ok(readdirSync(join(workspace, '.capture/bo/spec')).some((f) => f.endsWith('.json')), '기획서 요약 파일')
    // 기존 이미지(정의 있음)를 같은 id로 다시 찍었다
    assert.equal((readFileSync(join(workspace, 'manuals/bo/shots.ts'), 'utf8').match(/id: 'dealer-list',/g) ?? []).length, 1)
    await page.locator('.draft-summary').getByRole('button', { name: /변경 보기/ }).click()
    await page.locator('.diff-row.del', { hasText: 'This screen provides a list of all registered dealers.' }).waitFor()
    await page.locator('.diff-row.add', { hasText: 'This screen lists all registered dealers and their status.' }).waitFor()
    await snap('13-refresh-diff')
    await page.keyboard.press('Escape')
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    // 열려 있던 화면은 Claude가 고친 내용으로 다시 읽힌다
    await page.locator('.cm-content', { hasText: 'lists all registered dealers and their status' }).waitFor({ timeout: 10000 })
    // 최신화 뒤에는 변경 탭으로 간다
    await page.locator('.change-item', { hasText: 'Dealer List View' }).getByTitle('변경 보기').click()
    await page.locator('.diff-row.add', { hasText: 'their status' }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('Claude로 최신화: 반영 범위(기간·티켓) → 해당 화면만, 캡처는 거절 → 되돌리기', async () => {
    const listFile = join(workspace, 'manuals/bo/02-dealer-management/01-dealer-list-view.md')
    const shotsBefore = readFileSync(join(workspace, 'manuals/bo/shots.ts'), 'utf8')
    const chapter = page.locator('.toc-chapter', { hasText: 'Dealer Management' })
    await chapter.locator('.toc-chapter-row').hover()
    await chapter.getByTitle('이 장 전체를 Claude로 최신화').click()
    await page.getByRole('heading', { name: 'Claude로 최신화' }).waitFor()
    // 형식이 틀린 티켓은 시작 전에 알린다
    await page.getByLabel('Jira 티켓').fill('E2E-101, oops')
    await page.locator('.scope-fields .form-error', { hasText: 'OOPS' }).waitFor()
    await page.getByLabel('Jira 티켓').fill('e2e-101')
    await page.getByLabel('시작 월').fill('2026-05')
    await page.getByLabel('끝 월').fill('2026-08')
    await page.locator('.scope-fields .hint', { hasText: '이 범위의 변경만' }).waitFor()
    assert.equal(await page.getByText('기획서가 안 바뀐 화면도 다시 확인').count(), 0, '범위가 있으면 버전 건너뛰기 옵션은 없다')
    await page.getByRole('button', { name: '최신화 시작' }).click()
    await page.locator('.draft-input', { hasText: '2026-05 ~ 2026-08 · E2E-101' }).waitFor()
    await page.locator('.draft-summary', { hasText: '최신화했습니다' }).waitFor({ timeout: 60000 })
    // 반영할 변경이 있는 화면만 돌고 나머지는 건너뛴다. 캡처는 거절된다
    await page.locator('.screen-chip.status-done', { hasText: '01-dealer-list-view' }).waitFor()
    assert.ok((await page.locator('.screen-chip.status-skipped').count()) >= 1)
    await page.waitForFunction(() => document.querySelectorAll('.screen-chip.status-done').length === 1, undefined, { timeout: 10000 })
    await page.locator('.log li.failed', { hasText: '캡처 저장: dealer-list' }).waitFor()
    await snap('13b-refresh-scope')
    assert.equal(readFileSync(join(workspace, 'manuals/bo/shots.ts'), 'utf8'), shotsBefore, '캡처 정의는 그대로')
    const after = readFileSync(listFile, 'utf8')
    assert.match(after, /lists all registered dealers and their status/)
    assert.doesNotMatch(after, /refreshedFrom/, '일부만 반영했으므로 근거 버전을 남기지 않는다')
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    // 바뀐 파일은 딜러 목록 화면 하나 (캡처·shots.ts는 그대로)
    await page.getByRole('tab', { name: /변경/ }).click()
    // 변경 목록이 갱신될 때까지 기다린 뒤 센다
    await page.locator('.change-item', { hasText: 'Dealer List View' }).waitFor()
    await page.waitForFunction(() => document.querySelectorAll('.change-item').length === 1, undefined, { timeout: 10000 })
    await page.locator('.change-item', { hasText: 'Dealer List View' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('Claude로 최신화: 기획서 요약 실패 → 계속할지 묻기 → 중지', async () => {
    const chapter = page.locator('.toc-chapter', { hasText: 'Dealer Management' })
    await chapter.locator('.toc-chapter-row').hover()
    await chapter.getByTitle('이 장 전체를 Claude로 최신화').click()
    await page.getByRole('heading', { name: 'Claude로 최신화' }).waitFor()
    await page.getByLabel('Jira 티켓').fill('FAIL-999')
    await page.getByRole('button', { name: '최신화 시작' }).click()
    // 화면별로 퍼지기 전에 묻는다
    await page.locator('.draft-ask', { hasText: '기획서 요약을 만들지 못했습니다' }).waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.screen-chip.status-running').count(), 0, '묻는 동안 화면 작업은 시작하지 않는다')
    await snap('13c-spec-ask')
    await page.locator('.draft-ask').getByRole('button', { name: '중지' }).click()
    await page.locator('.draft-summary', { hasText: '최신화를 끝까지 하지 못했습니다' }).waitFor({ timeout: 30000 })
    assert.ok((await page.locator('.screen-chip.status-cancelled').count()) >= 1)
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
    await page.getByRole('tab', { name: '목차' }).click()
  })
}
