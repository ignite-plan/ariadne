// 기획서 요약: 최신화 첫 단계에서 Claude가 Confluence를 한 번 읽어 화면별로 요약한 JSON.
// 화면별 작업은 이 요약만 받는다 (큰 기획서를 화면마다 다시 뒤지지 않게). 같은 버전이면 다음 실행에도 재사용한다
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
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
  // 반영 범위가 있을 때: 화면 → 이번에 반영할 변경(티켓 포함). 없는 화면은 반영할 변경이 없다
  changes?: Record<string, string>
}

// 화면 경로나 파일 이름 어느 쪽으로 적혀 있어도 찾는다
function lookup(record: Record<string, string> | undefined, target: string) {
  if (!record) return undefined
  const file = basename(target)
  return record[target] ?? record[file] ?? Object.entries(record).find(([k]) => k.endsWith(file))?.[1]
}

// 반영 범위 요약에서 이 화면에 반영할 변경이 있는지
export function hasScopedChanges(digest: SpecDigest, target: string) {
  const text = lookup(digest.changes, target)?.trim()
  return Boolean(text && !/^\(?(없음|변경 없음|none)\)?$/i.test(text))
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

// 형식이 맞는 요약만 받는다. 버전은 숫자로, id는 문자열로
function normalizeDigest(d: unknown): SpecDigest | undefined {
  if (!d || typeof d !== 'object') return undefined
  const v = d as Record<string, unknown>
  if (!Array.isArray(v.pages) || !v.screens || typeof v.screens !== 'object' || Array.isArray(v.screens)) return undefined
  const pages = (v.pages as SpecPage[])
    .filter((p) => p && p.id && Number.isFinite(Number(p.version)))
    .map((p) => ({ ...p, id: String(p.id), title: String(p.title ?? ''), version: Number(p.version) }))
  const strings = (r: unknown) => Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, s]) => [k, String(s ?? '')]))
  const changes = v.changes && typeof v.changes === 'object' && !Array.isArray(v.changes) ? strings(v.changes) : undefined
  return {
    menu: String(v.menu ?? ''),
    generatedAt: String(v.generatedAt ?? ''),
    pages,
    common: typeof v.common === 'string' ? v.common : undefined,
    screens: strings(v.screens),
    ...(changes ? { changes } : {}),
  }
}

export function readDigest(file: string): SpecDigest | undefined {
  if (!existsSync(file)) return undefined
  try {
    return normalizeDigest(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return undefined
  }
}

export function writeDigest(file: string, digest: SpecDigest) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(digest, null, 2)}\n`)
}

// 요약 단계 Claude의 마지막 응답(JSON 블록). 파일은 앱이 쓴다 (Claude에게 쓰기 권한을 주지 않는다)
export type SpecReply = { reused: true } | { reused: false; digest: SpecDigest }

export function parseSpecReply(text: string, menu: string): SpecReply | undefined {
  const block = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1]
  if (!block) return undefined
  let value: unknown
  try {
    value = JSON.parse(block)
  } catch {
    return undefined
  }
  if (value && typeof value === 'object' && (value as { reused?: unknown }).reused === true) return { reused: true }
  const digest = normalizeDigest(value)
  if (!digest || !digest.pages.length) return undefined
  return { reused: false, digest: { ...digest, menu: digest.menu || menu, generatedAt: digest.generatedAt || new Date().toISOString() } }
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
  const own = lookup(digest.screens, target) ?? ''
  const changes = lookup(digest.changes, target)
  const pages = digest.pages.map((p) => `- ${p.title} (v${p.version})${p.url ? ` ${p.url}` : ''}`).join('\n')
  return [
    `근거 기획서:\n${pages}`,
    digest.common ? `공통 정책:\n${digest.common}` : '',
    own ? `이 화면:\n${own}` : '이 화면: (요약에 없음 — 필요하면 Confluence에서 직접 확인)',
    changes ? `이번에 반영할 변경 (이것만 반영한다):\n${changes}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
