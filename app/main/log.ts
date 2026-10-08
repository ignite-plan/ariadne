// 오류 기록(로컬 로그). 문제 신고(ipc/report.ts)가 최근 로그를 붙인다
import os from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { createLogger, type Logger } from './lib/logger.ts'
import { readToken } from './settings.ts'

// 로그와 신고에서 가릴 값: GitHub 토큰, Claude 키, 홈 경로
export const redactOptions = () => ({
  home: os.homedir(),
  secrets: [readToken(), process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_AUTH_TOKEN],
})

// 처음 쓸 때 만든다. E2E는 ARIADNE_USER_DATA 아래에 쓴다 (모듈을 불러올 때는 아직 정해지지 않았다)
export const logsDir = () =>
  process.env.ARIADNE_USER_DATA ? join(process.env.ARIADNE_USER_DATA, 'logs') : app.getPath('logs')
let logger: Logger | undefined
const current = () => (logger ??= createLogger(logsDir(), { redact: redactOptions }))
export const log: Logger = {
  get file() {
    return current().file
  },
  write: (...args) => current().write(...args),
  error: (...args) => current().error(...args),
  tail: (...args) => current().tail(...args),
  recentErrors: (...args) => current().recentErrors(...args),
}

export function installErrorHooks() {
  process.on('uncaughtException', (error) => log.error('main', error))
  process.on('unhandledRejection', (reason) => log.error('main:promise', reason))
  app.on('render-process-gone', (_event, _contents, details) =>
    log.write('error', 'renderer', `화면 프로세스가 종료됨: ${details.reason} (exit ${details.exitCode})`),
  )
  app.on('child-process-gone', (_event, details) =>
    log.write('error', `child:${details.type}`, `${details.serviceName ?? ''} ${details.reason} (exit ${details.exitCode})`),
  )
  log.write('info', 'main', `Ariadne ${app.getVersion()} 시작 · macOS ${process.getSystemVersion()}`)
}
