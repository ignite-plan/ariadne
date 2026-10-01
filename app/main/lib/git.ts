// 기획자 PC에 git(Xcode CLT)이 없어도 되도록 isomorphic-git으로 clone/sync/submit 한다.
// http 클라이언트는 주입한다: 앱은 Electron net.fetch(사내망 인증서), 테스트는 Node fetch
import fs from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import git, { Errors, type HttpClient } from 'isomorphic-git'
import type { ChangeStatus, SubmitResult, SyncState } from '../../shared/api.ts'

export interface GitContext {
  dir: string
  http: HttpClient
  url: string
  branch: string
  token: string
  author: { name: string; email: string }
  onProgress?: (progress: { phase: string; loaded: number; total?: number }) => void
}

// fetch 계열 함수로 isomorphic-git http 클라이언트를 만든다
export function makeHttp(fetchImpl: (url: string, init: RequestInit) => Promise<Response>): HttpClient {
  return {
    async request({ url, method = 'GET', headers = {}, body }) {
      let payload: Uint8Array<ArrayBuffer> | undefined
      if (body) {
        const chunks: Uint8Array[] = []
        for await (const chunk of body) chunks.push(chunk)
        payload = new Uint8Array(Buffer.concat(chunks))
      }
      const res = await fetchImpl(url, { method, headers, body: payload })
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        resHeaders[key] = value
      })
      const data = new Uint8Array(await res.arrayBuffer())
      return {
        url: res.url || url,
        method,
        statusCode: res.status,
        statusMessage: res.statusText,
        headers: resHeaders,
        body: (async function* () {
          yield data
        })(),
      }
    },
  }
}

const remote = 'origin'

function auth(ctx: GitContext) {
  return {
    http: ctx.http,
    onAuth: () => ({ username: 'x-access-token', password: ctx.token }),
    onAuthFailure: () => {
      throw new Error('GitHub 인증 실패. 토큰 권한(Contents 읽기/쓰기)과 만료일을 확인하세요')
    },
  }
}

export function isRepo(dir: string) {
  return fs.existsSync(join(dir, '.git'))
}

export async function clone(ctx: GitContext) {
  await git.clone({
    fs,
    dir: ctx.dir,
    url: ctx.url,
    ref: ctx.branch,
    singleBranch: true,
    onProgress: ctx.onProgress,
    ...auth(ctx),
  })
}

export interface Change {
  path: string
  status: ChangeStatus
}

const seconds = (ms: number) => Math.floor(ms / 1000)

// HEAD 트리의 파일별 blob oid
async function headBlobs(dir: string) {
  const blobs = new Map<string, string>()
  await git.walk({
    fs,
    dir,
    trees: [git.TREE({ ref: 'HEAD' })],
    map: async (filepath, [entry]) => {
      if (entry && (await entry.type()) === 'blob') blobs.set(filepath, await entry.oid())
      return true
    },
  })
  return blobs
}

// HEAD 대비 작업 폴더 변경. .gitignore 대상은 빠진다
export async function changes(dir: string): Promise<Change[]> {
  const matrix = await git.statusMatrix({ fs, dir })
  const result: Change[] = []
  // isomorphic-git은 mtime(초)과 크기만 비교한다. index를 쓴 같은 초에 같은 크기로 고친 파일은
  // 바뀌지 않은 것으로 보인다 (git의 racy-git). 그런 파일은 내용 해시로 다시 확인한다
  const indexTime = seconds(fs.statSync(join(dir, '.git', 'index')).mtimeMs)
  const racy: string[] = []
  for (const [path, head, workdir] of matrix) {
    if (head === 0 && workdir === 2) result.push({ path, status: 'added' })
    else if (head === 1 && workdir === 0) result.push({ path, status: 'deleted' })
    else if (head === 1 && workdir === 2) result.push({ path, status: 'modified' })
    else if (head === 1 && workdir === 1) {
      const stat = fs.statSync(join(dir, path), { throwIfNoEntry: false })
      if (stat && seconds(stat.mtimeMs) >= indexTime) racy.push(path)
    }
  }
  if (racy.length) {
    const blobs = await headBlobs(dir)
    for (const path of racy) {
      const { oid } = await git.hashBlob({ object: fs.readFileSync(join(dir, path)) })
      if (oid !== blobs.get(path)) result.push({ path, status: 'modified' })
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path))
}

// 변경을 버리고 HEAD 상태로 되돌린다. 새로 만든 파일은 지운다
export async function revert(dir: string, paths: string[]) {
  const current = new Map((await changes(dir)).map((c) => [c.path, c.status]))
  const tracked = paths.filter((p) => current.get(p) === 'modified' || current.get(p) === 'deleted')
  for (const p of paths.filter((p) => current.get(p) === 'added')) {
    await rm(join(dir, p), { force: true })
    await git.remove({ fs, dir, filepath: p }).catch(() => {})
  }
  // checkout은 stat이 같아 보이는 파일을 건너뛸 수 있어(racy) HEAD 내용을 직접 쓴다
  const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  for (const p of tracked) {
    const { blob } = await git.readBlob({ fs, dir, oid: head, filepath: p })
    await mkdir(dirname(join(dir, p)), { recursive: true })
    await writeFile(join(dir, p), blob)
  }
}

async function oid(dir: string, ref: string) {
  return git.resolveRef({ fs, dir, ref }).catch(() => undefined)
}

async function relation(dir: string, local: string, upstream: string): Promise<SyncState['status']> {
  if (local === upstream) return 'synced'
  if (await git.isDescendent({ fs, dir, oid: local, ancestor: upstream, depth: -1 })) return 'ahead'
  if (await git.isDescendent({ fs, dir, oid: upstream, ancestor: local, depth: -1 })) return 'behind'
  return 'diverged'
}

async function fetchRemote(ctx: GitContext) {
  await git.fetch({ fs, dir: ctx.dir, url: ctx.url, remote, ref: ctx.branch, singleBranch: true, ...auth(ctx) })
}

// 원격을 받아 온다. 작업 중인 변경이 없으면 fast-forward까지 한다
export async function sync(ctx: GitContext): Promise<SyncState> {
  try {
    await fetchRemote(ctx)
  } catch (error) {
    const pending = (await changes(ctx.dir)).length
    return { status: 'offline', changes: pending, message: `원격에 연결하지 못했습니다: ${(error as Error).message}` }
  }
  const pending = await changes(ctx.dir)
  const local = (await oid(ctx.dir, ctx.branch))!
  const upstream = (await oid(ctx.dir, `refs/remotes/${remote}/${ctx.branch}`))!
  let status = await relation(ctx.dir, local, upstream)
  if (status === 'behind' && !pending.length) {
    await git.merge({ fs, dir: ctx.dir, ours: ctx.branch, theirs: `${remote}/${ctx.branch}`, fastForwardOnly: true })
    await git.checkout({ fs, dir: ctx.dir, ref: ctx.branch })
    status = 'synced'
  }
  const message = {
    synced: '최신 상태입니다',
    behind: '다른 사람의 변경이 있습니다. 제출할 때 함께 합칩니다',
    ahead: '아직 올리지 못한 커밋이 있습니다',
    diverged: '다른 사람의 변경과 갈라졌습니다. 제출할 때 합칩니다',
    offline: '',
  }[status]
  return { status, changes: pending.length, message }
}

async function stageAll(dir: string) {
  for (const change of await changes(dir)) {
    if (change.status === 'deleted') await git.remove({ fs, dir, filepath: change.path })
    else await git.add({ fs, dir, filepath: change.path })
  }
}

export interface SubmitOptions {
  message: string
  mode: 'push' | 'pr'
  // PR 모드이거나 충돌일 때 호출한다. PR URL을 돌려준다
  createPullRequest: (input: { head: string; base: string; title: string; body: string }) => Promise<string>
  // PR 브랜치 이름에 쓴다
  login: string
  now?: Date
}

function stamp(now: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

// 변경을 커밋하고 원격에 올린다.
// push 모드: 원격이 앞서 있으면 합친 뒤 push. 합치다 충돌하면 브랜치 + PR로 돌린다
// pr 모드: 브랜치 + PR
// 브랜치로 올린 경우 로컬 main은 원격 main으로 되돌린다 (변경은 PR에 있다)
export async function submit(ctx: GitContext, options: SubmitOptions): Promise<SubmitResult> {
  const { dir, branch } = ctx
  const upstreamRef = `refs/remotes/${remote}/${branch}`
  // 지난 제출이 push 단계에서 실패했으면 커밋만 남아 있다. 변경이 없어도 그 커밋을 올린다
  let commit: string
  if ((await changes(dir)).length) {
    await stageAll(dir)
    commit = await git.commit({ fs, dir, message: options.message, author: ctx.author })
  } else {
    commit = (await oid(dir, branch))!
  }
  await fetchRemote(ctx)
  const initial = await relation(dir, commit, (await oid(dir, upstreamRef))!)
  if (initial === 'synced' || initial === 'behind') throw new Error('제출할 변경이 없습니다')

  const toPullRequest = async (conflict: boolean): Promise<SubmitResult> => {
    const head = `ariadne/${options.login}-${stamp(options.now ?? new Date())}`
    await git.branch({ fs, dir, ref: head, object: commit })
    await git.push({ fs, dir, url: ctx.url, ref: head, remoteRef: head, ...auth(ctx) })
    const title = options.message.split('\n')[0]
    const body = conflict
      ? '다른 사람의 변경과 같은 곳을 고쳐 자동으로 합치지 못했습니다. 충돌을 해결한 뒤 merge 해 주세요.\n\n_Ariadne에서 제출_'
      : '_Ariadne에서 제출_'
    const url = await options.createPullRequest({ head, base: branch, title, body })
    // 로컬 main을 원격 main으로 되돌려 다음 sync가 막히지 않게 한다
    const upstream = (await oid(dir, upstreamRef))!
    await git.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: upstream, force: true })
    await git.checkout({ fs, dir, ref: branch, force: true })
    return { mode: 'pr', commit, url, conflict }
  }

  if (options.mode === 'pr') return toPullRequest(false)

  // push 사이에 다른 사람이 먼저 올리면 거절된다. 한 번 더 받아서 합친 뒤 다시 올린다
  for (let attempt = 0; ; attempt++) {
    const local = (await oid(dir, branch))!
    const upstream = (await oid(dir, upstreamRef))!
    if ((await relation(dir, local, upstream)) === 'diverged') {
      try {
        await git.merge({
          fs,
          dir,
          ours: branch,
          theirs: `${remote}/${branch}`,
          author: ctx.author,
          message: `Merge ${remote}/${branch}`,
        })
        await git.checkout({ fs, dir, ref: branch, force: true })
      } catch (error) {
        if (error instanceof Errors.MergeConflictError || error instanceof Errors.MergeNotSupportedError) {
          return toPullRequest(true)
        }
        throw error
      }
    }
    try {
      const pushed = await git.push({ fs, dir, url: ctx.url, ref: branch, remoteRef: branch, ...auth(ctx) })
      if (!pushed.ok) throw new Error(`push 실패: ${pushed.error ?? JSON.stringify(pushed.refs)}`)
    } catch (error) {
      if (error instanceof Errors.PushRejectedError && attempt === 0) {
        await fetchRemote(ctx)
        continue
      }
      throw error
    }
    // remote tracking ref를 맞춰 둔다
    const head = (await oid(dir, branch))!
    await git.writeRef({ fs, dir, ref: upstreamRef, value: head, force: true })
    return { mode: 'push', commit: head }
  }
}
