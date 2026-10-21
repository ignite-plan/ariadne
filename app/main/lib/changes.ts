// 작업 폴더에서 바뀐 파일을 화면에 보일 이름과 종류로 나눈다. Electron에 의존하지 않는다 (단위 테스트 대상)
import type { ManualRef } from '../../../src/core/manual.ts'
import type { FileChange } from '../../shared/api.ts'
import { readTree } from './sections.ts'

// 지운 매뉴얼(manual.yaml이 지워진 manuals/<id>/)의 파일은 "매뉴얼 삭제" 한 줄로 묶는다 (path는 manuals/<id>/)
function groupRemovedManuals(changes: Pick<FileChange, 'path' | 'status'>[]) {
  const removed = new Set(
    changes.filter((c) => c.status === 'deleted' && /^manuals\/[^/]+\/manual\.yaml$/.test(c.path)).map((c) => c.path.split('/')[1]),
  )
  if (!removed.size) return { rest: changes, groups: [] as FileChange[] }
  const groups = [...removed].sort().map((id): FileChange => {
    const files = changes.filter((c) => c.path.startsWith(`manuals/${id}/`)).length
    return { path: `manuals/${id}/`, status: 'deleted', label: `매뉴얼 삭제: ${id} (파일 ${files}개)`, kind: 'manual-removed' }
  })
  return { rest: changes.filter((c) => !removed.has(c.path.split('/')[1]) || !c.path.startsWith('manuals/')), groups }
}

export function describeChanges(ref: ManualRef, all: Pick<FileChange, 'path' | 'status'>[]): FileChange[] {
  const { rest: changes, groups } = groupRemovedManuals(all)
  const prefix = `manuals/${ref.manual}/`
  const titles = new Map<string, string>()
  try {
    for (const chapter of readTree(ref).chapters) {
      for (const section of chapter.sections) titles.set(`${prefix}${section.path}`, section.title)
    }
  } catch {
    // manual.yaml이 깨졌으면 경로만 보여 준다
  }
  return [...groups, ...changes.map(({ path, status }): FileChange => {
    if (titles.has(path)) return { path, status, label: titles.get(path)!, kind: 'section' }
    if (path.startsWith(`${prefix}images/`) && path.endsWith('.png')) {
      return { path, status, label: path.slice(`${prefix}images/`.length, -'.png'.length), kind: 'image' }
    }
    if (path === `${prefix}manual.yaml`) return { path, status, label: '목차 (manual.yaml)', kind: 'manual' }
    if (path === `${prefix}shots.ts`) return { path, status, label: '자동 캡처 정의 (shots.ts)', kind: 'manual' }
    if (path.startsWith(prefix) && path.endsWith('.md')) return { path, status, label: path.slice(prefix.length), kind: 'section' }
    return { path, status, label: path, kind: 'other' }
  })]
}

// 되돌릴 경로: "매뉴얼 삭제" 묶음(manuals/<id>/)은 그 아래 바뀐 파일 전부로 푼다
export function expandRevertPaths(paths: string[], changes: Pick<FileChange, 'path'>[]) {
  return [...new Set(paths.flatMap((p) => (p.endsWith('/') ? changes.filter((c) => c.path.startsWith(p)).map((c) => c.path) : [p])))]
}
