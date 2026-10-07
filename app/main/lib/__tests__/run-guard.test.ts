import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRunGuard } from '../run-guard.ts'

const tool = (id: string, name: string) => ({ kind: 'tool' as const, id, name, label: name })
const result = (id: string, isError: boolean) => ({ kind: 'tool_result' as const, id, isError, text: '' })

describe('작업 감시', () => {
  it('Edit가 연속으로 실패하면 한 번만 멈춘다. 성공하면 다시 센다, 다른 도구 실패는 세지 않는다', () => {
    const reasons: string[] = []
    const guard = createRunGuard({ maxEditFailures: 3 }, (r) => reasons.push(r))
    const events = [
      tool('1', 'Edit'), result('1', true),
      tool('2', 'Edit'), result('2', true),
      tool('3', 'Edit'), result('3', false),
      tool('4', 'Read'), result('4', true),
      tool('5', 'Edit'), result('5', true),
      tool('6', 'Write'), result('6', true),
    ]
    for (const e of events) guard.onEvent(e)
    assert.deepEqual(reasons, [])
    guard.onEvent(tool('7', 'Edit'))
    guard.onEvent(result('7', true))
    guard.onEvent(tool('8', 'Edit'))
    guard.onEvent(result('8', true))
    assert.deepEqual(reasons, ['파일 고치기가 3번 연속 실패해 멈췄습니다'])
    assert.equal(guard.stopped, reasons[0])
    guard.dispose()
  })

  it('시간 상한', async () => {
    const reasons: string[] = []
    const guard = createRunGuard({ timeoutMs: 20 }, (r) => reasons.push(r))
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(reasons.length, 1)
    assert.match(reasons[0], /시간 상한/)
    guard.dispose()
  })

  it('dispose하면 시간 상한이 울리지 않는다', async () => {
    const reasons: string[] = []
    createRunGuard({ timeoutMs: 20 }, (r) => reasons.push(r)).dispose()
    await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual(reasons, [])
  })

  it('같은 조회를 되풀이하면 멈춘다 (STG 조작·다른 입력은 세지 않는다)', () => {
    const reasons: string[] = []
    const guard = createRunGuard({ maxRepeats: 3 }, (r) => reasons.push(r))
    const grep = (id: string, pattern: string) => ({ kind: 'tool' as const, id, name: 'Grep', label: `찾기: ${pattern}`, key: JSON.stringify({ pattern }) })
    guard.onEvent(grep('1', 'Date'))
    guard.onEvent(grep('2', 'Date'))
    guard.onEvent(grep('3', 'History'))
    for (const id of ['4', '5', '6']) guard.onEvent({ kind: 'tool', id, name: 'mcp__ariadne__stg_click', label: '누르기', key: '{"name":"Add"}' })
    assert.deepEqual(reasons, [])
    guard.onEvent(grep('7', 'Date'))
    assert.deepEqual(reasons, ['같은 조회를 3번 되풀이해 멈췄습니다: 찾기: Date'])
    const searched: string[] = []
    const confluence = createRunGuard({ maxRepeats: 2 }, (r) => searched.push(r))
    for (const id of ['a', 'b']) confluence.onEvent({ kind: 'tool', id, name: 'mcp__mcp-atlassian-hmg__confluence_search', label: '검색', key: '{"query":"x"}' })
    assert.equal(searched.length, 1)
  })

  it('도구 오류가 연달아 나면 멈춘다. 성공하면 다시 센다', () => {
    const reasons: string[] = []
    const guard = createRunGuard({ maxConsecutiveErrors: 3 }, (r) => reasons.push(r))
    const r = (id: string, isError: boolean) => ({ kind: 'tool_result' as const, id, isError, text: '' })
    for (const e of [r('1', true), r('2', true), r('3', false), r('4', true), r('5', true)]) guard.onEvent(e)
    assert.deepEqual(reasons, [])
    guard.onEvent(r('6', true))
    assert.deepEqual(reasons, ['도구 오류가 3번 연달아 나서 멈췄습니다'])
  })
})
