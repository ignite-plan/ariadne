// claude.ai 로그인을 앱 안에서: `claude auth login --claudeai`(터미널 없이도 브라우저를 열고, 안 열리면 주소를 출력하고,
// "Paste code here if prompted"로 코드를 받는다)와 `claude auth status --json`.
// 로그인 모드 환경(키 변수를 뺀 env, 기본 설정 폴더)으로 실행해 터미널의 claude와 로그인을 같이 쓴다.
// Electron에 의존하지 않는다 (단위 테스트 대상)
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { ClaudeLoginStatus } from '../../shared/api.ts'
import type { ClaudeCli } from './claude.ts'

const run = promisify(execFile)

// 출력에서 로그인 주소. 터미널 링크(OSC 8) 표식과 줄바꿈 앞에서 끊는다
export function parseLoginUrl(text: string) {
  return text.match(/https:\/\/[^\s\x1b\x07]+/)?.[0]
}

// `auth status --json`. 형식이 바뀌어도 로그인 여부만은 읽는다
export function parseAuthStatus(stdout: string): ClaudeLoginStatus {
  try {
    const json = JSON.parse(stdout) as Record<string, unknown>
    const text = (key: string) => (typeof json[key] === 'string' && json[key] ? (json[key] as string) : undefined)
    return {
      loggedIn: json.loggedIn === true,
      method: text('authMethod'),
      account: text('email') ?? text('emailAddress') ?? text('account') ?? text('orgName'),
    }
  } catch {
    return { loggedIn: false, error: `로그인 상태를 읽지 못했습니다: ${stdout.trim().slice(0, 200)}` }
  }
}

export async function claudeLoginStatus(cli: ClaudeCli): Promise<ClaudeLoginStatus> {
  try {
    const { stdout } = await run(cli.path, ['auth', 'status', '--json'], { env: cli.env, timeout: 20000 })
    return parseAuthStatus(stdout)
  } catch (error) {
    // 로그인되어 있지 않으면 0이 아닌 코드로 끝나면서 JSON을 낼 수 있다
    const out = (error as { stdout?: string }).stdout
    if (out?.trim().startsWith('{')) return parseAuthStatus(out)
    return { loggedIn: false, error: (error as Error).message }
  }
}

export async function claudeLogout(cli: ClaudeCli) {
  await run(cli.path, ['auth', 'logout'], { env: cli.env, timeout: 20000 })
}

export interface LoginRun {
  // 브라우저에서 받은 코드를 넘긴다 (브라우저가 앱으로 돌아오지 못했을 때)
  sendCode: (code: string) => void
  cancel: () => void
  done: Promise<void>
}

// onUrl: 주소를 찾으면 한 번 (브라우저가 안 열렸을 때 화면에 보여 준다)
export function startClaudeLogin(cli: ClaudeCli, onUrl: (url: string) => void): LoginRun {
  const child = spawn(cli.path, ['auth', 'login', '--claudeai'], { env: cli.env, stdio: ['pipe', 'pipe', 'pipe'] })
  let output = ''
  let url: string | undefined
  let cancelled = false
  const onData = (chunk: Buffer) => {
    output += chunk.toString('utf8')
    if (url) return
    url = parseLoginUrl(output)
    if (url) onUrl(url)
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      // 끝 몇 줄만 (주소는 길고 화면에 이미 나왔다)
      const tail = output.replace(/https:\/\/\S+/g, '').trim().split('\n').slice(-3).join(' ').trim()
      reject(new Error(cancelled ? '로그인을 취소했습니다' : `claude.ai 로그인에 실패했습니다${tail ? ` (${tail})` : ''}`))
    })
  })
  return {
    sendCode: (code) => child.stdin.write(`${code.trim()}\n`),
    cancel: () => {
      cancelled = true
      child.kill()
    },
    done,
  }
}
