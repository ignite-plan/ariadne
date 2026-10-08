// 오래 걸리는 작업이 끝났을 때 띄울 알림 문구와, 띄울지 여부. Electron에 의존하지 않는다 (단위 테스트 대상)
import { basename } from 'node:path'
import type { Channel } from '../../shared/api.ts'

// background: 다른 앱을 보고 있을 때만 (기본), always: 항상, off: 끄기
export type NotifyMode = 'background' | 'always' | 'off'

// 이보다 짧게 끝난 작업은 알리지 않는다 (금방 끝나는 Word 만들기 등)
export const MIN_DURATION_MS = 5000

export interface TaskNotice {
  title: string
  body: string
  ok: boolean
}

export function shouldNotify({ mode, focused, durationMs }: { mode: NotifyMode; focused: boolean; durationMs: number }) {
  if (mode === 'off' || durationMs < MIN_DURATION_MS) return false
  return mode === 'always' || !focused
}

const firstLine = (text: string, max = 120) => {
  const line = text.trim().split('\n')[0].replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

const DRAFT_LABEL: Record<string, string> = {
  create: 'Claude 초안 만들기',
  refresh: 'Claude 최신화',
  video: 'Claude 영상 시나리오 초안',
  'video-scene': 'Claude 영상 장면 채우기',
}

// 채널별 작업 이름. 여기에 없는 채널은 알리지 않는다
const TASK_LABEL: Partial<Record<Channel, string>> = {
  'workspace:clone': '매뉴얼 내려받기',
  'workspace:submit': '제출',
  'manual:importDocx': '새 매뉴얼 가져오기',
  'build:docx': 'Word 만들기',
  'capture:run': '화면 캡처',
  'video:downloadModel': '음성 모델 내려받기',
}

type AnyRecord = Record<string, any>

export function taskLabel(channel: string, args: unknown[]) {
  if (channel === 'draft:start') return DRAFT_LABEL[(args[0] as AnyRecord)?.mode ?? 'create'] ?? DRAFT_LABEL.create
  if (channel === 'video:run') return (args[1] as AnyRecord)?.preview ? '영상 실행해 보기' : '가이드 영상 만들기'
  return TASK_LABEL[channel as Channel]
}

// 끝난 작업 → 알림 문구. 알릴 작업이 아니면 undefined
export function describeTask(channel: string, args: unknown[], result: unknown, error?: unknown): TaskNotice | undefined {
  const label = taskLabel(channel, args)
  if (!label) return undefined
  if (error !== undefined) {
    return { ok: false, title: `${label} 실패`, body: firstLine(error instanceof Error ? error.message : String(error)) }
  }
  const r = (result ?? {}) as AnyRecord
  switch (channel) {
    case 'draft:start': {
      const menu = (args[0] as AnyRecord)?.menu ?? ''
      if (!r.ok) return { ok: false, title: `${label} 실패`, body: firstLine(String(r.text ?? '')) }
      const s = r.summary as AnyRecord | undefined
      const mode = (args[0] as AnyRecord)?.mode
      const parts = [menu]
      if (s && (mode === 'create' || mode === 'refresh' || !mode)) {
        if (mode === 'refresh' && !s.sections?.length) parts.push('바꿀 곳이 없었습니다')
        else parts.push(`화면 ${s.sections?.length ?? 0}개 ${mode === 'refresh' ? '고침' : '만듦'}`)
        if (s.todos) parts.push(`TODO ${s.todos}`)
      }
      return { ok: true, title: `${label} 완료`, body: `${parts.filter(Boolean).join(' · ')} — 검토 후 제출하세요` }
    }
    case 'video:run':
      if (!r.ok) return { ok: false, title: `${label} 실패`, body: firstLine(String(r.error ?? '')) }
      return {
        ok: true,
        title: `${label} 완료`,
        body: r.mp4 ? `${basename(String(r.mp4))} · ${Math.round(Number(r.durationMs ?? 0) / 1000)}초` : '끝까지 실행했습니다',
      }
    case 'capture:run': {
      const changed = r.changed?.length ?? 0
      const failed = r.failed?.length ?? 0
      return {
        ok: failed === 0,
        title: `${label} 완료`,
        body: `바뀜 ${changed} · 그대로 ${r.unchanged?.length ?? 0}${failed ? ` · 실패 ${failed}` : ''}${changed ? ' — 반영할 이미지를 고르세요' : ''}`,
      }
    }
    case 'workspace:submit':
      return {
        ok: true,
        title: `${label} 완료`,
        body: r.mode === 'pr' ? (r.conflict ? '다른 변경과 겹쳐 PR로 올렸습니다' : 'PR을 만들었습니다') : '매뉴얼 원본에 반영했습니다',
      }
    case 'manual:importDocx':
      return { ok: true, title: `${label} 완료`, body: `${String(result ?? '')} 매뉴얼을 만들었습니다 — 확인 후 제출하세요` }
    case 'build:docx':
      return { ok: true, title: `${label} 완료`, body: basename(String(r.docx ?? '')) }
    default:
      return { ok: true, title: `${label} 완료`, body: '' }
  }
}
