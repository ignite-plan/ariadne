// 설정과 GitHub 토큰
import type { AuthStatus, Settings } from '../../shared/api.ts'
import { checkRepoAccess, getUser } from '../lib/github.ts'
import { clearToken, getSettings, readToken, saveToken, updateSettings } from '../settings.ts'
import { handle, netFetch, pickPath, rememberUser } from './context.ts'

// 토큰으로 사용자를 확인한다. 실패하면 이유를 담아 돌려준다 (환경 점검도 쓴다)
export async function authStatus(): Promise<AuthStatus> {
  const token = readToken()
  if (!token) return { hasToken: false }
  try {
    const user = await getUser(netFetch, token)
    rememberUser(user)
    return { hasToken: true, user }
  } catch (error) {
    return { hasToken: true, error: (error as Error).message }
  }
}

export function registerSettings() {
  handle('settings:get', () => getSettings())
  handle('settings:update', (patch: Partial<Settings>) => updateSettings(patch))
  handle('settings:pickDirectory', (title) => pickPath({ title, properties: ['openDirectory', 'createDirectory'] }))

  handle('auth:status', authStatus)
  handle('auth:setToken', async (token) => {
    const trimmed = token.trim()
    if (!trimmed) throw new Error('토큰을 입력하세요')
    const found = await getUser(netFetch, trimmed)
    await checkRepoAccess(netFetch, trimmed, getSettings().repoUrl)
    saveToken(trimmed)
    rememberUser(found)
    return { hasToken: true, user: found }
  })
  handle('auth:clearToken', () => {
    clearToken()
    rememberUser(undefined)
  })
}
