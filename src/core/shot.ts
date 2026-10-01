import type { Page } from 'playwright'

export interface Shot {
  // 저장 파일명 images/<id>.png, Markdown 이미지 경로와 같아야 한다
  id: string
  // BO_BASE_URL 기준 경로
  path: string
  // 화면 준비 완료를 판단할 locator
  ready?: string
  // 팝업 열기 등 캡처 전 조작. 저장/삭제/발송 같은 CUD 버튼은 누르지 않는다
  steps?: (page: Page) => Promise<void>
  // 캡처 영역 locator. 없으면 viewport 전체
  clip?: string
  // 가릴 영역 locator
  mask?: string[]
  // 자동화하지 않고 기존 이미지를 유지 (아이콘 크롭 등)
  manual?: boolean
}

export function defineShots(shots: Shot[]) {
  return shots
}
