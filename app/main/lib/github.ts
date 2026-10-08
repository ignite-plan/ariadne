// GitHub REST. fetch를 주입한다 (앱은 net.fetch)
import type { GithubUser, UpdateInfo } from '../../shared/api.ts'
import { pickDmgAsset } from './app-update.ts'

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export function parseRepoUrl(url: string) {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  if (!match) throw new Error(`GitHub 리포 주소가 아닙니다: ${url}`)
  return { owner: match[1], repo: match[2] }
}

async function call<T>(fetchImpl: Fetch, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchImpl(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const reason =
      res.status === 401
        ? '토큰이 유효하지 않거나 만료되었습니다'
        : res.status === 403
          ? '권한이 없습니다. 토큰 권한과 조직 SSO 승인을 확인하세요'
          : res.status === 404
            ? '리포를 찾을 수 없습니다. 토큰에 이 리포 접근 권한이 있는지 확인하세요'
            : `GitHub 오류 ${res.status}`
    throw Object.assign(new Error(`${reason}${detail ? ` (${detail.slice(0, 200)})` : ''}`), { status: res.status })
  }
  return res.json() as Promise<T>
}

export async function getUser(fetchImpl: Fetch, token: string): Promise<GithubUser> {
  const user = await call<{ login: string; name: string | null; id: number; avatar_url: string }>(fetchImpl, token, '/user')
  return { login: user.login, name: user.name, id: user.id, avatarUrl: user.avatar_url }
}

// 리포 쓰기 권한까지 확인한다
export async function checkRepoAccess(fetchImpl: Fetch, token: string, repoUrl: string) {
  const { owner, repo } = parseRepoUrl(repoUrl)
  const info = await call<{ permissions?: { push?: boolean } }>(fetchImpl, token, `/repos/${owner}/${repo}`)
  if (info.permissions && !info.permissions.push) throw new Error('이 리포에 쓰기 권한이 없습니다')
}

export function commitAuthor(user: GithubUser) {
  return { name: user.name || user.login, email: `${user.id}+${user.login}@users.noreply.github.com` }
}

export async function createPullRequest(
  fetchImpl: Fetch,
  token: string,
  repoUrl: string,
  input: { head: string; base: string; title: string; body: string },
) {
  const { owner, repo } = parseRepoUrl(repoUrl)
  const pr = await call<{ html_url: string }>(fetchImpl, token, `/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return pr.html_url
}

// 1.2.3 비교. a가 크면 양수
export function compareVersions(a: string, b: string) {
  const pa = a.replace(/^[^\d]*/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.replace(/^[^\d]*/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff
  }
  return 0
}

// 앱 릴리즈 태그는 app-v<version>
export async function latestAppRelease(fetchImpl: Fetch, token: string, repoUrl: string, current: string): Promise<UpdateInfo | null> {
  const { owner, repo } = parseRepoUrl(repoUrl)
  const releases = await call<
    { tag_name: string; html_url: string; draft: boolean; prerelease: boolean; assets?: { url: string; name: string; size: number }[] }[]
  >(
    fetchImpl,
    token,
    `/repos/${owner}/${repo}/releases?per_page=20`,
  )
  const latest = releases
    .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith('app-v'))
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0]
  if (!latest || compareVersions(latest.tag_name, current) <= 0) return null
  const asset = pickDmgAsset(latest.assets)
  return { current, latest: latest.tag_name.replace(/^app-v/, ''), url: latest.html_url, ...(asset ? { asset } : {}) }
}
