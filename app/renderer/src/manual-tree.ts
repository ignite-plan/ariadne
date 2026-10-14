// 매뉴얼 목차(ManualTree)에서 화면 찾기
import type { ManualTree } from '../../shared/api.ts'

export const allSections = (tree?: ManualTree) => tree?.chapters.flatMap((c) => c.sections) ?? []

export const findSection = (tree: ManualTree | undefined, path?: string) => allSections(tree).find((s) => s.path === path)

// 열 화면: preferred가 아직 목차에 있으면 그것, 없으면 첫 화면
export function pickSection(tree: ManualTree, preferred?: string | null) {
  const paths = allSections(tree).map((s) => s.path)
  return preferred && paths.includes(preferred) ? preferred : paths[0]
}
