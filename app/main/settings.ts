// 앱 설정(userData/settings.json)과 GitHub 토큰(Keychain 암호화, userData/token.bin)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type { Settings } from '../shared/api.ts'

const file = () => join(app.getPath('userData'), 'settings.json')
const tokenFile = () => join(app.getPath('userData'), 'token.bin')

export function defaultSettings(): Settings {
  return {
    repoUrl: 'https://github.com/ignite-plan/ariadne',
    branch: 'main',
    workspaceDir: join(app.getPath('documents'), 'Ariadne'),
    manual: 'bo',
    pandocPath: '',
    dealerhubWebDir: '',
    submitMode: 'push',
    claudePath: '',
    claudeAuth: 'apiKey',
  }
}

let cache: Settings | undefined

export function getSettings(): Settings {
  if (cache) return cache
  let saved: Partial<Settings> = {}
  try {
    saved = JSON.parse(readFileSync(file(), 'utf8'))
  } catch {
    // 첫 실행이거나 깨진 파일이면 기본값
  }
  cache = { ...defaultSettings(), ...saved }
  return cache
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch }
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(file(), JSON.stringify(next, null, 2))
  cache = next
  return next
}

export function readToken() {
  if (!existsSync(tokenFile())) return null
  try {
    return safeStorage.decryptString(readFileSync(tokenFile()))
  } catch {
    // 앱을 다시 설치해 Keychain 키가 바뀌면 복호화가 안 된다. 다시 입력받는다
    return null
  }
}

export function saveToken(token: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Keychain을 사용할 수 없어 토큰을 저장하지 못했습니다')
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(tokenFile(), safeStorage.encryptString(token.trim()))
}

export function clearToken() {
  rmSync(tokenFile(), { force: true })
}

// BO 로그인 세션은 리포가 아니라 사용자별 앱 데이터에 둔다
export function authFile(manual: string) {
  return join(app.getPath('userData'), 'auth', `${manual}.json`)
}
