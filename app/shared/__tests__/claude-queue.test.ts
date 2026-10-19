import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DraftInput } from '../api.ts'
import { canQueue, EMPTY_QUEUE, enqueue, moveQueued, pauseWith, queuePosition, removeQueued, resumeQueue, takeNext, type QueuedDraft } from '../claude-queue.ts'

const item = (panel: number, menu = `Menu ${panel}`): QueuedDraft => ({
  panel,
  input: { mode: 'refresh', menu, targets: [`0${panel}-x/01-a.md`] },
  options: panel === 2 ? { scope: { tickets: ['E2E-101'] } } : {},
  addedAt: panel,
})
const panels = (q: { items: QueuedDraft[] }) => q.items.map((i) => i.panel)

describe('Claude 최신화 대기열', () => {
  it('최신화와 캡처 정의만 대기할 수 있다', () => {
    assert.equal(canQueue({ mode: 'refresh', menu: 'A' }), true)
    assert.equal(canQueue({ mode: 'shots', menu: 'A' }), true)
    for (const mode of ['create', 'video', 'video-scene'] as DraftInput['mode'][]) assert.equal(canQueue({ mode, menu: 'A' }), false)
  })

  it('넣은 순서대로 꺼내고, 같은 패널은 두 번 넣지 않는다. 반영 범위도 함께 꺼낸다', () => {
    let q = enqueue(enqueue(enqueue(EMPTY_QUEUE, item(1)), item(2)), item(1))
    assert.deepEqual(panels(q), [1, 2])
    let taken = takeNext(q)
    assert.equal(taken.next?.panel, 1)
    q = taken.queue
    taken = takeNext(q)
    assert.deepEqual(taken.next?.options, { scope: { tickets: ['E2E-101'] } })
    assert.deepEqual(takeNext(taken.queue), { queue: { items: [] } })
  })

  it('빼기, 한 칸씩 순서 바꾸기 (끝에서는 그대로)', () => {
    let q = [1, 2, 3].reduce((acc, p) => enqueue(acc, item(p)), EMPTY_QUEUE)
    q = moveQueued(q, 3, -1)
    assert.deepEqual(panels(q), [1, 3, 2])
    assert.equal(moveQueued(q, 1, -1), q)
    assert.equal(moveQueued(q, 2, 1), q)
    q = removeQueued(q, 3)
    assert.deepEqual(panels(q), [1, 2])
    assert.equal(queuePosition(q, 2), 1)
    assert.equal(queuePosition(q, 9), -1)
  })

  it('세션 만료로 시작하지 못하면 맨 앞에 되돌리고 멈춘다. 계속하면 다시 꺼낸다', () => {
    const q = enqueue(enqueue(EMPTY_QUEUE, item(1)), item(2))
    const { next, queue } = takeNext(q)
    const paused = pauseWith(queue, 'STG 로그인 세션이 만료되었습니다', next)
    assert.deepEqual(panels(paused), [1, 2])
    assert.equal(paused.paused, 'STG 로그인 세션이 만료되었습니다')
    assert.equal(takeNext(paused).next, undefined)
    assert.equal(takeNext(resumeQueue(paused)).next?.panel, 1)
    // 다 빼면 멈춤도 풀린다
    assert.equal(removeQueued(removeQueued(paused, 1), 2).paused, undefined)
  })
})
