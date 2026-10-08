// 화면에 보이는 시간·상태 문구. main과 renderer가 같이 쓴다 (node·DOM에 의존하지 않는다)
import type { ChangeStatus } from './api.ts'

// 경과 시간: 5분 전, 3시간 전, 3일 전
export function formatAge(ms: number) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}시간 전`
  return `${Math.round(hours / 24)}일 전`
}

// 걸린 시간: 42초, 7분
export const formatDuration = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}초` : `${Math.round(ms / 60000)}분`)

// 시계 표기: 1:05
export function formatClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const CHANGE_STATUS_LABEL: Record<ChangeStatus, string> = { added: '추가', modified: '수정', deleted: '삭제' }
