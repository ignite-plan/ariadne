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
})
