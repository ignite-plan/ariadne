import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkRepoAccess, commitAuthor, compareVersions, createPullRequest, getUser, latestAppRelease, parseRepoUrl } from '../github.ts'

type Call = { url: string; init?: RequestInit }
function fakeFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = []
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const key = `${init?.method ?? 'GET'} ${url.replace('https://api.github.com', '')}`
    const route = routes[key]
    if (!route) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 })
  }
  return { calls, fetchImpl }
}

describe('github', () => {
  it('리포 주소 파싱', () => {
    assert.deepEqual(parseRepoUrl('https://github.com/ignite-plan/ariadne'), { owner: 'ignite-plan', repo: 'ariadne' })
    assert.deepEqual(parseRepoUrl('https://github.com/zi-gae/ariadne.git'), { owner: 'zi-gae', repo: 'ariadne' })
    assert.deepEqual(parseRepoUrl('git@github.com:a/b.git'), { owner: 'a', repo: 'b' })
    assert.throws(() => parseRepoUrl('https://gitlab.com/a/b'), /GitHub 리포 주소가 아닙니다/)
  })

  it('사용자 정보와 noreply 작성자', async () => {
    const { fetchImpl, calls } = fakeFetch({ 'GET /user': { body: { login: 'kim', name: null, id: 7, avatar_url: 'a' } } })
    const user = await getUser(fetchImpl, 'tok')
    assert.deepEqual(user, { login: 'kim', name: null, id: 7, avatarUrl: 'a' })
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer tok')
    assert.deepEqual(commitAuthor(user), { name: 'kim', email: '7+kim@users.noreply.github.com' })
  })

  it('상태 코드별 안내 문구', async () => {
    const { fetchImpl } = fakeFetch({ 'GET /user': { status: 401, body: {} } })
    await assert.rejects(getUser(fetchImpl, 'bad'), /토큰이 유효하지 않거나 만료/)
    await assert.rejects(checkRepoAccess(fakeFetch({}).fetchImpl, 't', 'https://github.com/a/b'), /리포를 찾을 수 없습니다/)
  })

  it('쓰기 권한이 없으면 거절', async () => {
    const { fetchImpl } = fakeFetch({ 'GET /repos/a/b': { body: { permissions: { push: false } } } })
    await assert.rejects(checkRepoAccess(fetchImpl, 't', 'https://github.com/a/b'), /쓰기 권한이 없습니다/)
    const ok = fakeFetch({ 'GET /repos/a/b': { body: { permissions: { push: true } } } })
    await checkRepoAccess(ok.fetchImpl, 't', 'https://github.com/a/b')
  })

  it('PR 생성', async () => {
    const { fetchImpl, calls } = fakeFetch({ 'POST /repos/a/b/pulls': { status: 201, body: { html_url: 'https://github.com/a/b/pull/3' } } })
    const url = await createPullRequest(fetchImpl, 't', 'https://github.com/a/b', { head: 'h', base: 'main', title: 'T', body: 'B' })
    assert.equal(url, 'https://github.com/a/b/pull/3')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { head: 'h', base: 'main', title: 'T', body: 'B' })
  })

  it('버전 비교', () => {
    assert.ok(compareVersions('app-v1.2.0', '1.10.0') < 0)
    assert.ok(compareVersions('1.10.0', '1.9.9') > 0)
    assert.equal(compareVersions('1.0', '1.0.0'), 0)
  })

  it('최신 앱 릴리즈: app-v 태그 중 더 높은 것만', async () => {
    const releases = [
      { tag_name: 'app-v1.1.0', html_url: 'u110', draft: false, prerelease: false },
      { tag_name: 'app-v1.3.0', html_url: 'u130', draft: true, prerelease: false },
      { tag_name: 'app-v1.2.0', html_url: 'u120', draft: false, prerelease: false },
      { tag_name: 'v9.0.0', html_url: 'other', draft: false, prerelease: false },
    ]
    const { fetchImpl } = fakeFetch({ 'GET /repos/a/b/releases?per_page=20': { body: releases } })
    assert.deepEqual(await latestAppRelease(fetchImpl, 't', 'https://github.com/a/b', '1.0.0'), {
      current: '1.0.0',
      latest: '1.2.0',
      url: 'u120',
    })
    assert.equal(await latestAppRelease(fetchImpl, 't', 'https://github.com/a/b', '1.2.0'), null)
  })
})
