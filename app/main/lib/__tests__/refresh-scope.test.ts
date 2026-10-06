import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkScope, parseTickets, scopeLabel } from '../../../shared/draft-mode.ts'
import type { DraftEvent } from '../../../shared/api.ts'
import { specTaskText, taskText } from '../prompts.ts'
import { runRefreshBatch } from '../refresh-batch.ts'
import { buildRunMcpConfig, confluenceReadOnly } from '../run-mcp.ts'
import { hasScopedChanges, parseSpecReply, screenBrief, type SpecDigest } from '../spec.ts'

const ref = { root: '/w', manual: 'bo' }
const targets = ['08-menu/01-list.md', '08-menu/02-create.md', '08-menu/04-edit.md']
const digest: SpecDigest = {
  menu: 'Menu Management',
  generatedAt: '2026-10-07',
  pages: [{ id: '100', title: '[202608output][Phase3][BO] 메뉴 관리 화면', version: 7 }],
  screens: { '08-menu/01-list.md': 'List', '08-menu/02-create.md': 'Create', '08-menu/04-edit.md': 'Edit' },
  changes: { '04-edit.md': '2026-07-14 GIDPDVO-2067: 권한 팝업 체크박스 추가', '02-create.md': '(없음)' },
}

describe('반영 범위 입력', () => {
  it('티켓: 쉼표·줄바꿈으로 나누고 대문자로, 형식이 틀린 것은 따로', () => {
    assert.deepEqual(parseTickets('gidpgro-973, GIDPDVO-2067\nGIDPGRO-973  oops'), { tickets: ['GIDPGRO-973', 'GIDPDVO-2067'], invalid: ['OOPS'] })
    assert.deepEqual(parseTickets('  '), { tickets: [], invalid: [] })
  })

  it('기간·티켓 확인, 비면 범위 없음', () => {
    assert.deepEqual(checkScope({ from: '2026-05', to: '2026-08', tickets: [] }), { scope: { from: '2026-05', to: '2026-08' } })
    assert.deepEqual(checkScope({ from: '', to: '', tickets: [] }), {})
    assert.deepEqual(checkScope(undefined), {})
    assert.match(checkScope({ from: '2026-09', to: '2026-05' }).error ?? '', /늦습니다/)
    assert.match(checkScope({ to: '2026-13' }).error ?? '', /끝 월 형식/)
    assert.match(checkScope({ tickets: ['bad'] }).error ?? '', /티켓 형식/)
    assert.equal(scopeLabel({ from: '2026-05', to: '2026-08', tickets: ['A-1', 'B-2', 'C-3'] }), '2026-05 ~ 2026-08 · A-1, B-2 외 1')
    assert.equal(scopeLabel({ tickets: ['A-1'] }), 'A-1')
  })
})

describe('반영 범위 요약과 지시', () => {
  it('요약 응답의 changes를 읽고, 반영할 변경이 있는 화면만 고른다', () => {
    const reply = parseSpecReply('```json\n' + JSON.stringify({ ...digest, changes: { 'a.md': 'X' } }) + '\n```', 'M')
    assert.ok(reply && !reply.reused)
    assert.deepEqual(reply.digest.changes, { 'a.md': 'X' })
    assert.equal(hasScopedChanges(digest, '08-menu/04-edit.md'), true)
    assert.equal(hasScopedChanges(digest, '08-menu/02-create.md'), false, '(없음)은 변경 없음')
    assert.equal(hasScopedChanges(digest, '08-menu/01-list.md'), false)
    assert.match(screenBrief(digest, '08-menu/04-edit.md'), /이번에 반영할 변경 \(이것만 반영한다\):\n2026-07-14 GIDPDVO-2067/)
  })

  it('요약 지시: 범위, 끝 달 output, 티켓은 Jira로, changes 필수, 재사용 없음', () => {
    const text = specTaskText(ref, { mode: 'refresh', menu: 'Menu', targets, scope: { from: '2026-05', to: '2026-08', tickets: ['GIDPDVO-2067'] } }, {
      previous: [{ id: '100', title: 't', version: 9 }],
    })
    assert.match(text, /기간: 2026-05 ~ 2026-08/)
    assert.match(text, /`\[202608output\]` 또는 그보다 이전 output/)
    assert.match(text, /Jira 티켓: GIDPDVO-2067/)
    assert.match(text, /jira_get_issue/)
    assert.match(text, /`changes`/)
    assert.doesNotMatch(text, /지난 요약의 근거 문서/)
  })

  it('화면 지시: 반영할 변경만, STG 범위 밖은 TODO, 캡처 금지', () => {
    const text = taskText(ref, { mode: 'refresh', menu: 'Menu', targets: [targets[2]], scope: { tickets: ['GIDPDVO-2067'] } }, { brief: 'B' })
    assert.match(text, /이번에 반영할 변경"에 있는 것만 고친다/)
    assert.match(text, /STG에 반영 범위 밖 변경 보임/)
    assert.match(text, /save_shot 금지/)
    assert.doesNotMatch(taskText(ref, { mode: 'refresh', menu: 'Menu', targets: [targets[2]] }, { brief: 'B' }), /반영 범위/)
  })

  it('티켓이 있으면 mcp-atlassian에 Jira 읽기 도구만 더 켠다', () => {
    const server = { type: 'stdio', command: 'mcp-atlassian', env: { CONFLUENCE_URL: 'x' } }
    assert.doesNotMatch(confluenceReadOnly(server).env?.ENABLED_TOOLS ?? '', /jira/)
    const tools = confluenceReadOnly(server, { jira: true }).env?.ENABLED_TOOLS ?? ''
    assert.match(tools, /,jira_get_issue,jira_search$/)
    const run = buildRunMcpConfig({ ariadne: {} }, ['a'], { a: server }, { jira: true })
    assert.match(String((run.config.mcpServers.a as { env: Record<string, string> }).env.ENABLED_TOOLS), /jira_search/)
  })
})

describe('반영 범위 최신화 진행', () => {
  it('반영할 변경이 없는 화면은 건너뛰고, 근거 버전은 기록하지 않는다', async () => {
    const events: DraftEvent[] = []
    const ran: string[] = []
    const recorded: string[] = []
    const { screens } = await runRefreshBatch({
      targets,
      scoped: true,
      concurrency: 2,
      runSpec: async () => digest,
      readMeta: () => ({ refreshedFrom: [{ page: '100', version: 7 }] }),
      runScreen: async (t) => (ran.push(t), { ok: true, changed: true }),
      recordRefresh: (t) => recorded.push(t),
      onEvent: (e) => events.push(e),
      isCancelled: () => false,
    })
    assert.deepEqual(ran, ['08-menu/04-edit.md'], '근거 버전이 같아도 범위 최신화는 버전으로 건너뛰지 않는다')
    assert.deepEqual(
      screens.map((s) => [s.status, s.text]),
      [
        ['skipped', '반영 범위에 해당하는 변경이 없습니다'],
        ['skipped', '반영 범위에 해당하는 변경이 없습니다'],
        ['done', undefined],
      ],
    )
    assert.deepEqual(recorded, [])
  })

  it('요약을 못 만들면 모든 화면을 범위 지시와 함께 돌린다', async () => {
    const ran: string[] = []
    await runRefreshBatch({
      targets,
      scoped: true,
      concurrency: 3,
      runSpec: async () => undefined,
      readMeta: () => ({}),
      runScreen: async (t) => (ran.push(t), { ok: true, changed: false }),
      recordRefresh: () => {},
      onEvent: () => {},
      isCancelled: () => false,
    })
    assert.equal(ran.length, 3)
  })
})
