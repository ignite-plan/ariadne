// 문제 신고 → GitHub Issue. 토큰에 Issues 권한이 없으면 브라우저의 새 Issue 화면을 채워서 연다
import type { LogEntry } from './logger.ts'
import { parseRepoUrl, type Fetch } from './github.ts'
import { redact, type RedactOptions } from './redact.ts'

export interface ReportContext {
  appVersion: string
  os: string
  manual?: string
  workspaceSynced?: string
  githubLogin?: string
}

export interface ReportInput {
  description: string
  // 오류 토스트에서 [신고]로 열면 그 오류
  error?: string
  includeLog: boolean
}

export const REPORT_TITLE_PREFIX = '[Ariadne 신고]'

export function buildReport(
  input: ReportInput,
  context: ReportContext,
  errors: LogEntry[],
  logTail: string[],
  redactOptions: RedactOptions = {},
) {
  const description = input.description.trim()
  const firstLine = (description.split('\n')[0] || input.error?.split('\n')[0] || '문제 신고').slice(0, 80)
  const fence = (text: string) => `\`\`\`\n${text.replace(/```/g, "'''")}\n\`\`\``
  const sections = [
    '## 무엇을 하다가',
    description || '(설명 없음)',
    ...(input.error ? ['## 화면에 나온 오류', fence(input.error)] : []),
    '## 환경',
    [
      `- 앱 버전: ${context.appVersion}`,
      `- macOS: ${context.os}`,
      context.manual ? `- 매뉴얼: ${context.manual}` : '',
      context.githubLogin ? `- 신고자: @${context.githubLogin}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    ...(errors.length
      ? ['## 최근 오류', fence(errors.map((e) => `${e.time} [${e.source}] ${e.message}`).join('\n\n'))]
      : []),
    ...(input.includeLog && logTail.length ? ['<details><summary>최근 로그</summary>', '', fence(logTail.join('\n')), '', '</details>'] : []),
    '',
    '_Ariadne 앱의 [문제 신고]로 보냄 · 토큰·키·홈 경로는 가렸습니다_',
  ]
  return {
    title: `${REPORT_TITLE_PREFIX} ${redact(firstLine, redactOptions)}`,
    body: redact(sections.join('\n\n'), redactOptions),
  }
}

export class IssuePermissionError extends Error {}

export async function createIssue(fetchImpl: Fetch, token: string, repoUrl: string, report: { title: string; body: string }) {
  const { owner, repo } = parseRepoUrl(repoUrl)
  const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(report),
  })
  if (res.status === 403 || res.status === 404 || res.status === 401) {
    throw new IssuePermissionError(`GitHub Issue를 만들 권한이 없습니다 (${res.status})`)
  }
  if (!res.ok) throw new Error(`GitHub Issue 만들기 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const issue = (await res.json()) as { html_url: string; number: number }
  return issue.html_url
}

// 주소 길이 제한 때문에 본문은 앞부분만 넣는다 (전체는 클립보드로)
export function newIssueUrl(repoUrl: string, report: { title: string; body: string }, maxBody = 6000) {
  const { owner, repo } = parseRepoUrl(repoUrl)
  const body =
    report.body.length > maxBody ? `${report.body.slice(0, maxBody)}\n\n…(잘림 — 전체 내용은 클립보드에 있습니다. 붙여 넣어 주세요)` : report.body
  return `https://github.com/${owner}/${repo}/issues/new?title=${encodeURIComponent(report.title)}&body=${encodeURIComponent(body)}`
}
