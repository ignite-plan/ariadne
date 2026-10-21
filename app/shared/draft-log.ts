// Claude 작업 진행 기록: main이 보낸 이벤트를 화면의 로그 줄·화면별 진행으로 바꾼다 (renderer가 쓰는 순수 함수, 단위 테스트 대상)
import type { DraftEvent, DraftInput, DraftResult, RefreshScope, ScreenStatus } from './api.ts'
import { draftLabel } from './draft-mode.ts'
import { formatDuration } from './format.ts'

export interface LogLine {
  id: string
  kind: 'status' | 'warning' | 'tool' | 'text'
  text: string
  done?: boolean
  failed?: boolean
  // 최신화: 어느 화면 작업의 줄인지
  target?: string
  // 도구 입력(줄인 것)과 결과. 화면에는 안 보이고 로그 저장에 들어간다
  input?: string
  output?: string
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
  if (e.kind === 'tool') return [...lines, { id: e.id, kind: 'tool', text: e.label, target, input: e.key }]
  if (e.kind === 'tool_result') {
    return lines.map((l) =>
      l.id === e.id ? { ...l, done: true, failed: e.isError, text: e.isError ? `${l.text} — ${e.text}` : l.text, output: e.text } : l,
    )
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

// 로그 저장: 작업 정보, 진행 줄(화면에 안 보이는 도구 입력·결과 포함), 마지막 응답을 Markdown 글로
export function taskLogText(task: ClaudeTask, appVersion?: string) {
  const { input } = task
  const stamp = (ms: number) => new Date(ms).toLocaleString('sv-SE')
  const indent = (text: string) => text.trim().replace(/\n/g, '\n    ')
  const info: [string, string | undefined][] = [
    ['작업', `Claude ${draftLabel(input)}`],
    ['메뉴', input.menu],
    ['영상', input.video],
    ['장면', input.scene === undefined ? undefined : input.insert ? `장면 ${input.scene + 1} 다음에 새 장면` : `장면 ${input.scene + 1}`],
    ['대상', input.targets?.join(', ')],
    ['STG 경로', input.path],
    ['시작', stamp(task.startedAt)],
    ['끝', task.endedAt ? `${stamp(task.endedAt)} (${formatDuration(task.endedAt - task.startedAt)})` : '진행 중'],
    ['앱 버전', appVersion],
  ]
  const lines = [`# Claude ${draftLabel(input)} 로그`, '', ...info.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`)]
  if (input.notes?.trim()) lines.push('', '## 요청', '', input.notes.trim())
  lines.push('', '## 진행', '')
  for (const line of task.log) {
    const tag =
      line.kind === 'tool' ? (line.failed ? '도구 실패' : line.done ? '도구' : '도구 진행 중') : line.kind === 'text' ? 'Claude' : line.kind === 'warning' ? '경고' : '상태'
    lines.push(`- [${tag}]${line.target ? ` (${line.target})` : ''} ${indent(line.text)}`)
    if (line.input) lines.push(`  - 입력: ${indent(line.input)}`)
    if (line.output && !line.failed) lines.push(`  - 결과: ${indent(line.output)}`)
  }
  const result = task.result
  if (task.error || result) {
    lines.push('', '## 결과', '')
    if (task.error) lines.push(`- 오류: ${indent(task.error)}`)
    if (result) {
      lines.push(`- 성공: ${result.ok ? '예' : '아니오'}`)
      if (result.costUsd !== undefined) lines.push(`- 비용: $${result.costUsd.toFixed(2)}`)
      if (result.denials.length) lines.push(`- 막힌 도구: ${result.denials.join('; ')}`)
      if (result.text.trim()) lines.push('', '### 마지막 응답', '', result.text.trim())
    }
  }
  return `${lines.join('\n')}\n`
}
