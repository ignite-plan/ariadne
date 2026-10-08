// 작업 폴더에서 바뀐 파일을 화면에 보일 이름과 종류로 나눈다. Electron에 의존하지 않는다 (단위 테스트 대상)
import type { ManualRef } from '../../../src/core/manual.ts'
import type { FileChange } from '../../shared/api.ts'
import { readTree } from './sections.ts'

export function describeChanges(ref: ManualRef, changes: Pick<FileChange, 'path' | 'status'>[]): FileChange[] {
  const prefix = `manuals/${ref.manual}/`
  const titles = new Map<string, string>()
  try {
    for (const chapter of readTree(ref).chapters) {
      for (const section of chapter.sections) titles.set(`${prefix}${section.path}`, section.title)
    }
  } catch {
    // manual.yaml이 깨졌으면 경로만 보여 준다
  }
  return changes.map(({ path, status }): FileChange => {
    if (titles.has(path)) return { path, status, label: titles.get(path)!, kind: 'section' }
    if (path.startsWith(`${prefix}images/`) && path.endsWith('.png')) {
      return { path, status, label: path.slice(`${prefix}images/`.length, -'.png'.length), kind: 'image' }
    }
    if (path === `${prefix}manual.yaml`) return { path, status, label: '목차 (manual.yaml)', kind: 'manual' }
    if (path.startsWith(prefix) && path.endsWith('.md')) return { path, status, label: path.slice(prefix.length), kind: 'section' }
    return { path, status, label: path, kind: 'other' }
  })
}
