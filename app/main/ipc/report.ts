// 로그 남기기·열기와 문제 신고(GitHub Issue)
import { app, clipboard, shell } from 'electron'
import type { ReportInput, ReportResult } from '../../shared/api.ts'
import { getUser } from '../lib/github.ts'
import { buildReport, createIssue, IssuePermissionError, newIssueUrl } from '../lib/report.ts'
import { log, logsDir, redactOptions } from '../log.ts'
import { getSettings, readToken } from '../settings.ts'
import { handle, netFetch, send } from './context.ts'

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

// 도움말 메뉴 → 화면에 신고 창 열기
export const openReport = () => send('open-report', undefined)

export function registerReport() {
  handle('log:write', (level, source, message) => log.write(level, `renderer:${source}`, message))
  handle('log:reveal', async () => {
    await shell.openPath(logsDir())
  })
  handle('report:preview', (input) => report(input))
  handle('report:submit', async (input): Promise<ReportResult> => {
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
}
