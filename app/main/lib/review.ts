// Claude 변경 검토: 최신화가 화면을 고치기 직전 본문을 저장해 두고, 편집 화면이 지금 본문과 비교해 바뀐 곳을 표시한다.
// 기획자가 [검토 완료]를 누르거나 제출·되돌리면 지운다. .capture는 git에 올라가지 않는다
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { captureDir } from '../../../src/core/capture.ts'
import type { ManualRef } from '../../../src/core/manual.ts'
import type { ReviewBase } from '../../shared/api.ts'
import { readSectionDoc, resolveInside } from './sections.ts'

const reviewDir = (ref: ManualRef) => join(captureDir(ref), 'review')
const reviewFile = (ref: ManualRef, path: string) => resolveInside(reviewDir(ref), `${path}.json`)

function currentBody(ref: ManualRef, path: string) {
  try {
    return readSectionDoc(ref, path).body
  } catch {
    // 화면이 없어졌다 (삭제·순서 변경)
    return undefined
  }
}

// 이미 검토할 기준이 있으면 그대로 둔다 (검토 전에 다시 최신화해도 처음 원문과 비교). 새로 저장했으면 true
export function saveReviewBase(ref: ManualRef, path: string, before: string, now = Date.now()) {
  const file = reviewFile(ref, path)
  if (existsSync(file)) return false
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ before, at: now } satisfies ReviewBase))
  return true
}

// 지금 본문과 같으면 표시할 것이 없다. 기준은 지우지 않는다 (Claude가 아직 고치는 중일 수 있다). 화면이 없어졌으면 지운다
export function readReview(ref: ManualRef, path: string): ReviewBase | undefined {
  const file = reviewFile(ref, path)
  if (!existsSync(file)) return undefined
  let base: ReviewBase
  try {
    base = JSON.parse(readFileSync(file, 'utf8')) as ReviewBase
  } catch {
    rmSync(file, { force: true })
    return undefined
  }
  const body = currentBody(ref, path)
  if (body === undefined) {
    rmSync(file, { force: true })
    return undefined
  }
  return body === base.before ? undefined : base
}

export function clearReview(ref: ManualRef, path: string) {
  rmSync(reviewFile(ref, path), { force: true })
}

export function clearAllReviews(ref: ManualRef) {
  rmSync(reviewDir(ref), { recursive: true, force: true })
}

// 검토할 변경이 남은 화면 경로 (manuals/<m>/ 기준)
export function listReviews(ref: ManualRef): string[] {
  const dir = reviewDir(ref)
  if (!existsSync(dir)) return []
  const paths: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.md.json')) paths.push(relative(dir, full).split(sep).join('/').replace(/\.json$/, ''))
    }
  }
  walk(dir)
  return paths.filter((path) => readReview(ref, path)).sort()
}

// 되돌린 파일(리포 기준 경로)의 검토 기준을 지운다
export function clearReviewsForRepoPaths(ref: ManualRef, repoPaths: string[]) {
  const prefix = `manuals/${ref.manual}/`
  for (const p of repoPaths) if (p.startsWith(prefix) && p.endsWith('.md')) clearReview(ref, p.slice(prefix.length))
}
