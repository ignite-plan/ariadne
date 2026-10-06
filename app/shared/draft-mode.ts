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
