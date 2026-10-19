// claude.ai 로그인을 앱 안에서. 설정의 인증 방식과 상관없이 로그인 모드 환경(키 변수 뺌)으로 claude를 찾아 실행한다
import { findClaude } from '../lib/claude.ts'
import { claudeLoginStatus, claudeLogout, startClaudeLogin, type LoginRun } from '../lib/claude-login.ts'
import { getSettings } from '../settings.ts'
import { handle, send } from './context.ts'

let current: LoginRun | undefined

const loginCli = async () => {
  const cli = await findClaude(getSettings().claudePath || undefined, false, 'login')
  if (!cli) throw new Error('Claude Code를 찾지 못했습니다. 설정 → 환경 점검에서 앱 전용으로 설치하세요')
  return cli
}

export function registerClaudeLogin() {
  handle('claudeLogin:status', async () => {
    const cli = await findClaude(getSettings().claudePath || undefined, false, 'login')
    return cli ? claudeLoginStatus(cli) : null
  })
  handle('claudeLogin:start', async () => {
    if (current) throw new Error('이미 로그인 중입니다')
    const cli = await loginCli()
    current = startClaudeLogin(cli, (url) => send('claude-login-url', url))
    try {
      await current.done
    } finally {
      current = undefined
    }
    const status = await claudeLoginStatus(cli)
    if (!status.loggedIn) throw new Error(status.error ?? '로그인이 끝났지만 claude.ai 로그인 상태가 아닙니다')
    return status
  })
  handle('claudeLogin:sendCode', (code) => {
    if (!current) throw new Error('진행 중인 로그인이 없습니다')
    current.sendCode(code)
  })
  handle('claudeLogin:cancel', () => current?.cancel())
  handle('claudeLogin:logout', async () => {
    const cli = await loginCli()
    await claudeLogout(cli)
    return claudeLoginStatus(cli)
  })
}
