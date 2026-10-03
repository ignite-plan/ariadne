// 기획서 요약: 최신화 첫 단계에서 Claude가 Confluence를 한 번 읽어 화면별로 요약한 JSON.
// 화면별 작업은 이 요약만 받는다 (큰 기획서를 화면마다 다시 뒤지지 않게). 같은 버전이면 다음 실행에도 재사용한다
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { captureDir } from '../../../src/core/capture.ts'
import type { ManualRef, SectionMeta, SpecRef } from '../../../src/core/manual.ts'

export interface SpecPage {
  id: string
  title: string
  version: number
  url?: string
}

export interface SpecDigest {
  menu: string
  generatedAt: string
  // 근거로 본 화면 기획서(최신 output)와 정책 문서
  pages: SpecPage[]
  // 여러 화면에 걸친 정책
  common?: string
  // 화면 파일 이름(01-menu-list-view.md) → 그 화면의 항목·버튼·정책·최근 변경 요약
  screens: Record<string, string>
}

export const specSlug = (menu: string) =>
  menu
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'menu'

export function digestPath(ref: ManualRef, menu: string) {
  return join(captureDir(ref), 'spec', `${specSlug(menu)}.json`)
}

export function readDigest(file: string): SpecDigest | undefined {
  if (!existsSync(file)) return undefined
  try {
    const d = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(d.pages) || typeof d.screens !== 'object' || !d.screens) return undefined
    const pages = d.pages
      .filter((p: SpecPage) => p && p.id && Number.isFinite(Number(p.version)))
      .map((p: SpecPage) => ({ ...p, id: String(p.id), version: Number(p.version) }))
    return { menu: String(d.menu ?? ''), generatedAt: String(d.generatedAt ?? ''), pages, common: d.common, screens: d.screens }
  } catch {
    return undefined
  }
}

export function specRefs(digest: SpecDigest | undefined): SpecRef[] {
  return (digest?.pages ?? []).map((p) => ({ page: p.id, version: p.version })).sort((a, b) => a.page.localeCompare(b.page))
}

const key = (refs: SpecRef[] = []) =>
  refs
    .map((r) => `${r.page}@${r.version}`)
    .sort()
    .join(',')

// 근거 기획서 버전이 지난번 최신화 때와 같으면 다시 할 필요가 없다. 기획서를 못 읽었으면 항상 한다
export function needsRefresh(meta: SectionMeta, refs: SpecRef[]) {
  if (!refs.length) return true
  return key(meta.refreshedFrom) !== key(refs)
}

// 화면별 작업에 줄 요약. 파일 이름이나 경로 어느 쪽으로 적혀 있어도 찾는다
export function screenBrief(digest: SpecDigest | undefined, target: string) {
  if (!digest) return ''
  const file = basename(target)
  const own = digest.screens[file] ?? digest.screens[target] ?? Object.entries(digest.screens).find(([k]) => k.endsWith(file))?.[1] ?? ''
  const pages = digest.pages.map((p) => `- ${p.title} (v${p.version})${p.url ? ` ${p.url}` : ''}`).join('\n')
  return [`근거 기획서:\n${pages}`, digest.common ? `공통 정책:\n${digest.common}` : '', own ? `이 화면:\n${own}` : '이 화면: (요약에 없음 — 필요하면 Confluence에서 직접 확인)']
    .filter(Boolean)
    .join('\n\n')
}
