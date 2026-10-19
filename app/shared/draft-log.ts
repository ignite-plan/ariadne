// Claude 작업 진행 기록: main이 보낸 이벤트를 화면의 로그 줄·화면별 진행으로 바꾼다 (renderer가 쓰는 순수 함수, 단위 테스트 대상)
import type { DraftEvent, DraftInput, DraftResult, RefreshScope, ScreenStatus } from './api.ts'

export interface LogLine {
  id: string
  kind: 'status' | 'warning' | 'tool' | 'text'
  text: string
  done?: boolean
  failed?: boolean
  // 최신화: 어느 화면 작업의 줄인지
  target?: string
}

// 최신화 화면 하나의 진행
export interface ScreenRow {
  status: ScreenStatus
  text?: string
}

export const SCREEN_LABEL: Record<ScreenStatus, string> = {
  waiting: '대기',
  running: '진행 중',
  done: '고침',
  unchanged: '바꿀 것 없음',
  skipped: '건너뜀',
  failed: '실패',
  cancelled: '취소',
}

// 캡처 정의 작업은 본문을 고치지 않으므로 다르게 부른다
export const screenLabel = (status: ScreenStatus, mode?: DraftInput['mode']) =>
  mode === 'shots' && status === 'done' ? '정의함' : mode === 'shots' && status === 'unchanged' ? '더할 것 없음' : SCREEN_LABEL[status]

// 화면 경로에서 파일 이름만 (08-menu-management/02-menu-creation.md → 02-menu-creation)
export const screenName = (target: string) => target.split('/').pop()!.replace(/\.md$/, '')

let lineSeq = 0
const nextId = () => `line-${++lineSeq}`

export function applyDraftEvent(lines: LogLine[], event: DraftEvent, mode?: DraftInput['mode']): LogLine[] {
  const id = nextId()
  if (event.kind === 'status') return [...lines, { id, kind: 'status', text: event.text, target: event.target }]
  if (event.kind === 'warning') return [...lines, { id, kind: 'warning', text: event.text, target: event.target }]
  if (event.kind === 'phase') return [...lines, { id, kind: 'status', text: event.text }]
  if (event.kind === 'ask') return [...lines, { id, kind: 'warning', text: event.text }]
  if (event.kind === 'answered') return [...lines, { id, kind: 'status', text: event.proceed ? '요약 없이 계속합니다' : '중지합니다' }]
  if (event.kind === 'screen') {
    // 대기는 줄을 남기지 않는다 (화면 목록에 보인다)
    if (event.status === 'waiting') return lines
    const text = `${screenLabel(event.status, mode)}${event.text ? ` — ${event.text}` : ''}`
    return [...lines, { id, kind: event.status === 'failed' ? 'warning' : 'status', text, target: event.target }]
  }
  const { target } = event
  const e = event.event
  if (e.kind === 'tool') return [...lines, { id: e.id, kind: 'tool', text: e.label, target }]
  if (e.kind === 'tool_result') {
    return lines.map((l) => (l.id === e.id ? { ...l, done: true, failed: e.isError, text: e.isError ? `${l.text} — ${e.text}` : l.text } : l))
  }
  if (e.kind === 'text') {
    // 마지막 요약(JSON)은 결과 카드로 보여 준다
    const text = e.text.replace(/```json[\s\S]*?```/g, '').trim()
    return text ? [...lines, { id, kind: 'text', text, target }] : lines
  }
  if (e.kind === 'init' && e.mcp.some((m) => m.status !== 'connected')) {
    const failed = e.mcp.filter((m) => m.status !== 'connected').map((m) => m.name)
    return [...lines, { id, kind: 'status', text: `연결 안 된 MCP: ${failed.join(', ')}`, target }]
  }
  return lines
}

export interface ClaudeTask {
  input: DraftInput
  // 이 작업을 시작한 패널 번호 (패널을 다시 열 때 같은 번호로 연다)
  panel: number
  phase: 'running' | 'done'
  log: LogLine[]
  // 최신화: 반영 범위 (기간·티켓)
  scope?: RefreshScope
  // 기획자 답을 기다리는 질문 (요약 실패 시 계속할지)
  ask?: { id: string; text: string }
  // 최신화: 화면별 진행과 지금 단계(기획서 요약 / 화면 확인)
  screens: Record<string, ScreenRow>
  stage?: string
  result?: DraftResult
  error: string
  startedAt: number
  endedAt?: number
  // 작업 번호. 끝난 작업을 화면마다 한 번만 처리하게 쓴다
  seq: number
}

export function applyTaskEvent(task: ClaudeTask, event: DraftEvent): ClaudeTask {
  const next = { ...task, log: applyDraftEvent(task.log, event, task.input.mode) }
  if (event.kind === 'screen') next.screens = { ...task.screens, [event.target]: { status: event.status, text: event.text } }
  if (event.kind === 'phase') next.stage = event.text
  if (event.kind === 'ask') next.ask = { id: event.id, text: event.text }
  if (event.kind === 'answered') next.ask = undefined
  return next
}

// 최신화 진행: 끝난 화면 수 / 전체
export function screenProgress(task: Pick<ClaudeTask, 'screens'>) {
  const rows = Object.values(task.screens)
  return { total: rows.length, finished: rows.filter((r) => r.status !== 'waiting' && r.status !== 'running').length }
}

// Claude가 고치고 있는 매뉴얼 화면인지 (그동안 편집을 막는다)
export function isDraftTarget(input: DraftInput, path: string) {
  if (input.mode === 'refresh') return Boolean(input.targets?.includes(path))
  if (input.mode === 'create') return Boolean(input.chapterDir && path.startsWith(`${input.chapterDir}/`))
  return false
}
