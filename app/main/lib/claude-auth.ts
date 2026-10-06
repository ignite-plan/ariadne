// claude -p를 어떤 인증으로 실행할지. 설정 → 고급 → Claude 인증
//   apiKey: ANTHROPIC_API_KEY 환경변수 (기본). Finder에서 띄운 앱은 ~/.zshrc를 못 읽어 로그인 셸에서 가져온다
//   login: claude.ai 로그인. 키 환경변수를 넘기지 않는다 (claude -p는 키가 있으면 로그인보다 먼저 쓴다)
export type ClaudeAuth = 'apiKey' | 'login'

export const KEY_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'] as const
// 인증과 상관없이 로그인 셸 값을 넘기는 변수. 게이트웨이(H-Chat 등)가 받는 모델을 ~/.zshrc에서 정한다
export const MODEL_VARS = ['ANTHROPIC_MODEL'] as const
// 로그인 셸에서 읽는 변수 전체
export const SHELL_VARS = [...KEY_VARS, ...MODEL_VARS] as const
export type ShellVars = Partial<Record<(typeof SHELL_VARS)[number], string>>

// 다른 Claude Code 세션 안에서 앱을 띄우면 붙는 표식. 남아 있으면 중첩 세션으로 오인된다
const SESSION_VARS = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_CODE_(ENTRYPOINT|SESSION_\w+|CHILD_SESSION|MESSAGING_\w+|EXECPATH|SSE_PORT))$/

export interface AuthEnvOptions {
  path: string
  auth: ClaudeAuth
  // 로그인 셸에서 읽은 SHELL_VARS 값 (~/.zshrc 최신 값)
  shellVars?: ShellVars
}

export function claudeEnv(base: NodeJS.ProcessEnv, { path, auth, shellVars = {} }: AuthEnvOptions) {
  const env: NodeJS.ProcessEnv = { ...base, PATH: path }
  for (const key of Object.keys(env)) if (SESSION_VARS.test(key)) delete env[key]
  for (const key of KEY_VARS) {
    if (auth === 'login') delete env[key]
    // 셸 설정을 바꾼 뒤 앱을 다시 띄우지 않아도 최신 값을 쓰도록 로그인 셸 값을 우선한다
    else if (shellVars[key]) env[key] = shellVars[key]
  }
  for (const key of MODEL_VARS) if (shellVars[key]) env[key] = shellVars[key]
  return env
}

// 키 값은 화면/로그에 내보내지 않는다
export function keySource(base: NodeJS.ProcessEnv, shellVars: AuthEnvOptions['shellVars'] = {}) {
  if (shellVars.ANTHROPIC_API_KEY || shellVars.ANTHROPIC_AUTH_TOKEN) return 'shell' as const
  if (base.ANTHROPIC_API_KEY || base.ANTHROPIC_AUTH_TOKEN) return 'env' as const
  return null
}

// 키를 화면에 낼 때는 끝 4자리만
const tail = (value?: string) => (value ? `…${value.slice(-4)}` : '')

function host(url?: string) {
  try {
    return url ? new URL(url).host : undefined
  } catch {
    return url
  }
}

// 실패 결과를 기획자가 할 일로 바꾼다. env는 claude에 실제로 넘긴 환경 (어느 변수로 인증했는지 알려 준다)
export function explainFailure(text: string, auth: ClaudeAuth, env: NodeJS.ProcessEnv = {}) {
  const raw = text.trim()
  const model = raw.match(/invalid model[:\s]+([\w.[\]-]+)/i)?.[1]?.replace(/\.+$/, '')
  if (model) {
    const current = env.ANTHROPIC_MODEL ? ` 지금 ANTHROPIC_MODEL은 ${env.ANTHROPIC_MODEL}입니다.` : ' ANTHROPIC_MODEL이 없어 Claude Code 기본 모델로 요청했습니다.'
    const gateway = host(env.ANTHROPIC_BASE_URL)
    return `${gateway ? `${gateway}가` : 'Claude가'} ${model} 모델을 받지 않습니다 (${raw}).${current} ~/.zshrc에 export ANTHROPIC_MODEL="<쓸 수 있는 모델, 예: claude-sonnet-5>"를 넣고 다시 시도하세요`
  }
  if (/expired|invalid api key|fix external api key|authentication_error|failed to authenticate|\b401\b/i.test(raw)) {
    if (auth === 'login') return `claude.ai 로그인으로 인증하지 못했습니다 (${raw}). 터미널에서 \`claude\`를 열어 /login 하세요`
    // ANTHROPIC_AUTH_TOKEN이 있으면 claude는 ANTHROPIC_API_KEY보다 그것을 먼저 쓴다
    const used = env.ANTHROPIC_AUTH_TOKEN ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY'
    const gateway = host(env.ANTHROPIC_BASE_URL)
    const fix = env.ANTHROPIC_AUTH_TOKEN
      ? `ANTHROPIC_AUTH_TOKEN이 있으면 ANTHROPIC_API_KEY보다 먼저 쓰입니다. ~/.zshrc에서 ANTHROPIC_AUTH_TOKEN을 지우거나 유효한 값으로 바꾸세요`
      : `~/.zshrc의 ANTHROPIC_API_KEY를 유효한 값으로 바꾸세요`
    return `${used}(${tail(env[used]) || '값 없음'})로 ${gateway ? `${gateway}에 ` : ''}인증하지 못했습니다 (${raw}). ${fix}. 고친 뒤 다시 시도하거나, 설정 → 고급 → Claude 인증을 claude.ai 로그인으로 바꾸세요`
  }
  if (/autocompact is thrashing|context refilled to the limit/i.test(raw)) {
    return 'Claude 작업 대화가 너무 길어져 자동 요약을 반복하다 멈췄습니다. 큰 기획서나 도구 결과가 한꺼번에 들어온 경우입니다. 대상을 줄여(화면 하나씩) 다시 시도하고, 계속되면 [문제 신고]로 알려 주세요'
  }
  if (/not logged in|please run \/login|login required/i.test(raw)) {
    return 'Claude Code에 로그인되어 있지 않습니다. 터미널에서 `claude`를 실행해 /login 하거나, 설정 → 고급 → Claude 인증을 API 키로 바꾸세요'
  }
  return text
}
