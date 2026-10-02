// 오류 기록(로컬 로그)과 문제 신고(GitHub Issue)
import os from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, ipcMain, net, shell } from 'electron'
import type { ReportInput, ReportResult } from '../shared/api.ts'
import { getUser } from './lib/github.ts'
import { createLogger, type Level, type Logger } from './lib/logger.ts'
import { buildReport, createIssue, IssuePermissionError, newIssueUrl } from './lib/report.ts'
import { getSettings, readToken } from './settings.ts'

const netFetch = (url: string, init?: RequestInit) => net.fetch(url, init)

// 로그와 신고에서 가릴 값: GitHub 토큰, Claude 키, 홈 경로
const redactOptions = () => ({
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

async function context() {
  const token = readToken()
  const login = token ? await getUser(netFetch, token).then((u) => u.login, () => undefined) : undefined
  return {
    appVersion: app.getVersion(),
    os: process.getSystemVersion(),
    manual: getSettings().manual,
    githubLogin: login,
  }
}

async function report(input: ReportInput) {
  return buildReport(input, await context(), log.recentErrors(10), log.tail(200), redactOptions())
}

export function registerReportIpc(getWindow: () => BrowserWindow | undefined) {
  ipcMain.handle('log:write', (_event, level: Level, source: string, message: string) =>
    log.write(level, `renderer:${source}`, message),
  )
  ipcMain.handle('log:reveal', () => shell.openPath(logsDir()))
  ipcMain.handle('report:preview', (_event, input: ReportInput) => report(input))
  ipcMain.handle('report:submit', async (_event, input: ReportInput): Promise<ReportResult> => {
    const built = await report(input)
    const { repoUrl } = getSettings()
    const token = readToken()
    try {
      if (!token) throw new IssuePermissionError('GitHub 토큰이 없습니다')
      const url = await createIssue(netFetch, token, repoUrl, built)
      log.write('info', 'report', `신고 접수: ${url}`)
      return { via: 'api', url }
    } catch (error) {
      if (!(error instanceof IssuePermissionError)) throw error
      // 토큰에 Issues 권한이 없다. 전체 내용은 클립보드에, 앞부분은 새 Issue 화면에 채워 연다
      clipboard.writeText(`${built.title}\n\n${built.body}`)
      const url = newIssueUrl(repoUrl, built)
      await shell.openExternal(url)
      log.write('warn', 'report', `API로 신고하지 못해 브라우저로 넘김: ${(error as Error).message}`)
      return { via: 'browser', url }
    }
  })
  // 도움말 메뉴 → 화면에 신고 창 열기
  return () => getWindow()?.webContents.send('open-report')
}
