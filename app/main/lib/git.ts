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

// 기획자가 고치는 곳. 변경 목록·제출은 이 아래만 본다.
// 작업 폴더가 HEAD와 어긋나면(받아 오다 checkout이 멈춘 경우 등) 앱 코드·문서의 옛 내용이 변경으로 잡혀
// 제출에 섞이고, 다른 사람의 변경을 되돌린다
const OWNED = 'manuals/'
const owned = (path: string) => path.startsWith(OWNED)

// "내 PC에 기록"(커밋만)한 커밋에 붙이는 표식. 제출할 때 이 기록들을 묶어 한 커밋으로 올린다
const RECORD_TRAILER = 'Ariadne-Record: true'

// 마지막으로 제출된 상태: 원격 main과 갈라진 지점. 기록만 한 커밋은 그 뒤에 있다.
// 원격을 아직 받지 않았거나 HEAD가 원격과 같으면 HEAD
async function baseCommit(dir: string) {
  const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  const branch = (await git.currentBranch({ fs, dir })) ?? 'main'
  const upstream = await oid(dir, `refs/remotes/${remote}/${branch}`)
  if (!upstream || upstream === head) return head
  const [base] = await git.findMergeBase({ fs, dir, oids: [head, upstream] })
  return base ?? head
}

// 지금 작업 폴더 파일의 blob oid. 없으면 undefined
async function workdirOid(dir: string, path: string) {
  const file = join(dir, path)
  if (!fs.existsSync(file)) return undefined
  return (await git.hashBlob({ object: fs.readFileSync(file) })).oid
}

// 마지막 제출 상태 대비 작업 폴더 변경 (manuals/ 아래만). 기록만 하고 제출하지 않은 변경도 들어간다
export async function changes(dir: string): Promise<Change[]> {
  const work = (await workdirChanges(dir)).filter((c) => owned(c.path))
  const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  const base = await baseCommit(dir)
  if (base === head) return work
  const [baseFiles, headFiles] = await Promise.all([treeFiles(dir, base), treeFiles(dir, head)])
  const candidates = new Set(work.map((c) => c.path))
  for (const path of new Set([...baseFiles.keys(), ...headFiles.keys()])) {
    if (owned(path) && baseFiles.get(path)?.oid !== headFiles.get(path)?.oid) candidates.add(path)
  }
  const result: Change[] = []
  for (const path of candidates) {
    const before = baseFiles.get(path)?.oid
    const now = await workdirOid(dir, path)
    if (before === now) continue
    result.push({ path, status: !before ? 'added' : !now ? 'deleted' : 'modified' })
  }
  return result.sort((a, b) => a.path.localeCompare(b.path))
}

// 기록만 하고 아직 제출하지 않은 커밋 (최근 것부터)
async function recordedCommits(dir: string) {
  const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  const base = await baseCommit(dir)
  if (base === head) return []
  const log = await git.log({ fs, dir, ref: head })
  const result: { oid: string; message: string }[] = []
  for (const entry of log) {
    if (entry.oid === base) break
    // 동기화하면서 여러 기록을 한 커밋으로 옮긴 것은 줄마다 기록 하나
    if (entry.commit.message.includes(RECORD_TRAILER)) {
      // 한 커밋 안은 오래된 것부터 적혀 있다. 이 목록은 최근 것부터
      for (const line of entry.commit.message.replace(RECORD_TRAILER, '').trim().split('\n').filter((l) => l.trim()).reverse()) {
        result.push({ oid: entry.oid, message: line.trim() })
      }
    }
  }
  return result
}

// 제출하지 않고 내 PC에만 커밋한다 (원격에 연결하지 않는다). 기록할 새 변경이 없으면 오류
export async function record(dir: string, author: GitContext['author'], message: string) {
  if (!(await stageAll(dir))) throw new Error('기록할 새 변경이 없습니다')
  // 기록 하나는 한 줄 (동기화할 때 여러 기록을 한 커밋에 줄마다 옮긴다)
  const line = message.replace(/\s+/g, ' ').trim() || 'docs: 매뉴얼 수정'
  const commit = await git.commit({ fs, dir, message: `${line}\n\n${RECORD_TRAILER}`, author })
  return { commit, recorded: (await recordedCommits(dir)).length }
}

export async function recordedCount(dir: string) {
  return (await recordedCommits(dir)).length
}

// HEAD 대비 작업 폴더 변경 전체. .gitignore 대상은 빠진다
async function workdirChanges(dir: string): Promise<Change[]> {
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

// 변경을 버리고 마지막으로 제출된 상태로 되돌린다 (기록만 한 변경도). 새로 만든 파일은 지운다.
// 다 되돌려 남은 변경이 없으면 기록만 한 커밋도 정리한다 (브랜치를 제출 상태로)
export async function revert(dir: string, paths: string[]) {
  const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  const base = await baseCommit(dir)
  if (base === head) return revertToHead(dir, paths)
  const baseFiles = await treeFiles(dir, base)
  for (const p of paths) {
    const entry = baseFiles.get(p)
    if (!entry) {
      await rm(join(dir, p), { force: true })
      continue
    }
    const { blob } = await git.readBlob({ fs, dir, oid: entry.oid })
    await mkdir(dirname(join(dir, p)), { recursive: true })
    await writeFile(join(dir, p), blob)
  }
  if (!(await changes(dir)).length) {
    const branch = (await git.currentBranch({ fs, dir })) ?? 'main'
    await git.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: base, force: true })
    await git.checkout({ fs, dir, ref: branch, force: true })
  }
}

// HEAD 상태로 되돌린다 (기록이 없을 때, manuals/ 밖 정리)
async function revertToHead(dir: string, paths: string[]) {
  const current = new Map((await workdirChanges(dir)).map((c) => [c.path, c.status]))
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

// 마지막으로 제출된 상태의 파일 내용 (변경 보기의 "전"). 없으면 null
export async function headContent(dir: string, filepath: string) {
  try {
    const base = await baseCommit(dir)
    const { blob } = await git.readBlob({ fs, dir, oid: base, filepath })
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

// manuals/ 밖에서 고쳐지거나 지워진 파일을 HEAD 내용으로 되돌린다. 기획자는 거기를 고치지 않는다.
// 새로 생긴 파일은 둔다 (제출에 들어가지 않는다)
async function restoreOutside(dir: string) {
  const stray = (await workdirChanges(dir)).filter((c) => !owned(c.path) && c.status !== 'added')
  if (stray.length) await revertToHead(dir, stray.map((c) => c.path))
}

// 원격을 받아 온다. 작업 중인 변경이 없으면 fast-forward까지 한다
// ours 커밋과 원격을 줄 단위로 합쳐 본다 (작업 폴더·브랜치는 건드리지 않는다). 합치면 커밋 oid, 같은 줄이 겹치면 그 파일들
async function tryMerge(ctx: GitContext, ours: string, theirsRef: string): Promise<{ oid?: string; conflicts?: string[] }> {
  const { dir } = ctx
  const temp = 'refs/heads/ariadne-sync'
  await git.writeRef({ fs, dir, ref: temp, value: ours, force: true })
  try {
    const result = await git.merge({ fs, dir, ours: temp, theirs: theirsRef, author: ctx.author, message: 'Ariadne sync', abortOnConflict: true })
    return { oid: result.oid }
  } catch (error) {
    if (error instanceof Errors.MergeConflictError) return { conflicts: error.data.filepaths }
    if (error instanceof Errors.MergeNotSupportedError) return { conflicts: [] }
    throw error
  } finally {
    await git.deleteRef({ fs, dir, ref: temp }).catch(() => {})
  }
}

// HEAD 트리에 작업 폴더의 manuals/ 변경을 얹은 임시 커밋 (브랜치는 옮기지 않는다)
async function commitWorkdir(ctx: GitContext, head: string, work: Change[]) {
  const { dir } = ctx
  const files = await treeFiles(dir, head)
  for (const change of work) {
    if (change.status === 'deleted') {
      files.delete(change.path)
      continue
    }
    const oid = await git.writeBlob({ fs, dir, blob: fs.readFileSync(join(dir, change.path)) })
    files.set(change.path, { mode: files.get(change.path)?.mode ?? 0o100644, oid, type: 'blob' })
  }
  const tree = await writeFiles(dir, files)
  return git.commit({ fs, dir, message: 'Ariadne sync (작업 폴더)', author: ctx.author, tree, parent: [head], noUpdateBranch: true })
}

// 고친 것(저장·기록)이 있어도 다른 사람의 변경을 받아 합친다.
// 메모리(git 객체)에서 먼저 다 합쳐 보고, 하나라도 같은 줄이 겹치면 아무것도 바꾸지 않고 그 파일들을 돌려준다.
// 다 합쳐지면: 내가 고친 파일을 .capture/sync-backup에 복사해 두고, 브랜치를 원격 위로(기록은 한 커밋으로 옮김) 옮긴 뒤
// 합친 내 변경을 작업 폴더에 다시 쓴다 (저장만 한 변경은 저장만 한 채로 남는다)
async function syncLocal(ctx: GitContext, local: string, upstream: string): Promise<{ applied: boolean; conflicts: string[] }> {
  const { dir } = ctx
  const upstreamRef = `refs/remotes/${remote}/${ctx.branch}`
  const bases = await git.findMergeBase({ fs, dir, oids: [local, upstream] })
  if (bases.length !== 1) return { applied: false, conflicts: [] }
  const work = (await workdirChanges(dir)).filter((c) => owned(c.path))

  // 1) 커밋해 둔 내 변경(기록, PR로 올린 커밋)을 원격 위로 (합친 커밋)
  let committed: string | undefined
  if (local !== bases[0]) {
    const merged = await tryMerge(ctx, local, upstreamRef)
    if (!merged.oid) return { applied: false, conflicts: merged.conflicts ?? [] }
    committed = merged.oid
  }
  // 2) 저장만 한 변경까지 합친 최종 모습 (합친 커밋)
  let full = committed
  if (work.length) {
    const merged = await tryMerge(ctx, await commitWorkdir(ctx, local, work), upstreamRef)
    if (!merged.oid) return { applied: false, conflicts: merged.conflicts ?? [] }
    full = merged.oid
  }

  // 쓰기 전에 내가 고친 파일을 남긴다 (도중에 앱이 꺼져도 되살릴 수 있게)
  const backup = join(dir, '.capture', 'sync-backup', stamp(new Date()))
  for (const change of work.filter((c) => c.status !== 'deleted')) {
    fs.mkdirSync(dirname(join(backup, change.path)), { recursive: true })
    fs.copyFileSync(join(dir, change.path), join(backup, change.path))
  }

  // 브랜치: 원격 위에 (커밋해 둔 변경이 있으면) 한 커밋으로
  let head = upstream
  if (committed) {
    const records = await recordedCommits(dir)
    const message = records.length
      ? `${records.reverse().map((r) => r.message).join('\n')}\n\n${RECORD_TRAILER}`
      : (await git.readCommit({ fs, dir, oid: local })).commit.message
    const tree = (await git.readCommit({ fs, dir, oid: committed })).commit.tree
    head = await git.commit({ fs, dir, message, author: ctx.author, tree, parent: [upstream], noUpdateBranch: true })
  }
  await git.writeRef({ fs, dir, ref: `refs/heads/${ctx.branch}`, value: head, force: true })
  await git.checkout({ fs, dir, ref: ctx.branch, force: true })

  // 저장만 한 변경: 합친 최종 모습과 브랜치가 다른 manuals/ 파일을 작업 폴더에 쓴다
  if (full && full !== committed) {
    const [now, want] = await Promise.all([treeFiles(dir, head), treeFiles(dir, full)])
    for (const path of new Set([...now.keys(), ...want.keys()])) {
      if (!owned(path) || now.get(path)?.oid === want.get(path)?.oid) continue
      const entry = want.get(path)
      if (!entry) {
        await rm(join(dir, path), { force: true })
        continue
      }
      const { blob } = await git.readBlob({ fs, dir, oid: entry.oid })
      await mkdir(dirname(join(dir, path)), { recursive: true })
      await writeFile(join(dir, path), blob)
    }
  }
  return { applied: true, conflicts: [] }
}

// mergeLocal: 고친 것이 있어도 다른 사람의 변경을 합친다 (Claude 작업 중에는 끈다: 파일을 쓰는 중이다)
export async function sync(ctx: GitContext, { mergeLocal = true }: { mergeLocal?: boolean } = {}): Promise<SyncState> {
  await restoreOutside(ctx.dir)
  try {
    await fetchRemote(ctx)
  } catch (error) {
    const pending = (await changes(ctx.dir)).length
    const recorded = await recordedCount(ctx.dir)
    return { status: 'offline', changes: pending, recorded, message: `원격에 연결하지 못했습니다: ${(error as Error).message}` }
  }
  const local = (await oid(ctx.dir, ctx.branch))!
  const upstream = (await oid(ctx.dir, `refs/remotes/${remote}/${ctx.branch}`))!
  let status = await relation(ctx.dir, local, upstream)
  // PR로 올린 커밋은 로컬에 남겨 둔다. PR이 머지돼 내 변경이 원격에 다 들어갔으면 원격으로 맞춘다
  if (
    (status === 'diverged' || status === 'ahead') &&
    !(await workdirChanges(ctx.dir)).some((c) => owned(c.path)) &&
    !(await rebuild(ctx, local, upstream)).oid
  ) {
    await git.writeRef({ fs, dir: ctx.dir, ref: `refs/heads/${ctx.branch}`, value: upstream, force: true })
    await git.checkout({ fs, dir: ctx.dir, ref: ctx.branch, force: true })
    status = 'synced'
  }
  let pending = await changes(ctx.dir)
  let applied = false
  let conflicts: string[] | undefined
  if ((status === 'behind' || status === 'diverged') && pending.length && mergeLocal) {
    const result = await syncLocal(ctx, local, upstream)
    if (result.applied) {
      applied = true
      pending = await changes(ctx.dir)
      status = await relation(ctx.dir, (await oid(ctx.dir, ctx.branch))!, upstream)
    } else {
      conflicts = result.conflicts
    }
  }
  if (status === 'behind' && !pending.length) {
    await git.merge({ fs, dir: ctx.dir, ours: ctx.branch, theirs: `${remote}/${ctx.branch}`, fastForwardOnly: true })
    // merge가 브랜치를 먼저 옮긴다. checkout이 실패하면 브랜치를 되돌려 HEAD와 작업 폴더가 어긋나지 않게 한다
    try {
      await git.checkout({ fs, dir: ctx.dir, ref: ctx.branch, force: true })
    } catch (error) {
      await git.writeRef({ fs, dir: ctx.dir, ref: `refs/heads/${ctx.branch}`, value: local, force: true })
      await git.checkout({ fs, dir: ctx.dir, ref: ctx.branch, force: true }).catch(() => {})
      throw new Error(`받아 온 내용을 작업 폴더에 쓰지 못했습니다: ${(error as Error).message}`)
    }
    status = 'synced'
  }
  const message = {
    synced: '최신 상태입니다',
    behind: '다른 사람의 변경이 있습니다. 제출할 때 함께 합칩니다',
    ahead: '내 PC에만 기록된 변경이 있습니다. 제출하면 올라갑니다',
    diverged: '다른 사람의 변경과 갈라졌습니다. 제출할 때 합칩니다',
    offline: '',
  }[status]
  const names = conflicts?.filter(owned).map((p) => p.split('/').pop()!.replace(/\.md$/, ''))
  return {
    status,
    changes: pending.length,
    recorded: await recordedCount(ctx.dir),
    message:
      conflicts && status !== 'synced'
        ? `다른 사람도 같은 곳을 고쳐 지금은 받아 오지 못했습니다${names?.length ? `: ${names.join(', ')}` : ''}. 내 수정은 그대로이고, 제출할 때 합쳐 보고 안 되면 PR로 넘깁니다`
        : applied
          ? '다른 사람의 변경을 받아 내 수정과 합쳤습니다'
          : message,
    ...(applied ? { applied } : {}),
    ...(conflicts ? { conflicts } : {}),
  }
}

// HEAD 대비 바뀐 manuals/ 파일을 커밋할 수 있게 올린다. 올린 수
async function stageAll(dir: string) {
  const pending = (await workdirChanges(dir)).filter((c) => owned(c.path))
  for (const change of pending) {
    if (change.status === 'deleted') await git.remove({ fs, dir, filepath: change.path })
    else await git.add({ fs, dir, filepath: change.path })
  }
  return pending.length
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

// onto 위에 내 커밋이 manuals/ 아래에서 바꾼 파일만 얹은 커밋을 만든다 (브랜치는 옮기지 않는다).
// 갈라진 내 커밋을 그대로 올리면 그 사이 남이 바꾼 파일을 옛 내용으로 되돌린다.
// 브랜치에 옛 .github/workflows가 들어가면 GitHub가 workflow scope 없는 토큰의 push도 거절한다.
// 파일 단위로 비교하므로 isomorphic-git이 못 합치는 히스토리(merge base가 여럿)도 처리한다.
// 내가 바꾼 파일을 onto 쪽도 바꿨으면 conflicts에 담는다 (내 내용으로 덮어쓴다). 얹을 게 없으면 oid가 없다
// message: 올릴 커밋 메시지 (없으면 내 마지막 커밋 메시지)
async function rebuild(ctx: GitContext, local: string, onto: string, message?: string) {
  const { dir } = ctx
  const bases = await git.findMergeBase({ fs, dir, oids: [local, onto] })
  const [mine, theirs, ...olds] = await Promise.all([local, onto, ...bases].map((ref: string) => treeFiles(dir, ref)))
  // merge base 어느 것과도 다르면 그쪽에서 바꾼 것이다
  const changed = (path: string, oid?: string) => olds.every((old) => old.get(path)?.oid !== oid)
  const files = new Map(theirs)
  const conflicts: string[] = []
  for (const path of new Set([...mine.keys(), ...theirs.keys()])) {
    const ours = mine.get(path)
    if (!owned(path) || ours?.oid === theirs.get(path)?.oid || !changed(path, ours?.oid)) continue
    if (changed(path, theirs.get(path)?.oid)) conflicts.push(path)
    if (ours) files.set(path, ours)
    else files.delete(path)
  }
  const tree = await writeFiles(dir, files)
  if (tree === (await git.readCommit({ fs, dir, oid: onto })).commit.tree) return { conflicts }
  message ??= (await git.readCommit({ fs, dir, oid: local })).commit.message
  const oid = await git.commit({ fs, dir, message, author: ctx.author, tree, parent: [onto], noUpdateBranch: true })
  return { oid, conflicts: conflicts.sort() }
}

// 같은 파일을 둘 다 고쳤을 때 줄 단위로 합쳐 본다. 못 합치면 undefined.
// 내 커밋을 그대로 합치지 않고 merge base 위에 manuals/ 변경만 얹은 커밋을 합친다
async function mergeOwned(ctx: GitContext, local: string, upstreamRef: string, message?: string) {
  const { dir } = ctx
  const upstream = (await oid(dir, upstreamRef))!
  const bases = await git.findMergeBase({ fs, dir, oids: [local, upstream] })
  if (bases.length !== 1) return undefined
  const { oid: mine } = await rebuild(ctx, local, bases[0], message)
  if (!mine) return undefined
  const temp = 'refs/heads/ariadne-submit'
  await git.writeRef({ fs, dir, ref: temp, value: mine, force: true })
  try {
    const result = await git.merge({ fs, dir, ours: temp, theirs: upstreamRef, author: ctx.author, message: `Merge ${upstreamRef.replace('refs/remotes/', '')}` })
    return result.oid
  } catch (error) {
    if (error instanceof Errors.MergeConflictError || error instanceof Errors.MergeNotSupportedError) return undefined
    throw error
  } finally {
    await git.deleteRef({ fs, dir, ref: temp })
  }
}

// 변경(manuals/ 아래만)을 커밋하고 원격에 올린다.
// push 모드: 원격 main 위에 내가 바꾼 파일만 얹어 push. 그 파일을 남도 바꿨으면 줄 단위로 합쳐 보고,
//   못 합치면 브랜치 + PR로 돌린다
// pr 모드: 원격 main 위에 내가 바꾼 파일만 얹은 커밋으로 브랜치 + PR
// 브랜치로 올린 경우 로컬 main은 내 커밋에 그대로 둔다 (PR이 머지되면 sync가 원격으로 맞춘다)
export async function submit(ctx: GitContext, options: SubmitOptions): Promise<SubmitResult> {
  const { dir, branch } = ctx
  const upstreamRef = `refs/remotes/${remote}/${branch}`
  // 기록만 한 커밋이 있으면 제출 메시지 아래에 기록들을 적어 한 커밋으로 올린다.
  // 지난 제출이 push 단계에서 실패했으면 커밋만 남아 있다. 변경이 없어도 그 커밋을 그 메시지로 올린다
  const records = await recordedCommits(dir)
  const message = records.length
    ? [options.message, '', '기록:', ...records.reverse().map((r) => `- ${r.message.split('\n')[0]}`)].join('\n')
    : undefined
  let commit: string
  if (await stageAll(dir)) {
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
    // 로컬 main은 내 커밋에 그대로 둔다. 원격으로 되돌리면 PR이 머지되기 전까지 내 작업이 화면에서 사라져
    // 옛 내용 위에서 다시 작업하게 된다. 다음 제출에서도 같은 충돌이 다시 잡혀 PR로 가고,
    // PR이 머지되면 sync가 원격으로 맞춘다
    return { mode: 'pr', commit: rebuilt, url, conflict: conflicts.length > 0 }
  }

  if (options.mode === 'pr') {
    const { oid: rebuilt, conflicts } = await rebuild(ctx, commit, (await oid(dir, upstreamRef))!, message)
    if (!rebuilt) throw new Error('제출할 변경이 없습니다')
    return toPullRequest(rebuilt, conflicts)
  }

  // push 사이에 다른 사람이 먼저 올리면 거절된다. 한 번 더 받아서 합친 뒤 다시 올린다
  for (let attempt = 0; ; attempt++) {
    const local = (await oid(dir, branch))!
    const upstream = (await oid(dir, upstreamRef))!
    // 내 커밋을 그대로 올리지 않고 원격 main 위에 manuals/ 변경만 얹어 올린다 (예전 앱이 만든 커밋에 섞인 옛 내용을 거른다)
    const { oid: rebuilt, conflicts } = await rebuild(ctx, local, upstream, message)
    // 내 변경이 이미 원격에 다 들어가 있다
    if (!rebuilt) {
      await moveTo(upstream)
      return { mode: 'push', commit: upstream }
    }
    if (conflicts.length) {
      const merged = await mergeOwned(ctx, local, upstreamRef, message)
      if (!merged) return toPullRequest(rebuilt, conflicts)
      await moveTo(merged)
    } else {
      await moveTo(rebuilt)
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
