import assert from 'node:assert/strict'
import { readFileSync, readdirSync, rmSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { after, before, describe, it } from 'node:test'
import git from 'isomorphic-git'
import * as gitOps from '../git.ts'
import { startGitServer } from './git-server.ts'

const SEED = {
  'manuals/bo/a.md': 'line 1\nline 2\nline 3\n',
  'manuals/bo/b.md': 'b\n',
  'manuals/bo/images/x.png': 'png-bytes',
  '.github/workflows/release.yml': 'v1\n',
  'app/code.ts': 'code v1\n',
}
const WORKFLOW = '.github/workflows/release.yml'

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

  it('manuals/ 밖 변경은 목록에 없고, sync가 HEAD 내용으로 되돌린다 (새 파일은 둔다)', async () => {
    const ctx = await workspace()
    write(ctx, 'app/code.ts', 'stale\n')
    rmSync(join(ctx.dir, WORKFLOW))
    write(ctx, 'scratch.txt', 'mine\n')
    write(ctx, 'manuals/bo/b.md', 'b outside test\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/b.md', status: 'modified' }])
    await gitOps.sync(ctx)
    assert.equal(read(ctx, 'app/code.ts'), 'code v1\n')
    assert.equal(read(ctx, WORKFLOW), 'v1\n')
    assert.equal(read(ctx, 'scratch.txt'), 'mine\n')
    assert.equal(read(ctx, 'manuals/bo/b.md'), 'b outside test\n')
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

  it('sync: 고친 것이 있어도 다른 파일의 남 변경은 받아 합친다 (내 수정은 저장만 한 채로 남는다)', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/a.md', 'line 1\nline 2\nline 3 local\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/d.md'), 'd\n'), 'other adds d')
    const state = await gitOps.sync(ctx)
    assert.deepEqual([state.status, state.applied, state.changes], ['synced', true, 1])
    assert.equal(read(ctx, 'manuals/bo/d.md'), 'd\n', '남의 변경이 보인다')
    assert.equal(read(ctx, 'manuals/bo/a.md'), 'line 1\nline 2\nline 3 local\n', '내 수정은 그대로')
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/a.md', status: 'modified' }])
    assert.equal(await gitOps.headContent(ctx.dir, 'manuals/bo/d.md'), 'd\n', '변경 보기 기준도 원격 최신')
    // 고치기 전 내 파일을 남겨 둔다
    const backups = readdirSync(join(ctx.dir, '.capture/sync-backup'))
    assert.equal(read(ctx, `.capture/sync-backup/${backups[0]}/manuals/bo/a.md`), 'line 1\nline 2\nline 3 local\n')
    // 그대로 제출된다
    await gitOps.submit(ctx, submitOptions('docs: a 동기화 뒤 제출'))
    assert.equal(server.show('main', 'manuals/bo/a.md'), 'line 1\nline 2\nline 3 local\n')
  })

  it('sync: 같은 파일의 다른 줄이면 줄 단위로 합친다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/m.md', 'one\ntwo\nthree\nfour\nfive\n')
    await gitOps.submit(ctx, submitOptions('docs: m'))
    write(ctx, 'manuals/bo/m.md', 'one mine\ntwo\nthree\nfour\nfive\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/m.md'), 'one\ntwo\nthree\nfour\nfive theirs\n'), 'other edits m')
    const state = await gitOps.sync(ctx)
    assert.equal(state.applied, true)
    assert.equal(read(ctx, 'manuals/bo/m.md'), 'one mine\ntwo\nthree\nfour\nfive theirs\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/m.md', status: 'modified' }])
  })

  it('sync: 같은 줄을 둘 다 고쳤으면 아무것도 바꾸지 않고 받기만 한다 (내 수정 그대로, 충돌 파일을 알린다)', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/n.md', 'base\n')
    await gitOps.submit(ctx, submitOptions('docs: n'))
    write(ctx, 'manuals/bo/n.md', 'mine\n')
    write(ctx, 'manuals/bo/n2.md', 'only mine\n')
    server.other((dir) => {
      writeFileSync(join(dir, 'manuals/bo/n.md'), 'theirs\n')
      writeFileSync(join(dir, 'manuals/bo/n3.md'), 'theirs other file\n')
    }, 'other edits n')
    const state = await gitOps.sync(ctx)
    assert.equal(state.status, 'behind')
    assert.equal(state.applied, undefined)
    assert.deepEqual(state.conflicts, ['manuals/bo/n.md'])
    assert.match(state.message, /다른 사람도 같은 곳을 고쳐 지금은 받아 오지 못했습니다: n\./)
    assert.equal(read(ctx, 'manuals/bo/n.md'), 'mine\n')
    assert.equal(read(ctx, 'manuals/bo/n2.md'), 'only mine\n')
    assert.ok(!existsSync(join(ctx.dir, 'manuals/bo/n3.md')), '하나라도 겹치면 다른 파일도 받지 않는다')
    assert.ok(!existsSync(join(ctx.dir, '.capture/sync-backup')))
  })

  it('sync: 내 PC에 기록한 것도 원격 위로 옮겨 유지하고, 기록 수와 제출 메시지가 그대로다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/r1.md', 'r1\n')
    await gitOps.record(ctx.dir, ctx.author, 'docs: 기록 1')
    write(ctx, 'manuals/bo/r2.md', 'r2\n')
    await gitOps.record(ctx.dir, ctx.author, 'docs: 기록 2')
    write(ctx, 'manuals/bo/r3.md', 'not recorded\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/o.md'), 'other\n'), 'other adds o')
    const state = await gitOps.sync(ctx)
    assert.deepEqual([state.applied, state.recorded, state.changes], [true, 2, 3])
    assert.equal(read(ctx, 'manuals/bo/o.md'), 'other\n')
    assert.equal(read(ctx, 'manuals/bo/r3.md'), 'not recorded\n')
    assert.deepEqual((await gitOps.changes(ctx.dir)).map((c) => c.path), ['manuals/bo/r1.md', 'manuals/bo/r2.md', 'manuals/bo/r3.md'])
    await gitOps.submit(ctx, submitOptions('docs: 기록 제출'))
    assert.match(server.git('log', '-1', '--format=%B', 'main'), /docs: 기록 제출\n\n기록:\n- docs: 기록 1\n- docs: 기록 2/)
    assert.equal(server.show('main', 'manuals/bo/r3.md'), 'not recorded\n')
  })

  it('sync: Claude 작업 중(mergeLocal: false)이면 받기만 한다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/q.md', 'q\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/q2.md'), 'q2\n'), 'other adds q2')
    const state = await gitOps.sync(ctx, { mergeLocal: false })
    assert.equal(state.status, 'behind')
    assert.ok(!existsSync(join(ctx.dir, 'manuals/bo/q2.md')))
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

  it('push 모드: 같은 파일의 다른 줄을 고쳤으면 줄 단위로 합쳐 올린다', async () => {
    const ctx = await workspace()
    const base = read(ctx, 'manuals/bo/a.md').split('\n')
    write(ctx, 'manuals/bo/a.md', [base[0], base[1], 'line 3 planner', ''].join('\n'))
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/a.md'), ['line 1 merged other', base[1], base[2], ''].join('\n')), 'other edits a line 1')
    const result = await gitOps.submit(ctx, submitOptions('docs: a 3번 줄'))
    assert.equal(result.mode, 'push')
    assert.equal(server.show('main', 'manuals/bo/a.md'), ['line 1 merged other', base[1], 'line 3 planner', ''].join('\n'))
    assert.equal(read(ctx, 'manuals/bo/a.md'), server.show('main', 'manuals/bo/a.md'))
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).status, 'synced')
  })

  it('push 모드: 남아 있던 커밋에 섞인 manuals/ 밖 옛 내용은 올리지 않는다', async () => {
    const ctx = await workspace()
    // 예전 앱이 어긋난 작업 폴더를 통째로 커밋한 상태
    write(ctx, 'app/code.ts', 'stale\n')
    write(ctx, 'manuals/bo/b.md', 'b with stale\n')
    for (const filepath of ['app/code.ts', 'manuals/bo/b.md']) await git.add({ fs, dir: ctx.dir, filepath })
    await git.commit({ fs, dir: ctx.dir, message: 'docs: stale 섞임', author: ctx.author })
    server.other((dir) => writeFileSync(join(dir, 'app/code.ts'), 'code v2\n'), 'other edits code')
    const result = await gitOps.submit(ctx, submitOptions('ignored'))
    assert.equal(result.mode, 'push')
    assert.equal(server.log()[0], 'docs: stale 섞임')
    assert.equal(server.git('diff', '--name-only', 'main^', 'main'), 'manuals/bo/b.md')
    assert.equal(server.show('main', 'app/code.ts'), 'code v2\n')
    assert.equal(read(ctx, 'app/code.ts'), 'code v2\n')
    assert.equal((await gitOps.sync(ctx)).status, 'synced')
  })

  it('push 모드: 같은 줄을 고쳐 충돌하면 원격 main 위에 내 파일만 얹은 브랜치 + PR로 돌리고, 로컬은 내 작업을 둔 채 PR이 머지되면 원격으로 맞춘다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/a.md', 'line 1 planner\nline 2\nline 3\n')
    write(ctx, 'manuals/bo/b.md', 'b with a\n')
    // 그 사이 다른 사람이 workflow도 고쳤다. 옛 workflow를 담은 브랜치는 GitHub가 workflow scope 없는 토큰으로 못 올리게 막는다
    server.other((dir) => {
      writeFileSync(join(dir, 'manuals/bo/a.md'), 'line 1 other\nline 2\nline 3\n')
      writeFileSync(join(dir, WORKFLOW), 'v2\n')
    }, 'other edits a')
    const before = prs.length
    const result = await gitOps.submit(ctx, submitOptions('docs: a 충돌'))
    assert.equal(result.mode, 'pr')
    assert.equal(result.conflict, true)
    assert.equal(prs.length, before + 1)
    const pr = prs.at(-1)!
    assert.match(pr.head, /^ariadne\/planner-20261001-0930\d\d$/)
    assert.equal(pr.base, 'main')
    assert.equal(pr.title, 'docs: a 충돌')
    assert.match(pr.body, /- `manuals\/bo\/a.md`/)
    assert.doesNotMatch(pr.body, /b.md/)
    assert.ok(server.branches().includes(pr.head))
    // 브랜치는 원격 main 바로 위의 커밋 하나이고, 내가 고친 파일만 다르다
    assert.equal(server.git('rev-parse', `${pr.head}^`), server.git('rev-parse', 'main'))
    assert.deepEqual(server.git('diff', '--name-only', 'main', pr.head).split('\n'), ['manuals/bo/a.md', 'manuals/bo/b.md'])
    assert.equal(server.show(pr.head, 'manuals/bo/a.md'), 'line 1 planner\nline 2\nline 3\n')
    assert.equal(server.show(pr.head, WORKFLOW), 'v2\n')
    assert.equal(server.show('main', 'manuals/bo/a.md'), 'line 1 other\nline 2\nline 3\n')
    // 로컬은 내 작업 그대로 (PR 전까지 화면에서 사라지지 않는다)
    assert.equal(read(ctx, 'manuals/bo/a.md'), 'line 1 planner\nline 2\nline 3\n')
    assert.deepEqual((await gitOps.changes(ctx.dir)).map((c) => c.path), ['manuals/bo/a.md', 'manuals/bo/b.md'])
    assert.equal((await gitOps.sync(ctx)).status, 'diverged')
    // 머지 전에 또 제출하면 같은 충돌이 다시 잡혀 PR로 간다 (main에 바로 덮어쓰지 않는다)
    write(ctx, 'manuals/bo/b.md', 'b again\n')
    const again = await gitOps.submit(ctx, { ...submitOptions('docs: 또 제출'), now: new Date(2026, 9, 1, 10, 0, 0) })
    assert.equal(again.mode, 'pr')
    assert.equal(server.show('main', 'manuals/bo/a.md'), 'line 1 other\nline 2\nline 3\n')
    // 개발자가 마지막 PR을 머지하면 sync가 원격으로 맞춘다
    server.git('update-ref', 'refs/heads/main', prs.at(-1)!.head)
    const state = await gitOps.sync(ctx)
    assert.equal(state.status, 'synced')
    assert.equal(state.changes, 0)
    assert.equal(read(ctx, 'manuals/bo/b.md'), 'b again\n')
    assert.equal(read(ctx, WORKFLOW), 'v2\n')
  })

  it('push 모드: isomorphic-git이 못 합치는 히스토리(merge base 여럿)라도 파일이 겹치지 않으면 main에 올린다', async () => {
    const ctx = await workspace()
    const auth = { http, onAuth: () => ({ username: 'x', password: 'unused' }) }
    // 내 커밋 P를 만들고 (push는 실패) 원격 side 브랜치에만 올려 둔다
    write(ctx, 'manuals/bo/b.md', 'b criss\n')
    await assert.rejects(gitOps.submit({ ...ctx, url: 'http://127.0.0.1:1/nowhere.git' }, submitOptions('docs: b')))
    await git.push({ fs, dir: ctx.dir, url: server.url, ref: 'main', remoteRef: 'side', ...auth })
    // 다른 사람 O가 main에 올라간다. 나는 O를 받아 로컬에서 합친다 (push는 못 함)
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/o.md'), 'o\n'), 'other adds o')
    assert.equal((await gitOps.sync(ctx)).status, 'ahead', '다른 파일의 남 변경은 받아 합치고, 내 커밋은 그 위에 남는다')
    await git.merge({ fs, dir: ctx.dir, ours: 'main', theirs: 'origin/main', author: ctx.author, message: 'local merge' })
    await git.checkout({ fs, dir: ctx.dir, ref: 'main', force: true })
    // 다른 사람은 반대로 P를 합친다 → merge base가 P, O 두 개 (criss-cross)
    server.other((dir) => {
      execFileSync('git', ['-C', dir, 'fetch', '-q', 'origin', 'side'])
      execFileSync('git', ['-C', dir, 'merge', '-q', '--no-edit', 'FETCH_HEAD'])
      writeFileSync(join(dir, WORKFLOW), 'v3\n')
    }, 'other merges side')
    write(ctx, 'manuals/bo/criss.md', 'criss\n')
    const result = await gitOps.submit(ctx, submitOptions('docs: criss 추가'))
    assert.equal(result.mode, 'push')
    assert.equal(server.log()[0], 'docs: criss 추가')
    assert.equal(server.git('diff', '--name-only', 'main^', 'main'), 'manuals/bo/criss.md')
    assert.equal(server.show('main', 'manuals/bo/b.md'), 'b criss\n')
    assert.equal(server.show('main', WORKFLOW), 'v3\n')
    assert.equal(read(ctx, WORKFLOW), 'v3\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).status, 'synced')
  })

  it('pr 모드: main은 그대로 두고 원격 main 위에 브랜치 + PR을 만든다', async () => {
    const ctx = await workspace()
    const mainBefore = server.show('main', 'manuals/bo/b.md')
    write(ctx, 'manuals/bo/b.md', 'b via pr\n')
    server.other((dir) => writeFileSync(join(dir, WORKFLOW), 'v4\n'), 'other edits workflow')
    const result = await gitOps.submit(ctx, submitOptions('docs: b PR', 'pr'))
    assert.equal(result.mode, 'pr')
    assert.ok(!result.conflict)
    const head = prs.at(-1)!.head
    assert.equal(server.show('main', 'manuals/bo/b.md'), mainBefore)
    assert.equal(server.show(head, 'manuals/bo/b.md'), 'b via pr\n')
    assert.equal(server.git('rev-parse', `${head}^`), server.git('rev-parse', 'main'))
    assert.equal(server.git('diff', '--name-only', 'main', head), 'manuals/bo/b.md')
    // 머지 전에는 내 작업이 남고 sync가 지우지 않는다
    assert.equal((await gitOps.sync(ctx)).status, 'ahead', '다른 파일의 남 변경은 받아 합치고, 내 커밋은 그 위에 남는다')
    assert.equal(read(ctx, 'manuals/bo/b.md'), 'b via pr\n')
  })

  it('sync: PR로 올린 뒤 작업 폴더를 또 고쳤으면 PR이 머지돼도 원격으로 맞추지 않는다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/b.md', 'b pr then edit\n')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/before-pr.md'), 'x\n'), 'other before pr')
    await gitOps.submit(ctx, submitOptions('docs: b PR 후 수정', 'pr'))
    write(ctx, 'manuals/bo/new-after-pr.md', 'new\n')
    server.git('update-ref', 'refs/heads/main', prs.at(-1)!.head)
    assert.equal((await gitOps.sync(ctx)).status, 'ahead', '다른 파일의 남 변경은 받아 합치고, 내 커밋은 그 위에 남는다')
    assert.equal(read(ctx, 'manuals/bo/new-after-pr.md'), 'new\n')
    const result = await gitOps.submit(ctx, submitOptions('docs: 이어서'))
    assert.equal(result.mode, 'push')
    assert.equal(server.git('diff', '--name-only', 'main^', 'main'), 'manuals/bo/new-after-pr.md')
  })

  it('지난 제출이 push에서 멈췄으면 남은 커밋을 다시 올린다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/b.md', 'b retried\n')
    // 커밋까지만 된 상태를 만든다
    const broken = { ...ctx, url: 'http://127.0.0.1:1/nowhere.git' }
    await assert.rejects(gitOps.submit(broken, submitOptions('docs: retry')))
    // 커밋만 된 변경도 제출 전이므로 변경 목록에 보인다
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/b.md', status: 'modified' }])
    const state = await gitOps.sync(ctx)
    assert.equal(state.status, 'ahead')
    assert.equal(state.recorded, 0, '기록(커밋만)이 아니라 멈춘 제출')
    const result = await gitOps.submit(ctx, submitOptions('ignored'))
    assert.equal(result.mode, 'push')
    assert.equal(server.log()[0], 'docs: retry')
    assert.equal(server.show('main', 'manuals/bo/b.md'), 'b retried\n')
  })

  it('내 PC에 기록만: 변경 목록·변경 보기는 마지막 제출 기준, 제출하면 기록을 묶어 한 커밋으로', async () => {
    const ctx = await workspace()
    const before = read(ctx, 'manuals/bo/b.md')
    write(ctx, 'manuals/bo/b.md', 'b recorded\n')
    write(ctx, 'manuals/bo/rec.md', 'rec 1\n')
    // 원격에 연결하지 않는다 (오프라인에서도 된다)
    const first = await gitOps.record(ctx.dir, ctx.author, 'docs: 1차 기록')
    assert.equal(first.recorded, 1)
    assert.deepEqual(await gitOps.changes(ctx.dir), [
      { path: 'manuals/bo/b.md', status: 'modified' },
      { path: 'manuals/bo/rec.md', status: 'added' },
    ])
    assert.equal(await gitOps.headContent(ctx.dir, 'manuals/bo/b.md'), before, '변경 보기의 전 내용은 마지막 제출 상태')
    assert.equal(await gitOps.headContent(ctx.dir, 'manuals/bo/rec.md'), null)
    await assert.rejects(gitOps.record(ctx.dir, ctx.author, 'x'), /기록할 새 변경이 없습니다/)
    write(ctx, 'manuals/bo/rec.md', 'rec 2\n')
    assert.equal((await gitOps.record(ctx.dir, ctx.author, 'docs: 2차 기록')).recorded, 2)
    const state = await gitOps.sync(ctx)
    assert.deepEqual([state.status, state.recorded, state.changes], ['ahead', 2, 2])

    const result = await gitOps.submit(ctx, submitOptions('docs: 기록 제출'))
    assert.equal(result.mode, 'push')
    assert.equal(server.log()[0], 'docs: 기록 제출')
    assert.match(server.git('log', '-1', '--format=%B', 'main'), /docs: 기록 제출\n\n기록:\n- docs: 1차 기록\n- docs: 2차 기록/)
    assert.equal(server.show('main', 'manuals/bo/rec.md'), 'rec 2\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    assert.equal((await gitOps.sync(ctx)).recorded, 0)
  })

  it('기록한 뒤 되돌리기: 마지막 제출 상태로. 다 되돌리면 기록도 정리한다', async () => {
    const ctx = await workspace()
    const before = read(ctx, 'manuals/bo/b.md')
    write(ctx, 'manuals/bo/b.md', 'b to drop\n')
    write(ctx, 'manuals/bo/keep.md', 'keep\n')
    await gitOps.record(ctx.dir, ctx.author, 'docs: 기록')
    write(ctx, 'manuals/bo/later.md', 'later\n')
    await gitOps.revert(ctx.dir, ['manuals/bo/b.md'])
    assert.equal(read(ctx, 'manuals/bo/b.md'), before)
    assert.deepEqual((await gitOps.changes(ctx.dir)).map((c) => c.path), ['manuals/bo/keep.md', 'manuals/bo/later.md'])
    await gitOps.revert(ctx.dir, ['manuals/bo/keep.md', 'manuals/bo/later.md'])
    assert.ok(!existsSync(join(ctx.dir, 'manuals/bo/keep.md')))
    assert.ok(!existsSync(join(ctx.dir, 'manuals/bo/later.md')))
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
    const state = await gitOps.sync(ctx)
    assert.deepEqual([state.status, state.recorded], ['synced', 0], '빈 기록은 정리된다')
  })

  it('기록한 뒤 다른 사람이 올렸으면: 남의 변경은 내 변경에 안 섞이고, 제출할 때 합친다', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/mine.md', 'mine\n')
    await gitOps.record(ctx.dir, ctx.author, 'docs: 내 기록')
    server.other((dir) => writeFileSync(join(dir, 'manuals/bo/theirs.md'), 'theirs\n'), 'other adds theirs')
    const state = await gitOps.sync(ctx)
    assert.equal(state.status, 'ahead', '남의 변경을 받아 합치고 기록은 그 위로')
    assert.deepEqual(await gitOps.changes(ctx.dir), [{ path: 'manuals/bo/mine.md', status: 'added' }])
    await gitOps.submit(ctx, submitOptions('docs: mine 제출'))
    assert.equal(server.show('main', 'manuals/bo/mine.md'), 'mine\n')
    assert.equal(server.show('main', 'manuals/bo/theirs.md'), 'theirs\n')
    assert.equal(read(ctx, 'manuals/bo/theirs.md'), 'theirs\n')
    assert.deepEqual(await gitOps.changes(ctx.dir), [])
  })

  it('HEAD 내용 읽기 (변경 보기)', async () => {
    const ctx = await workspace()
    write(ctx, 'manuals/bo/b.md', 'changed\n')
    assert.notEqual(await gitOps.headContent(ctx.dir, 'manuals/bo/b.md'), 'changed\n')
    assert.equal(await gitOps.headContent(ctx.dir, 'manuals/bo/none.md'), null)
  })

  it('원격에 닿지 않으면 offline', async () => {
    const ctx = await workspace()
    const state = await gitOps.sync({ ...ctx, url: 'http://127.0.0.1:1/nowhere.git' })
    assert.equal(state.status, 'offline')
  })
})
