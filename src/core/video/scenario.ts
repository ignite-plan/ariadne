import type { Director } from './director.ts'

export interface Scene {
  // 자막과 내레이션 공용 문장. 없으면 조작만 하는 장면
  say?: string
  // 화면 자막만 다르게 쓸 때 (say는 내레이션으로만 쓴다)
  caption?: string
  // 장면 조작. 내레이션과 동시에 진행한다
  do?: (v: Director) => Promise<void>
}

export interface VideoScenario {
  // 출력 파일명 dist/videos/<id>.mp4
  id: string
  // 시작 카드 제목
  title: string
  // 시작 카드 내레이션. 없으면 카드만 잠깐 보여 준다
  intro?: string
  // 문장 출처인 매뉴얼 섹션 (manuals/<manual>/ 기준)
  section?: string
  // true일 때만 저장/삭제/발송/승인 버튼을 누를 수 있다. STG 테스트 데이터로만 쓴다
  mutates?: boolean
  // 녹화 중 blur 처리할 locator (이메일, 전화번호 등)
  mask?: string[]
  scenes: Scene[]
  // 녹화가 끝난 뒤 실행. 만든 테스트 데이터 정리 (영상에 안 들어감, mutates 여부와 상관없이 저장/삭제 가능)
  cleanup?: (v: Director) => Promise<void>
}

export function defineVideo(scenario: VideoScenario) {
  return scenario
}
