// smoke 단계 묶음이 같이 쓰는 것
import type { ElectronApplication, Locator, Page } from 'playwright'

export interface Smoke {
  app: ElectronApplication
  page: Page
  step: (name: string, fn: () => Promise<void>) => Promise<void>
  // --shots가 있으면 화면을 찍어 둔다
  snap: (name: string) => Promise<void>
  toast: (text: string | RegExp) => Locator
  token: string
  // 작업 폴더(매뉴얼 리포)와 앱 데이터 폴더
  workspace: string
  userData: string
  // 가짜 Claude 최신화는 이 파일이 생길 때까지 기다린다
  claudeHold: string
}
