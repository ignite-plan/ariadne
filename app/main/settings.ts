// 앱 설정(userData/settings.json)과 GitHub 토큰(macOS 키체인, lib/keychain.ts)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type { Settings } from '../shared/api.ts'
import { DEFAULT_CLAUDE_MODEL, upgradeClaudeModel } from './lib/claude-auth.ts'
import { deletePassword, GITHUB_TOKEN_SERVICE, readPassword, writePassword } from './lib/keychain.ts'

const file = () => join(app.getPath('userData'), 'settings.json')
// 1.10.2까지 쓰던 safeStorage 암호문. 처음 읽을 때 키체인으로 옮긴다
const legacyTokenFile = () => join(app.getPath('userData'), 'token.bin')
const tokenItem = () => ({ service: GITHUB_TOKEN_SERVICE, account: app.getPath('userData') })

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
    claudeAuth: 'auto',
    claudeModel: DEFAULT_CLAUDE_MODEL,
    claudeEffort: 'medium',
    notifyOnDone: 'background',
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
  if (typeof saved.claudeModel === 'string') saved.claudeModel = upgradeClaudeModel(saved.claudeModel)
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

// 로그를 쓸 때마다 읽으므로 security 실행은 처음 한 번만
let token: string | null | undefined

export function readToken() {
  if (token !== undefined) return token
  token = readPassword(tokenItem()) ?? migrateLegacyToken()
  return token
}

// 마지막으로 한 번 safeStorage 키체인 암호를 묻고 옮긴다. 못 풀면 다시 입력받는다
function migrateLegacyToken() {
  if (!existsSync(legacyTokenFile())) return null
  try {
    const legacy = safeStorage.decryptString(readFileSync(legacyTokenFile()))
    writePassword(tokenItem(), legacy)
    rmSync(legacyTokenFile(), { force: true })
    return legacy
  } catch {
    return null
  }
}

export function saveToken(value: string) {
  writePassword(tokenItem(), value.trim())
  rmSync(legacyTokenFile(), { force: true })
  token = value.trim()
}

export function clearToken() {
  deletePassword(tokenItem())
  rmSync(legacyTokenFile(), { force: true })
  token = null
}

// BO 로그인 세션은 리포가 아니라 사용자별 앱 데이터에 둔다
// STG 로그인 세션 = 매뉴얼마다 유지되는 Chrome 프로필 (src/core/session.ts)
export function profileDir(manual: string) {
  return join(app.getPath('userData'), 'profiles', manual)
}
