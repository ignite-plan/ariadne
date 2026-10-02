// claude -p를 어떤 인증으로 실행할지. 설정 → 고급 → Claude 인증
//   apiKey: ANTHROPIC_API_KEY 환경변수 (기본). Finder에서 띄운 앱은 ~/.zshrc를 못 읽어 로그인 셸에서 가져온다
//   login: claude.ai 로그인. 키 환경변수를 넘기지 않는다 (claude -p는 키가 있으면 로그인보다 먼저 쓴다)
export type ClaudeAuth = 'apiKey' | 'login'

export const KEY_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'] as const

// 다른 Claude Code 세션 안에서 앱을 띄우면 붙는 표식. 남아 있으면 중첩 세션으로 오인된다
const SESSION_VARS = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_CODE_(ENTRYPOINT|SESSION_\w+|CHILD_SESSION|MESSAGING_\w+|EXECPATH|SSE_PORT))$/

export interface AuthEnvOptions {
  path: string
  auth: ClaudeAuth
  // 로그인 셸에서 읽은 KEY_VARS 값 (~/.zshrc 최신 값)
  shellVars?: Partial<Record<(typeof KEY_VARS)[number], string>>
}

export function claudeEnv(base: NodeJS.ProcessEnv, { path, auth, shellVars = {} }: AuthEnvOptions) {
  const env: NodeJS.ProcessEnv = { ...base, PATH: path }
  for (const key of Object.keys(env)) if (SESSION_VARS.test(key)) delete env[key]
  for (const key of KEY_VARS) {
    if (auth === 'login') delete env[key]
    // 셸 설정을 바꾼 뒤 앱을 다시 띄우지 않아도 최신 값을 쓰도록 로그인 셸 값을 우선한다
    else if (shellVars[key]) env[key] = shellVars[key]
  }
  return env
}

// 키 값은 화면/로그에 내보내지 않는다
export function keySource(base: NodeJS.ProcessEnv, shellVars: AuthEnvOptions['shellVars'] = {}) {
  if (shellVars.ANTHROPIC_API_KEY || shellVars.ANTHROPIC_AUTH_TOKEN) return 'shell' as const
  if (base.ANTHROPIC_API_KEY || base.ANTHROPIC_AUTH_TOKEN) return 'env' as const
  return null
}

// 실패 결과를 기획자가 할 일로 바꾼다
export function explainFailure(text: string, auth: ClaudeAuth) {
  const raw = text.trim()
  if (/expired|invalid api key|fix external api key|authentication_error|failed to authenticate|\b401\b/i.test(raw)) {
    return auth === 'apiKey'
      ? `ANTHROPIC_API_KEY로 인증하지 못했습니다 (${raw}). ~/.zshrc의 키를 유효한 값으로 바꾸거나, 설정 → 고급 → Claude 인증을 claude.ai 로그인으로 바꾸세요`
      : `claude.ai 로그인으로 인증하지 못했습니다 (${raw}). 터미널에서 \`claude\`를 열어 /login 하세요`
  }
  if (/not logged in|please run \/login|login required/i.test(raw)) {
    return 'Claude Code에 로그인되어 있지 않습니다. 터미널에서 `claude`를 실행해 /login 하거나, 설정 → 고급 → Claude 인증을 API 키로 바꾸세요'
  }
  return text
}
