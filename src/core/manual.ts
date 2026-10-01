// manual.yaml과 섹션 Markdown을 읽는 공통 함수. CLI와 앱이 같이 쓴다
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import YAML from 'yaml'

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

export interface Manual {
  title: string
  version: string
  chapters: Chapter[]
}

// 섹션 front-matter. dealerhub-web 코드와의 연결 키
export interface SectionMeta {
  title?: string
  routes?: string[]
  sources?: string[]
  i18nPrefix?: string[]
}

export function manualDir({ root, manual }: ManualRef) {
  return resolve(root, 'manuals', manual)
}

export function loadManual(ref: ManualRef): Manual {
  return YAML.parse(readFileSync(join(manualDir(ref), 'manual.yaml'), 'utf8'))
}

export function readSection(ref: ManualRef, chapter: Chapter, file: string) {
  return readFileSync(join(manualDir(ref), chapter.dir, file), 'utf8')
}

// 장 번호는 디렉토리 prefix(02-)
export function chapterNo(chapter: Chapter) {
  return Number.parseInt(chapter.dir, 10)
}

export function parseFrontMatter(md: string): SectionMeta {
  return YAML.parse(md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '{}') ?? {}
}

export function stripFrontMatter(md: string) {
  return md.replace(/^---\n[\s\S]*?\n---\n/, '')
}

// 본문이 참조하는 shot id (images/<id>.png)
export function sectionImages(md: string) {
  return [...md.matchAll(/\]\(images\/([^)]+)\.png\)/g)].map((m) => m[1])
}
