// Claude 최신화 대기열. 화면(tasks.tsx)이 지금 작업이 끝나면 다음 항목을 시작한다. main은 지금처럼 한 번에 하나만 돈다.
// 앱을 켜 둔 동안만 유지한다
import type { DraftInput, RefreshScope } from './api.ts'

export interface QueuedDraft {
  // 대기에 넣은 패널 번호 (작업이 시작되면 같은 번호로 결과를 연다)
  panel: number
  input: DraftInput
  options: { force?: boolean; scope?: RefreshScope }
  addedAt: number
}

export interface ClaudeQueue {
  items: QueuedDraft[]
  // 멈춘 이유 (세션 만료 등). 있으면 자동으로 시작하지 않는다
  paused?: string
}

export const EMPTY_QUEUE: ClaudeQueue = { items: [] }

// 대기할 수 있는 작업. 초안·영상 Claude 작업은 화면 생성·영상 패널과 얽혀 지금처럼 한 번에 하나
export const canQueue = (input: DraftInput) => input.mode === 'refresh'

export function enqueue(queue: ClaudeQueue, item: QueuedDraft): ClaudeQueue {
  if (queue.items.some((i) => i.panel === item.panel)) return queue
  return { ...queue, items: [...queue.items, item] }
}

export function removeQueued(queue: ClaudeQueue, panel: number): ClaudeQueue {
  const items = queue.items.filter((i) => i.panel !== panel)
  return { items, ...(items.length && queue.paused ? { paused: queue.paused } : {}) }
}

// 한 칸 앞(-1)이나 뒤(+1)로
export function moveQueued(queue: ClaudeQueue, panel: number, delta: -1 | 1): ClaudeQueue {
  const from = queue.items.findIndex((i) => i.panel === panel)
  const to = from + delta
  if (from < 0 || to < 0 || to >= queue.items.length) return queue
  const items = [...queue.items]
  ;[items[from], items[to]] = [items[to], items[from]]
  return { ...queue, items }
}

// 다음 항목을 꺼낸다. 멈췄거나 비었으면 없음
export function takeNext(queue: ClaudeQueue): { next?: QueuedDraft; queue: ClaudeQueue } {
  if (queue.paused || !queue.items.length) return { queue }
  const [next, ...items] = queue.items
  return { next, queue: { items } }
}

// 꺼낸 항목을 시작하지 못했으면 맨 앞에 되돌리고 멈춘다
export function pauseWith(queue: ClaudeQueue, reason: string, putBack?: QueuedDraft): ClaudeQueue {
  const items = putBack && !queue.items.some((i) => i.panel === putBack.panel) ? [putBack, ...queue.items] : queue.items
  return { items, paused: reason }
}

export const resumeQueue = (queue: ClaudeQueue): ClaudeQueue => ({ items: queue.items })

export const queuePosition = (queue: ClaudeQueue, panel: number) => queue.items.findIndex((i) => i.panel === panel)
