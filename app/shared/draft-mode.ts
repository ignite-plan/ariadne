// Claude 작업 종류별로 Confluence(기획서)가 필요한지. main(실행)과 renderer(점검 화면)가 같이 쓴다
import type { DraftInput, RefreshScope } from './api.ts'

// 장면 채우기는 매뉴얼 본문·시나리오·STG만 본다. 영상 초안은 연결된 매뉴얼 화면이 없을 때만 기획서를 찾는다
export function needsConfluence(input: Pick<DraftInput, 'mode' | 'targets'>) {
  if (input.mode === 'video-scene') return false
  if (input.mode === 'video') return !input.targets?.[0]
  return true
}

const TICKET = /^[A-Z][A-Z0-9]+-\d+$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// "GIDPGRO-973, gidpdvo-2067\nX-1" → 대문자 키 목록과 형식이 틀린 것
export function parseTickets(text: string) {
  const items = text
    .split(/[\s,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
  return { tickets: [...new Set(items.filter((t) => TICKET.test(t)))], invalid: items.filter((t) => !TICKET.test(t)) }
}

// 반영 범위가 실제로 있는지, 잘못된 곳이 있으면 이유
export function checkScope(scope?: RefreshScope): { scope?: RefreshScope; error?: string } {
  const from = scope?.from?.trim() || undefined
  const to = scope?.to?.trim() || undefined
  const tickets = scope?.tickets?.filter(Boolean) ?? []
  if (from && !MONTH.test(from)) return { error: `시작 월 형식이 틀립니다: ${from} (예: 2026-05)` }
  if (to && !MONTH.test(to)) return { error: `끝 월 형식이 틀립니다: ${to} (예: 2026-08)` }
  if (from && to && from > to) return { error: `시작 월(${from})이 끝 월(${to})보다 늦습니다` }
  const bad = tickets.filter((t) => !TICKET.test(t))
  if (bad.length) return { error: `Jira 티켓 형식이 틀립니다: ${bad.join(', ')} (예: GIDPGRO-973)` }
  if (!from && !to && !tickets.length) return {}
  return { scope: { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(tickets.length ? { tickets } : {}) } }
}

// 화면·로그에 보여 줄 범위 ("2026-05 ~ 2026-08 · GIDPGRO-973 외 1")
export function scopeLabel(scope?: RefreshScope) {
  if (!scope) return ''
  const period = scope.from || scope.to ? `${scope.from ?? '처음'} ~ ${scope.to ?? '최신'}` : ''
  const t = scope.tickets ?? []
  const tickets = t.length ? (t.length > 2 ? `${t.slice(0, 2).join(', ')} 외 ${t.length - 2}` : t.join(', ')) : ''
  return [period, tickets].filter(Boolean).join(' · ')
}

export type DraftMode = NonNullable<DraftInput['mode']>

export const draftMode = (input: Pick<DraftInput, 'mode'>): DraftMode => input.mode ?? 'create'

// 작업 종류별 화면 문구. sceneNo는 장면 채우기의 대상 장면 번호(1부터)
export interface DraftModeText {
  // 상단 작업 표시·토스트
  chip: string
  // 패널 제목
  title: string
  // 작업이 끝났을 때 macOS 알림
  notify: string
  about: (sceneNo: number) => string
  start: string
  startIcon: 'sparkle' | 'flag'
  ready: (sceneNo: number) => string
  duration: string
  // 결과 카드 제목. changed: 고친(만든) 화면 수
  done: (changed: number) => string
  failed: string
  // 입력 정보의 첫 줄 이름
  subject: string
}

export const DRAFT_MODES: Record<DraftMode, DraftModeText> = {
  create: {
    chip: '초안',
    title: 'Claude로 초안 만들기',
    notify: 'Claude 초안 만들기',
    about: () => 'Confluence 기획서와 STG 화면을 근거로 영어 초안을 씁니다. 근거가 없는 내용은 TODO로 남깁니다.',
    start: '초안 만들기 시작',
    startIcon: 'flag',
    ready: () => '[초안 만들기 시작]을 누르면 Claude가 기획서를 찾고 STG 화면을 확인하며 초안을 씁니다.',
    duration: '초안 하나에 수 분에서 10분 이상',
    done: () => '초안을 만들었습니다',
    failed: '초안을 끝까지 만들지 못했습니다',
    subject: '메뉴',
  },
  refresh: {
    chip: '최신화',
    title: 'Claude로 최신화',
    notify: 'Claude 최신화',
    about: () =>
      '최신 Confluence 기획서를 한 번 요약한 뒤, 화면마다 STG 화면과 지금 본문을 비교해 바뀐 곳만 고칩니다(3개씩 동시에). 근거가 다르면 TODO로 남깁니다.',
    start: '최신화 시작',
    startIcon: 'sparkle',
    ready: () => '[최신화 시작]을 누르면 Claude가 최신 기획서를 요약하고, 지난 최신화 이후 기획서가 바뀐 화면만 STG 화면과 비교해 고칩니다.',
    duration: '처음에는 15~25분쯤, 기획서가 그대로면 건너뛰어 몇 분',
    done: (changed) => (changed ? '최신화했습니다' : '바꿀 곳이 없었습니다'),
    failed: '최신화를 끝까지 하지 못했습니다',
    subject: '장',
  },
  video: {
    chip: '영상 초안',
    title: 'Claude로 영상 초안',
    notify: 'Claude 영상 시나리오 초안',
    about: () => '연결된 매뉴얼 화면의 문장으로 내레이션을 쓰고, STG 화면을 확인해 단계를 만든 뒤 실제로 실행해 봅니다.',
    start: '영상 초안 시작',
    startIcon: 'sparkle',
    ready: () => '[영상 초안 시작]을 누르면 Claude가 매뉴얼 본문으로 장면을 나누고, STG에서 단계를 찾아 시나리오를 쓴 뒤 끝까지 실행해 봅니다.',
    duration: '영상 하나에 수 분',
    done: () => '영상 시나리오 초안을 만들었습니다',
    failed: '초안을 끝까지 만들지 못했습니다',
    subject: '영상',
  },
  // 장면 하나 채우기는 영상 초안과 같은 화면에 문구만 다르다
  'video-scene': {
    chip: '장면 채우기',
    title: 'Claude로 장면 채우기',
    notify: 'Claude 영상 장면 채우기',
    about: (n) => `요청대로 STG 화면을 보고 장면 ${n}의 영어 내레이션과 단계를 씁니다. 다른 장면은 건드리지 않습니다.`,
    start: '장면 채우기 시작',
    startIcon: 'sparkle',
    ready: (n) =>
      `[장면 채우기 시작]을 누르면 Claude가 장면 ${n}이 시작되는 화면까지 앞 장면을 재생하고, 요청대로 STG를 살펴본 뒤 그 장면만 써서 실행해 봅니다.`,
    duration: '장면 하나에 몇 분',
    done: () => '장면을 채웠습니다',
    failed: '초안을 끝까지 만들지 못했습니다',
    subject: '영상',
  },
}

// 칩·토스트에 쓰는 작업 이름
export const draftLabel = (input: Pick<DraftInput, 'mode'>) => DRAFT_MODES[draftMode(input)].chip

// 영상 시나리오를 쓰는 작업인지 (장면 채우기 포함)
export const isVideoDraft = (input: Pick<DraftInput, 'mode'>) => input.mode === 'video' || input.mode === 'video-scene'
