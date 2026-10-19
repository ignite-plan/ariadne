// macOS 키체인 암호 항목을 /usr/bin/security로 읽고 쓴다.
// Electron safeStorage는 키체인 항목을 앱이 직접 열어서, 자체 서명 앱(Team ID 없음)은 파티션이 빌드마다 바뀌는 cdhash가 되고
// 업데이트할 때마다 키체인 암호를 다시 묻는다. security가 만든 항목은 Apple 서명(security)만 열기 때문에 앱 서명과 상관없이 묻지 않는다
import { execFileSync } from 'node:child_process'

const SECURITY = '/usr/bin/security'

// GitHub 토큰 항목. account는 앱 데이터 폴더라 E2E(ARIADNE_USER_DATA)는 사용자 토큰을 건드리지 않는다
export const GITHUB_TOKEN_SERVICE = 'Ariadne GitHub Token'

export type KeychainItem = { service: string; account: string; keychain?: string }

// 키체인 파일은 옵션 뒤 마지막 인자여야 한다
const args = ({ service, account, keychain }: KeychainItem, ...options: string[]) => ['-s', service, '-a', account, ...options, ...(keychain ? [keychain] : [])]

// security -i 명령 줄의 인자. 값을 argv에 올리지 않으려고(ps에 보인다) 표준 입력으로 넘긴다
const quote = (value: string) => {
  if (!/^[^"\\\n]+$/.test(value)) throw new Error('키체인에 저장할 수 없는 문자가 있습니다')
  return `"${value}"`
}

// 없으면 null
export function readPassword(item: KeychainItem): string | null {
  try {
    return execFileSync(SECURITY, ['find-generic-password', ...args(item, '-w')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '')
  } catch {
    return null
  }
}

export function writePassword(item: KeychainItem, password: string) {
  // 명령 이름과 옵션은 따옴표로 감싸면 인식하지 못한다. 값만 감싼다
  const line = `add-generic-password -U -s ${quote(item.service)} -a ${quote(item.account)} -w ${quote(password)}${item.keychain ? ` ${quote(item.keychain)}` : ''}`
  execFileSync(SECURITY, ['-i'], { input: `${line}\n`, stdio: ['pipe', 'ignore', 'pipe'] })
  // -i는 명령이 실패해도 0으로 끝난다
  if (readPassword(item) !== password) throw new Error('키체인에 저장하지 못했습니다')
}

export function deletePassword(item: KeychainItem) {
  try {
    execFileSync(SECURITY, ['delete-generic-password', ...args(item)], { stdio: 'ignore' })
  } catch {
    // 없으면 그대로
  }
}
