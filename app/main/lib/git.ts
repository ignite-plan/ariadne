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

interface FileEntry {
  mode: number
  oid: string
  type: 'blob' | 'commit'
}

// 커밋 트리의 파일(경로 → mode·oid). 디렉토리는 빠진다
async function treeFiles(dir: string, ref: string) {
  const files = new Map<string, FileEntry>()
  await git.walk({
    fs,
    dir,
    trees: [git.TREE({ ref })],
    map: async (filepath, [entry]) => {
      const type = entry && (await entry.type())
      if (type === 'blob' || type === 'commit') files.set(filepath, { mode: await entry!.mode(), oid: await entry!.oid(), type })
      return true
    },
  })
  return files
}

// 파일 목록으로 트리를 써서 루트 트리 oid를 돌려준다
async function writeFiles(dir: string, files: Map<string, FileEntry>) {
  type Node = Map<string, FileEntry | Node>
  const root: Node = new Map()
  for (const [path, entry] of files) {
    const parts = path.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      let next = node.get(part)
      if (!(next instanceof Map)) node.set(part, (next = new Map()))
      node = next
    }
    node.set(parts.at(-1)!, entry)
  }
  const write = async (node: Node): Promise<string> =>
    git.writeTree({
      fs,
      dir,
      tree: await Promise.all(
        [...node].map(async ([path, entry]) =>
          entry instanceof Map ? { path, mode: '040000', oid: await write(entry), type: 'tree' as const } : { path, mode: entry.mode.toString(8), oid: entry.oid, type: entry.type },
        ),
      ),
    })
  return write(root)
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
    const head = await treeFiles(dir, 'HEAD')
    for (const path of racy) {
      const { oid } = await git.hashBlob({ object: fs.readFileSync(join(dir, path)) })
      if (oid !== head.get(path)?.oid) result.push({ path, status: 'modified' })
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

// 마지막 커밋(HEAD)의 파일 내용. 없으면 null
export async function headContent(dir: string, filepath: string) {
  try {
    const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    const { blob } = await git.readBlob({ fs, dir, oid: head, filepath })
    return Buffer.from(blob).toString('utf8')
  } catch {
    return null
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

// 원격 main 위에 내 커밋이 바꾼 파일만 얹은 커밋을 만든다 (브랜치는 옮기지 않는다).
// 갈라진 내 커밋을 그대로 브랜치로 올리면 그 사이 남이 바꾼 파일을 옛 내용으로 되돌리는 브랜치가 된다.
// 그중 .github/workflows가 있으면 GitHub가 workflow scope 없는 토큰의 push를 거절한다.
// 파일 단위로 비교하므로 isomorphic-git이 못 합치는 히스토리(merge base가 여럿)도 처리한다.
// 내가 바꾼 파일을 남도 바꿨으면 conflicts에 담는다 (내 내용으로 덮어쓴다). 얹을 게 없으면 oid가 없다
async function rebuild(ctx: GitContext, local: string, upstream: string) {
  const { dir } = ctx
  const bases = await git.findMergeBase({ fs, dir, oids: [local, upstream] })
  const [mine, theirs, ...olds] = await Promise.all([local, upstream, ...bases].map((ref: string) => treeFiles(dir, ref)))
  // merge base 어느 것과도 다르면 그쪽에서 바꾼 것이다
  const changed = (path: string, oid?: string) => olds.every((old) => old.get(path)?.oid !== oid)
  const files = new Map(theirs)
  const conflicts: string[] = []
  for (const path of new Set([...mine.keys(), ...theirs.keys()])) {
    const ours = mine.get(path)
    if (ours?.oid === theirs.get(path)?.oid || !changed(path, ours?.oid)) continue
    if (changed(path, theirs.get(path)?.oid)) conflicts.push(path)
    if (ours) files.set(path, ours)
    else files.delete(path)
  }
  const tree = await writeFiles(dir, files)
  if (tree === (await git.readCommit({ fs, dir, oid: upstream })).commit.tree) return { conflicts }
  const { message } = (await git.readCommit({ fs, dir, oid: local })).commit
  const oid = await git.commit({ fs, dir, message, author: ctx.author, tree, parent: [upstream], noUpdateBranch: true })
  return { oid, conflicts: conflicts.sort() }
}

// 변경을 커밋하고 원격에 올린다.
// push 모드: 원격이 앞서 있으면 합친 뒤 push. 합치지 못하면 원격 main 위에 내가 바꾼 파일만 얹어 push하고,
//   그 파일을 남도 바꿨으면 그 커밋을 브랜치 + PR로 돌린다
// pr 모드: 원격 main 위에 내가 바꾼 파일만 얹은 커밋으로 브랜치 + PR
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

  // 로컬 main을 옮기고 작업 폴더를 맞춘다
  const moveTo = async (value: string) => {
    await git.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value, force: true })
    await git.checkout({ fs, dir, ref: branch, force: true })
  }

  const toPullRequest = async (rebuilt: string, conflicts: string[]): Promise<SubmitResult> => {
    const head = `ariadne/${options.login}-${stamp(options.now ?? new Date())}`
    await git.branch({ fs, dir, ref: head, object: rebuilt })
    await git.push({ fs, dir, url: ctx.url, ref: head, remoteRef: head, ...auth(ctx) })
    const title = (await git.readCommit({ fs, dir, oid: rebuilt })).commit.message.split('\n')[0]
    const body = conflicts.length
      ? [
          '다른 사람도 고친 파일이라 자동으로 합치지 못했습니다. 이 PR은 아래 파일을 기획자 내용으로 바꿉니다.',
          '다른 사람의 변경이 사라지지 않게 합친 뒤 merge 해 주세요.',
          '',
          ...conflicts.map((path) => `- \`${path}\``),
          '',
          '_Ariadne에서 제출_',
        ].join('\n')
      : '_Ariadne에서 제출_'
    const url = await options.createPullRequest({ head, base: branch, title, body })
    // 로컬 main을 원격 main으로 되돌려 다음 sync가 막히지 않게 한다
    await moveTo((await oid(dir, upstreamRef))!)
    return { mode: 'pr', commit: rebuilt, url, conflict: conflicts.length > 0 }
  }

  if (options.mode === 'pr') {
    const { oid: rebuilt, conflicts } = await rebuild(ctx, commit, (await oid(dir, upstreamRef))!)
    if (!rebuilt) throw new Error('제출할 변경이 없습니다')
    return toPullRequest(rebuilt, conflicts)
  }

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
        if (!(error instanceof Errors.MergeConflictError || error instanceof Errors.MergeNotSupportedError)) throw error
        const { oid: rebuilt, conflicts } = await rebuild(ctx, local, upstream)
        // 내 변경이 이미 원격에 다 들어가 있다
        if (!rebuilt) {
          await moveTo(upstream)
          return { mode: 'push', commit: upstream }
        }
        if (conflicts.length) return toPullRequest(rebuilt, conflicts)
        await moveTo(rebuilt)
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
