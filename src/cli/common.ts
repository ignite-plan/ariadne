// CLI 공통: .env, --manual, 캡처 주소 덮어쓰기, 재로그인 안내.
// core는 .env·process.cwd()에 기대지 않는다 (CLAUDE.md). 여기서 읽어 인자로 넘긴다
import { isSessionExpired, type ManualRef } from '../core/index.ts'

// .env는 없어도 된다 (manual.yaml capture.baseUrl만 써도 된다)
export function loadEnv() {
  try {
    process.loadEnvFile()
  } catch {
    // .env 없음
  }
}

export const MANUAL_OPTION = { manual: { type: 'string', default: 'bo' } } as const

export function manualRef(manual = 'bo'): ManualRef {
  return { root: process.cwd(), manual }
}

// .env BO_BASE_URL은 bo 매뉴얼의 캡처 주소를 덮어쓴다 (예전 설정 호환). 없으면 manual.yaml capture.baseUrl
export function baseUrlOverride(manual: string) {
  return (manual === 'bo' && process.env.BO_BASE_URL) || undefined
}

// --chapters 2,5 같은 숫자 목록
export function numberList(value?: string) {
  return value?.split(',').map(Number)
}

// 로그인 프로필이 없거나 세션이 만료됐으면 다시 로그인할 명령을 붙인다
export function withReloginHint(error: unknown, ref: ManualRef, profileDir: string) {
  const message = error instanceof Error ? error.message : String(error)
  const relogin = message.includes(profileDir) || isSessionExpired(error)
  return relogin ? `${message}: pnpm login --manual ${ref.manual}` : message
}
