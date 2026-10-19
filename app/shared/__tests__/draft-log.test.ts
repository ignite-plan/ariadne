import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DraftEvent } from '../api.ts'
import { applyDraftEvent, applyTaskEvent, isDraftTarget, screenLabel, screenProgress, type ClaudeTask } from '../draft-log.ts'
import { DRAFT_MODES, draftLabel } from '../draft-mode.ts'

const task = (): ClaudeTask => ({ input: { mode: 'refresh', menu: 'Menu' }, panel: 1, phase: 'running', log: [], screens: {}, error: '', startedAt: 0, seq: 1 })

describe('Claude 작업 진행 기록', () => {
  it('도구 호출 줄은 결과가 오면 끝남·실패로 바뀐다', () => {
    const events: DraftEvent[] = [
      { kind: 'claude', event: { kind: 'tool', id: 't1', name: 'Read', label: '읽기: a.md' } },
      { kind: 'claude', event: { kind: 'tool', id: 't2', name: 'mcp__ariadne__stg_open', label: 'STG 화면 열기: /x' }, target: '02-a/01-b.md' },
      { kind: 'claude', event: { kind: 'tool_result', id: 't1', isError: false, text: 'ok' } },
      { kind: 'claude', event: { kind: 'tool_result', id: 't2', isError: true, text: '세션 만료' } },
    ]
    const lines = events.reduce<ReturnType<typeof applyDraftEvent>>((acc, e) => applyDraftEvent(acc, e), [])
    assert.deepEqual(
      lines.map((l) => [l.kind, l.text, l.done, l.failed, l.target]),
      [
        ['tool', '읽기: a.md', true, false, undefined],
        ['tool', 'STG 화면 열기: /x — 세션 만료', true, true, '02-a/01-b.md'],
      ],
    )
  })

  it('요약 JSON은 로그에서 빼고, 대기 중인 화면은 줄을 남기지 않는다', () => {
    let lines = applyDraftEvent([], { kind: 'claude', event: { kind: 'text', text: '끝\n```json\n{"sections":[]}\n```' } })
    assert.deepEqual(lines.map((l) => l.text), ['끝'])
    lines = applyDraftEvent(lines, { kind: 'screen', target: 'a.md', status: 'waiting' })
    assert.equal(lines.length, 1)
  })

  it('캡처 정의 작업은 화면 상태를 정의함 / 더할 것 없음으로 부르고, 편집을 막지 않는다', () => {
    assert.equal(screenLabel('done', 'shots'), '정의함')
    assert.equal(screenLabel('unchanged', 'shots'), '더할 것 없음')
    assert.equal(screenLabel('done', 'refresh'), '고침')
    const t = applyTaskEvent({ ...task(), input: { mode: 'shots', menu: 'Menu' } }, { kind: 'screen', target: 'a.md', status: 'done' })
    assert.equal(t.log.at(-1)?.text, '정의함')
    assert.equal(isDraftTarget({ mode: 'shots', menu: 'Menu', targets: ['a.md'] }, 'a.md'), false)
  })

  it('화면별 진행, 단계, 질문을 작업에 반영한다', () => {
    let t = task()
    t = applyTaskEvent(t, { kind: 'screen', target: 'a.md', status: 'running' })
    t = applyTaskEvent(t, { kind: 'screen', target: 'b.md', status: 'done', text: '2곳' })
    t = applyTaskEvent(t, { kind: 'phase', phase: 'screens', text: '화면 확인' })
    t = applyTaskEvent(t, { kind: 'ask', id: 'q1', text: '요약 없이 계속할까요?' })
    assert.deepEqual(screenProgress(t), { total: 2, finished: 1 })
    assert.equal(t.stage, '화면 확인')
    assert.deepEqual(t.ask, { id: 'q1', text: '요약 없이 계속할까요?' })
    t = applyTaskEvent(t, { kind: 'answered', id: 'q1', proceed: true })
    assert.equal(t.ask, undefined)
    assert.equal(t.log.at(-1)?.text, '요약 없이 계속합니다')
  })

  it('Claude가 고치는 화면: 최신화는 대상 화면, 초안은 그 장 전체', () => {
    assert.ok(isDraftTarget({ mode: 'refresh', menu: 'M', targets: ['02-a/01-b.md'] }, '02-a/01-b.md'))
    assert.ok(!isDraftTarget({ mode: 'refresh', menu: 'M', targets: ['02-a/01-b.md'] }, '02-a/02-c.md'))
    assert.ok(isDraftTarget({ mode: 'create', menu: 'M', chapterDir: '02-a' }, '02-a/02-c.md'))
    assert.ok(!isDraftTarget({ mode: 'video', menu: 'M' }, '02-a/02-c.md'))
  })

  it('작업 종류 문구', () => {
    assert.equal(draftLabel({}), '초안')
    assert.equal(draftLabel({ mode: 'video-scene' }), '장면 채우기')
    assert.equal(DRAFT_MODES.refresh.done(0), '바꿀 곳이 없었습니다')
    assert.match(DRAFT_MODES['video-scene'].about(3), /장면 3의/)
  })
})
