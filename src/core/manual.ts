// manual.yaml과 섹션 Markdown을 읽는 공통 함수. CLI와 앱이 같이 쓴다
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import YAML from 'yaml'
import type { TtsConfig } from './video/tts/index.ts'

// 리포 루트와 매뉴얼 이름(manuals/<manual>). process.cwd()에 기대지 않도록 모든 core 함수가 받는다
export interface ManualRef {
  root: string
  manual: string
}

export interface Chapter {
  title: string
  dir: string
  sections: string[]
}

export interface Viewport {
  width: number
  height: number
}

export interface Manual {
  title: string
  version: string
  // Word 파일 이름(확장자 제외). {version}을 버전으로 바꾼다
  output?: string
  // 캡처 대상 (STG). 매뉴얼마다 사이트가 다르다
  capture?: { baseUrl?: string; viewport?: Viewport }
  // affected가 볼 dealerhub-web 앱
  code?: { app?: string; locale?: string }
  // 가이드 영상 (pnpm video). viewport는 녹화 화면 크기 (없으면 1920x1080, 캡처 크기와 따로).
  // mask는 모든 영상에서 흐리게 할 CSS 선택자 (예: 헤더의 로그인 사용자 이름)
  // captionSize는 자막 크기 기본값 (시나리오가 바꿀 수 있다)
  video?: { tts?: TtsConfig; viewport?: Viewport; mask?: string[]; captionSize?: 'small' | 'medium' | 'large' }
  chapters: Chapter[]
}

export const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 }

export function outputName(manual: Manual) {
  return (manual.output ?? `${manual.title}_v{version}`).replaceAll('{version}', manual.version)
}

// code.app만 있으면 en.json 위치를 정해진 규칙으로 찾는다
export function localePath(manual: Manual) {
  return manual.code?.locale ?? (manual.code?.app ? `${manual.code.app}/src/locales/en.json` : undefined)
}

// 섹션 front-matter. dealerhub-web 코드와의 연결 키
// 최신화할 때 근거로 본 Confluence 기획서와 버전. 버전이 같으면 다음 최신화에서 건너뛴다
export interface SpecRef {
  page: string
  version: number
}

export interface SectionMeta {
  title?: string
  routes?: string[]
  sources?: string[]
  i18nPrefix?: string[]
  refreshedFrom?: SpecRef[]
}

export function manualDir({ root, manual }: ManualRef) {
  return resolve(root, 'manuals', manual)
}

export function loadManual(ref: ManualRef): Manual {
  return YAML.parse(readFileSync(join(manualDir(ref), 'manual.yaml'), 'utf8'))
}

// manual.yaml은 YAML.stringify 형식으로만 쓴다 (앱과 CLI가 같은 diff를 내도록)
export function saveManual(ref: ManualRef, manual: Manual) {
  writeFileSync(join(manualDir(ref), 'manual.yaml'), YAML.stringify(manual))
}

export type ManualSettings = Omit<Manual, 'chapters'>

const OPTIONAL_KEYS = ['output', 'capture', 'code', 'video'] as const

// 설정을 바꾼 manual.yaml. 키 순서를 지켜 불필요한 diff를 줄인다.
// patch에 있는 키는 바꾸고(빈 값이면 지운다), 없는 키(설정 화면에 없는 video 등)는 그대로 둔다
export function mergeManual(current: Manual, patch: Partial<ManualSettings>): Manual {
  const optional: Partial<ManualSettings> = {}
  for (const key of OPTIONAL_KEYS) {
    const value = key in patch ? patch[key] : current[key]
    const empty = value === undefined || value === '' || (typeof value === 'object' && !Object.keys(value).length)
    if (!empty) Object.assign(optional, { [key]: value })
  }
  return {
    title: patch.title ?? current.title,
    version: patch.version ?? current.version,
    ...optional,
    chapters: current.chapters,
  }
}

export function readSection(ref: ManualRef, chapter: Chapter, file: string) {
  return readFileSync(join(manualDir(ref), chapter.dir, file), 'utf8')
}

// 장 번호는 디렉토리 prefix(02-)
export function chapterNo(chapter: Chapter) {
  return Number.parseInt(chapter.dir, 10)
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/

export function parseFrontMatter(md: string): SectionMeta {
  return YAML.parse(md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '{}') ?? {}
}

export function stripFrontMatter(md: string) {
  return md.replace(FRONT_MATTER, '')
}

export function splitSection(raw: string) {
  const frontMatter = raw.match(FRONT_MATTER)?.[0] ?? ''
  // front-matter 뒤 빈 줄 하나는 형식이라 본문에서 뺀다
  const body = raw.slice(frontMatter.length).replace(/^\n/, '')
  return { frontMatter, body }
}

// 키 순서를 정해 쓴다 (앱과 CLI가 같은 diff를 내도록)
export function serializeFrontMatter(meta: SectionMeta) {
  const ordered: SectionMeta = {
    title: meta.title ?? '',
    routes: meta.routes ?? [],
    sources: meta.sources ?? [],
    i18nPrefix: meta.i18nPrefix ?? [],
    ...(meta.refreshedFrom?.length ? { refreshedFrom: meta.refreshedFrom } : {}),
  }
  return `---\n${YAML.stringify(ordered).trim()}\n---\n`
}

export function joinSection(frontMatter: string, body: string) {
  const text = body.replace(/\s+$/, '')
  return `${frontMatter}${frontMatter ? '\n' : ''}${text}\n`
}

// 본문이 참조하는 shot id (images/<id>.png)
export function sectionImages(md: string) {
  return [...md.matchAll(/\]\(images\/([^)]+)\.png\)/g)].map((m) => m[1])
}
