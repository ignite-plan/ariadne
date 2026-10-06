// Claude 작업 종류별로 Confluence(기획서)가 필요한지. main(실행)과 renderer(점검 화면)가 같이 쓴다
import type { DraftInput } from './api.ts'

// 장면 채우기는 매뉴얼 본문·시나리오·STG만 본다. 영상 초안은 연결된 매뉴얼 화면이 없을 때만 기획서를 찾는다
export function needsConfluence(input: Pick<DraftInput, 'mode' | 'targets'>) {
  if (input.mode === 'video-scene') return false
  if (input.mode === 'video') return !input.targets?.[0]
  return true
}
