import assert from 'node:assert/strict'
import { readFileSync, rmSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import * as gitOps from '../git.ts'
import { startGitServer } from './git-server.ts'

const SEED = {
  'manuals/bo/a.md': 'line 1\nline 2\nline 3\n',
  'manuals/bo/b.md': 'b\n',
  'manuals/bo/images/x.png': 'png-bytes',
}

describe('git (isomorphic-git ↔ git http-backend)', () => {
  let server: Awaited<ReturnType<typeof startGitServer>>
  const temp = mkdtempSync(join(tmpdir(), 'ariadne-ws-'))
  let n = 0
  const http = gitOps.makeHttp((url, init) => fetch(url, init))
  const prs: { head: string; base: string; title: string; body: string }[] = []

  before(async () => {
    server = await startGitServer(SEED)
  })
  after(async () => {
    await server.close()
    rmSync(temp, { recursive: true, force: true })
  })

  async function workspace() {
    const ctx: gitOps.GitContext = {
      dir: join(temp, `ws-${n++}`),
      http,
      url: server.url,
      branch: 'main',
      token: 'unused',
      author: { name: 'Planner', email: '1+planner@users.noreply.github.com' },
    }
    await gitOps.clone(ctx)
    return ctx
  }
  const submitOptions = (message: string, mode: 'push' | 'pr' = 'push'): gitOps.SubmitOptions => ({
    message,
    mode,
    login: 'planner',
    now: new Date(2026, 9, 1, 9, 30, n),
    createPullRequest: async (input) => {
      prs.push(input)
      return `https://github.com/example/pull/${prs.length}`
    },
  })
  const read = (ctx: gitOps.GitContext, path: string) => readFileSync(join(ctx.dir, path), 'utf8')
  const write = (ctx: gitOps.GitContext, path: string, text: string) => writeFileSync(join(ctx.dir, path), text)

  it('clone 직후에는 변경이 없다', async () => {
    const ctx = await workspace()
    assert.ok(gitOps.isRepo(ctx.dir))
    assert.equal(read(ctx, 'manuals/bo/b.md'), 'b\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
  })

  it('수정/추가/삭제를 구분하고 되돌린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/a.md', 'changed\n')
    write(ctx, 'manuals/bo/new.md', 'new\n')
    rmSync(join(ctx.dir, 'manuals/bo/b.md'))
    const changes = await gitOps.changes(ctx.dir)
    assert.deepEqual(
      changes.sort((x, y) => x.path.localeCompare(y.path)),
      [
        { path: 'manuals/bo/a.md', status: 'modified' },
        { path: 'manuals/bo/b.md', status: 'deleted' },
        { path: 'manuals/bo/new.md', status: 'added' },
      ],
    )
    await gitOps.revert(ctx.dir, changes.map((c) => c.path))
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal(read(ctx, 'manuals/bo/a.md'), SEED['manuals/bo/a.md'])
    assert.equal(read(ctx, 'manuals/bo/b.md'), 'b\n')
    assert.ok(!existsSync(join(ctx.dir, 'manuals/bo/new.md')))
  })

  it('같은 초에 같은 크기로 고친 파일도 변경으로 잡고 되돌린다 (racy-git)', async () => {
    const ctx = await workspace()
    // clone 직후 같은 초 안에, 같은 길이로 고친다
    write(ctx, 'manuals/bo/b.md', 'X\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/b.md', status: 'modified' }])
    await gitOps.revert(ctx.dir, ['manuals/bo/b.md'])
    assert.equal(read(ctx, 'manuals/bo/b.md'), 'b\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
  })

  it('일부만 되돌린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/a.md', 'keep me\n')
    write(ctx, 'manuals/bo/b.md', 'drop me\n')
    await gitOps.revert(ctx.dir, ['manuals/bo/b.md'])
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/a.md', status: 'modified' }])
    assert.equal(read(ctx, 'manuals/bo/a.md'), 'keep me\n')
  })

  it('변경이 없으면 제출하지 않는다', async () => {
    const ctx = await workspace()
    await assert.rejects(gitOps.submit(ctx, submitOptions('noop')), /제출할 변경이 없습니다/)
  })

  it('push 모드: main에 바로 올린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/b.md', 'b by planner\n')
    const result = await gitOps.submit(ctx, submitOptions('docs: b 수정'))
    assert.equal(result.mode, 'push')
    assert.equal(server.log()[0], 'docs: b 수정')
    assert.equal(server.show('main', 'manuals/bo/b.md'), 'b by planner\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).status, 'synced')
  })

  it('sync: 로컬 변경이 없으면 원격 변경을 fast-forward로 받는다', async () => {
    const ctx = await workspace()
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/c.md'), 'c\n'), 'other adds c')
    const state = await gitOps.sync(ctx)
    assert.equal(state.status, 'synced')
    assert.equal(read(ctx, 'manuals/bo/c.md'), 'c\n')
  })

  it('sync: 로컬 변경이 있으면 받기만 하고 behind로 알린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/a.md', 'line 1\nline 2\nline 3 local\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/d.md'), 'd\n'), 'other adds d')
    const state = await gitOps.sync(ctx)
    assert.equal(state.status, 'behind')
    assert.equal(state.changes, 1)
    assert.ok(!existsSync(join(ctx.dir, 'manuals/bo/d.md')))
    assert.equal(read(ctx, 'manuals/bo/a.md'), 'line 1\nline 2\nline 3 local\n')
  })

  it('push 모드: 다른 사람이 다른 파일을 먼저 올렸으면 합쳐서 올린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/b.md', 'b merged\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/e.md'), 'e\n'), 'other adds e')
    const result = await gitOps.submit(ctx, submitOptions('docs: b 합치기'))
    assert.equal(result.mode, 'push')
    assert.equal(server.show('main', 'manuals/bo/b.md'), 'b merged\n')
    assert.equal(server.show('main', 'manuals/bo/e.md'), 'e\n')
    assert.equal(read(ctx, 'manuals/bo/e.md'), 'e\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).status, 'synced')
  })

  it('push 모드: 같은 줄을 고쳐 충돌하면 브랜치 + PR로 돌리고 로컬 main은 원격으로 맞춘다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/a.md', 'line 1 planner\nline 2\nline 3\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/a.md'), 'line 1 other\nline 2\nline 3\n'), 'other edits a')
    const before = prs.length
    const result = await gitOps.submit(ctx, submitOptions('docs: a 충돌'))
    assert.equal(result.mode, 'pr')
    assert.equal(result.conflict, true)
    assert.equal(prs.length, before + 1)
    const pr = prs.at(-1)!
    assert.match(pr.head, /^ariadne\/planner-20261001-0930\d\d$/)
    assert.equal(pr.base, 'main')
    assert.ok(server.branches().includes(pr.head))
    assert.equal(server.show(pr.head, 'manuals/bo/a.md'), 'line 1 planner\nline 2\nline 3\n')
    assert.equal(server.show('main', 'manuals/bo/a.md'), 'line 1 other\nline 2\nline 3\n')
    // 로컬은 원격 main 상태, 변경 없음
    assert.equal(read(ctx, 'manuals/bo/a.md'), 'line 1 other\nline 2\nline 3\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).status, 'synced')
  })

  it('pr 모드: main은 그대로 두고 브랜치 + PR을 만든다', async () => {
    const ctx = await workspace()
    const mainBefore = server.show('main', 'manuals/bo/b.md')
    write(ctx, 'manuals/bo/b.md', 'b via pr\n')
    const result = await gitOps.submit(ctx, submitOptions('docs: b PR', 'pr'))
    assert.equal(result.mode, 'pr')
    assert.ok(!result.conflict)
    assert.equal(server.show('main', 'manuals/bo/b.md'), mainBefore)
    assert.equal(server.show(prs.at(-1)!.head, 'manuals/bo/b.md'), 'b via pr\n')
  })

  it('지난 제출이 push에서 멈췄으면 남은 커밋을 다시 올린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/b.md', 'b retried\n')
    // 커밋까지만 된 상태를 만든다
    const broken = { ...ctx, url: 'http://127.0.0.1:1/nowhere.git' }
    await assert.rejects(gitOps.submit(broken, submitOptions('docs: retry')))
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).status, 'ahead')
    const result = await gitOps.submit(ctx, submitOptions('ignored'))
    assert.equal(result.mode, 'push')
    assert.equal(server.log()[0], 'docs: retry')
    assert.equal(server.show('main', 'manuals/bo/b.md'), 'b retried\n')
  })

  it('원격에 닿지 않으면 offline', async () => {
    const ctx = await workspace()
    const state = await gitOps.sync({ ...ctx, url: 'http://127.0.0.1:1/nowhere.git' })
    assert.equal(state.status, 'offline')
  })
})
