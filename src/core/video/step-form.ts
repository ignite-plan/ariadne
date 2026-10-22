// 앱 장면 편집기의 단계·대상 입력 규칙. renderer도 쓰므로 node·playwright를 import하지 않는다
import type { Step, Target } from './scenario.ts'

export type StepKind = 'open' | 'waitFor' | 'click' | 'type' | 'choose' | 'select' | 'highlight' | 'hover' | 'scroll' | 'upload' | 'pause'

export const STEP_KINDS: { kind: StepKind; label: string }[] = [
  { kind: 'open', label: '화면 열기' },
  { kind: 'waitFor', label: '보일 때까지 기다리기' },
  { kind: 'click', label: '클릭' },
  { kind: 'type', label: '입력' },
  { kind: 'choose', label: '선택 상자에서 고르기' },
  { kind: 'highlight', label: '강조 (누르지 않음)' },
  { kind: 'hover', label: '마우스 올리기' },
  { kind: 'scroll', label: '스크롤' },
  { kind: 'upload', label: '파일 올리기 (STG 저장 허용만)' },
  { kind: 'pause', label: '잠깐 멈춤' },
  { kind: 'select', label: '목록 상자에서 고르기 (기본 select)' },
]

export function kindOf(step?: Step): StepKind {
  return step ? (Object.keys(step)[0] as StepKind) : 'click'
}

// 단계가 누르거나 기다리는 요소 (화면 열기·멈춤은 없음)
export function targetOf(step?: Step): Target | undefined {
  if (!step) return undefined
  if ('waitFor' in step) return step.waitFor
  if ('click' in step) return step.click
  if ('hover' in step) return step.hover
  if ('scroll' in step) return step.scroll
  if ('type' in step) return step.type.target
  if ('choose' in step) return step.choose.target
  if ('select' in step) return step.select.target
  if ('highlight' in step) return step.highlight.target
  if ('upload' in step) return step.upload.target
  return undefined
}

// 편집 칸의 값: 화면 주소, 입력·고를 글자, 시간(초)
export interface StepFields {
  path: string
  text: string
  seconds: number
}

export function stepFields(step?: Step): StepFields {
  return {
    path: step && 'open' in step ? step.open : '/',
    text:
      step && 'type' in step
        ? step.type.text
        : step && 'choose' in step
          ? step.choose.option
          : step && 'select' in step
            ? step.select.value
            : step && 'upload' in step
              ? step.upload.file
              : '',
    seconds: step && 'pause' in step ? step.pause / 1000 : step && 'highlight' in step && step.highlight.ms ? step.highlight.ms / 1000 : 1.5,
  }
}

export const needsTarget = (kind: StepKind) => kind !== 'open' && kind !== 'pause'

export function stepValid(kind: StepKind, target: Target, { path, text, seconds }: StepFields) {
  return (
    (kind === 'open' ? path.trim().length > 0 : true) &&
    (needsTarget(kind) ? targetValid(target) : true) &&
    (kind === 'choose' || kind === 'select' || kind === 'upload' ? text.trim().length > 0 : true) &&
    (kind === 'pause' || kind === 'highlight' ? seconds > 0 : true)
  )
}

export function buildStep(kind: StepKind, target: Target, { path, text, seconds }: StepFields): Step {
  const t = cleanTarget(target)
  const ms = Math.round(seconds * 1000)
  switch (kind) {
    case 'open':
      return { open: path.trim() }
    case 'pause':
      return { pause: ms }
    case 'waitFor':
      return { waitFor: t }
    case 'click':
      return { click: t }
    case 'hover':
      return { hover: t }
    case 'scroll':
      return { scroll: t }
    case 'type':
      return { type: { target: t, text } }
    case 'choose':
      return { choose: { target: t, option: text.trim() } }
    case 'select':
      return { select: { target: t, value: text.trim() } }
    case 'highlight':
      return { highlight: { target: t, ms } }
    case 'upload':
      return { upload: { target: t, file: text.trim() } }
  }
}

export type TargetBy = 'role' | 'text' | 'label' | 'placeholder'

export const TARGET_BY: { by: TargetBy; label: string }[] = [
  { by: 'role', label: '종류와 이름 (버튼, 링크, 탭 …)' },
  { by: 'text', label: '화면 글자' },
  { by: 'label', label: '입력칸 이름 (label)' },
  { by: 'placeholder', label: '입력칸 안내 문구 (placeholder)' },
]

export function byOf(target: Target): TargetBy {
  return target.role ? 'role' : target.label ? 'label' : target.placeholder ? 'placeholder' : 'text'
}

export function targetValid(target: Target): boolean {
  const by = byOf(target)
  const own = by === 'role' ? Boolean(target.role) : Boolean(target[by]?.trim())
  return own && (!target.within || targetValid(target.within))
}

// 빈 값과 기본값을 지워 YAML을 짧게 한다
export function cleanTarget(target: Target): Target {
  const t: Target = {}
  const by = byOf(target)
  if (by === 'role') {
    t.role = target.role
    if (target.name?.trim()) t.name = target.name.trim()
  } else t[by] = target[by]!.trim()
  if (target.nth) t.nth = target.nth
  if (target.exact) t.exact = true
  if (target.within && targetValid(target.within)) t.within = cleanTarget(target.within)
  return t
}
