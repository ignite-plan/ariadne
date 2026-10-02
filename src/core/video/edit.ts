// 기록한 단계를 시나리오에 붙이는 규칙. 앱 renderer도 쓰므로 playwright를 import하지 않는다
import type { Scene, Step, VideoFile } from './scenario.ts'

export type CaptionSize = NonNullable<VideoFile['captionSize']>
export type Pace = NonNullable<VideoFile['pace']>

// 자막 글자 배율 (보통 = 1920 화면에서 약 31px)
export const CAPTION_SCALE: Record<CaptionSize, number> = { small: 0.85, medium: 1, large: 1.22 }
// 조작 대기 배율. 클수록 느리다
export const PACE_FACTOR: Record<Pace, number> = { slow: 1.4, normal: 1, fast: 0.7 }
export const SPEED_CHOICES = [0.8, 0.9, 1, 1.1, 1.2, 1.3]

export interface VideoStyle {
  captionSize: CaptionSize
  speed: number
  pace: Pace
}

// 시나리오 값 → 매뉴얼 기본값(manual.yaml video) → 기본값 순서로 정한다
export function videoStyle(
  scenario: Pick<VideoFile, 'captionSize' | 'speed' | 'pace'>,
  defaults: { captionSize?: CaptionSize; tts?: { speed?: number } } = {},
): VideoStyle {
  return {
    captionSize: scenario.captionSize ?? defaults.captionSize ?? 'medium',
    speed: scenario.speed ?? defaults.tts?.speed ?? 1,
    pace: scenario.pace ?? 'normal',
  }
}

// 내레이션(또는 화면 자막)이나 단계가 하나라도 있는 장면
export function sceneHasContent(scene: Scene) {
  return Boolean(scene.say?.trim() || scene.caption?.trim() || scene.steps.length)
}

// 기록한 단계를 붙인다. 선택 상자 클릭 + 항목 클릭은 '선택'으로, 같은 칸에 다시 입력하면 마지막 값으로 합친다
export function appendRecorded(steps: Step[], step: Step): Step[] {
  const last = steps.at(-1)
  if (last && 'click' in last && last.click.role === 'combobox' && 'click' in step && step.click.role === 'option' && step.click.name) {
    return [...steps.slice(0, -1), { choose: { target: last.click, option: step.click.name } }]
  }
  if (last && 'type' in last && 'type' in step && JSON.stringify(last.type.target) === JSON.stringify(step.type.target)) {
    return [...steps.slice(0, -1), step]
  }
  return [...steps, step]
}
