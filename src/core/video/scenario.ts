// 가이드 영상 시나리오. manuals/<m>/videos/<id>.yaml에 데이터로 둔다.
// 기획자가 앱에서 쓰고, 앱·CLI는 임의 코드 없이 정해진 단계만 실행한다
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'
import { manualDir, type ManualRef } from '../manual.ts'

// 화면 요소 찾기. role + name(접근성 이름)을 먼저 쓰고, 없으면 label/placeholder/text
export interface Target {
  role?: string
  name?: string
  text?: string
  label?: string
  placeholder?: string
  // 같은 조건이 여러 개일 때 몇 번째 (0부터). 없으면 첫 번째
  nth?: number
  exact?: boolean
  // 이 요소 안에서 찾는다 (예: 특정 행의 Delete 버튼)
  within?: Target
}

const target: z.ZodType<Target> = z.lazy(() =>
  z
    .strictObject({
      role: z.string().min(1).optional(),
      name: z.string().optional(),
      text: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      placeholder: z.string().min(1).optional(),
      nth: z.number().int().min(0).optional(),
      exact: z.boolean().optional(),
      within: target.optional(),
    })
    .refine((t) => t.role || t.text || t.label || t.placeholder, '요소를 찾을 조건(role, text, label, placeholder 중 하나)이 필요합니다'),
)

const step = z.union([
  z.strictObject({ open: z.string().min(1) }),
  z.strictObject({ waitFor: target }),
  z.strictObject({ click: target }),
  z.strictObject({ hover: target }),
  z.strictObject({ scroll: target }),
  z.strictObject({ type: z.strictObject({ target, text: z.string() }) }),
  z.strictObject({ choose: z.strictObject({ target, option: z.string().min(1) }) }),
  z.strictObject({ select: z.strictObject({ target, value: z.string() }) }),
  z.strictObject({ highlight: z.strictObject({ target, ms: z.number().int().positive().optional() }) }),
  z.strictObject({ pause: z.number().int().positive() }),
])

const scene = z.strictObject({
  // 자막과 내레이션 공용 문장. 없으면 조작만 하는 장면
  say: z.string().optional(),
  // 화면 자막만 다르게 쓸 때 (say는 내레이션으로만 쓴다)
  caption: z.string().optional(),
  // 내레이션과 동시에 진행하는 조작
  steps: z.array(step).default([]),
})

export const videoFileSchema = z.strictObject({
  // 시작 카드 제목
  title: z.string().min(1),
  // 시작 카드 내레이션. 없으면 카드만 잠깐 보여 준다
  intro: z.string().optional(),
  // 문장 출처인 매뉴얼 섹션 (manuals/<m>/ 기준, 예: 02-dealer-management/01-dealer-list-view.md)
  section: z.string().optional(),
  // true일 때만 저장/삭제/발송/승인 버튼과 쓰기 요청을 허용한다. STG 테스트 데이터로만 쓴다
  mutates: z.boolean().optional(),
  // 이메일·전화번호처럼 보이는 글자를 자동으로 blur
  maskPersonal: z.boolean().optional(),
  // 자막 크기. 없으면 manual.yaml video.captionSize, 그것도 없으면 medium
  captionSize: z.enum(['small', 'medium', 'large']).optional(),
  // 내레이션 속도 (0.8~1.3). 없으면 manual.yaml video.tts.speed, 그것도 없으면 1
  speed: z.number().min(0.8).max(1.3).optional(),
  // 조작 속도 (커서 이동, 입력, 강조, 장면 사이 쉬는 시간)
  pace: z.enum(['slow', 'normal', 'fast']).optional(),
  // 추가로 가릴 요소
  mask: z.array(target).optional(),
  scenes: z.array(scene),
  // 녹화가 끝난 뒤 실행. 만든 테스트 데이터 정리 (영상에 안 들어감)
  cleanup: z.array(step).optional(),
})

export type Step = z.infer<typeof step>
export type Scene = z.infer<typeof scene>
export type VideoFile = z.infer<typeof videoFileSchema>
// id는 파일 이름이다
export type VideoScenario = VideoFile & { id: string }

export const VIDEO_ID = /^[a-z0-9][a-z0-9-]*$/

export function videosDir(ref: ManualRef) {
  return join(manualDir(ref), 'videos')
}

function videoFile(ref: ManualRef, id: string) {
  if (!VIDEO_ID.test(id)) throw new Error(`영상 id는 영문 소문자, 숫자, -만 쓸 수 있습니다: ${id}`)
  return join(videosDir(ref), `${id}.yaml`)
}

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || '(전체)'}: ${issue.message}`).join('\n')
}

export function parseVideo(id: string, data: unknown): VideoScenario {
  const result = videoFileSchema.safeParse(data)
  if (!result.success) throw new Error(`시나리오 ${id} 형식 오류\n${formatIssues(result.error)}`)
  return { id, ...result.data }
}

export function listVideos(ref: ManualRef) {
  const dir = videosDir(ref)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort()
}

export function loadVideo(ref: ManualRef, id: string) {
  const file = videoFile(ref, id)
  if (!existsSync(file)) throw new Error(`시나리오 없음: ${file}`)
  return parseVideo(id, YAML.parse(readFileSync(file, 'utf8')))
}

// 앱과 CLI가 같은 diff를 내도록 YAML.stringify로만 쓴다 (saveManual과 같음)
export function saveVideo(ref: ManualRef, { id, ...data }: VideoScenario) {
  const parsed = parseVideo(id, data)
  mkdirSync(videosDir(ref), { recursive: true })
  const { id: _, ...file } = parsed
  writeFileSync(videoFile(ref, id), YAML.stringify(file))
  return parsed
}

export function deleteVideo(ref: ManualRef, id: string) {
  rmSync(videoFile(ref, id), { force: true })
}

// 실행 시각 MMDDHHmm. 테스트 데이터 이름이 겹치지 않게 {stamp}로 쓴다
export function videoVars(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return { stamp: `${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}` }
}

// 시나리오 안 모든 문자열의 {name}을 바꾼다. 모르는 변수는 그대로 둔다
export function applyVars<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m) as T
  if (Array.isArray(value)) return value.map((v) => applyVars(v, vars)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applyVars(v, vars)])) as T
  }
  return value
}
