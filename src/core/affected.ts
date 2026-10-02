// dealerhub-web의 두 ref 사이 변경을 매뉴얼 섹션에 매핑한다.
import { execFileSync } from 'node:child_process'
import { matchesGlob } from 'node:path'
import { loadManual, localePath, parseFrontMatter, readSection, sectionImages, type ManualRef } from './manual.ts'

export interface AffectedOptions extends ManualRef {
  // dealerhub-web 로컬 경로
  repo: string
  base: string
  head?: string
  locale?: string
}

export interface AffectedSection {
  section: string
  title?: string
  files: string[]
  keys: string[]
  images: string[]
}

export const DEFAULT_LOCALE = 'apps/hyundai-bo/src/locales/en.json'

// en.json diff에서 추가/삭제된 key
export function changedLocaleKeys(diff: string) {
  return [
    ...new Set(
      diff
        .split('\n')
        .map((l) => l.match(/^[+-]\s*"([A-Z0-9_]+)"/)?.[1])
        .filter((k): k is string => Boolean(k)),
    ),
  ]
}

// 섹션 front-matter의 sources glob, i18nPrefix와 대조
export function matchSections(ref: ManualRef, changedFiles: string[], changedKeys: string[]) {
  const affected: AffectedSection[] = []
  for (const chapter of loadManual(ref).chapters) {
    for (const file of chapter.sections) {
      const raw = readSection(ref, chapter, file)
      const meta = parseFrontMatter(raw)
      const files = changedFiles.filter((f) => meta.sources?.some((glob) => matchesGlob(f, glob)))
      const keys = changedKeys.filter((k) => meta.i18nPrefix?.some((p) => k.startsWith(p)))
      if (files.length || keys.length) {
        affected.push({ section: `${chapter.dir}/${file}`, title: meta.title, files, keys, images: sectionImages(raw) })
      }
    }
  }
  return affected
}

// locale을 안 주면 manual.yaml code에서, 그것도 없으면 BO en.json
export function findAffected({ repo, base, head = 'HEAD', locale, ...ref }: AffectedOptions) {
  const range = `${base}...${head}`
  locale ??= localePath(loadManual(ref)) ?? DEFAULT_LOCALE
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const changedFiles = git('diff', '--name-only', range).split('\n').filter(Boolean)
  const changedKeys = changedLocaleKeys(git('diff', '-U0', range, '--', locale))
  return { range, affected: matchSections(ref, changedFiles, changedKeys) }
}
