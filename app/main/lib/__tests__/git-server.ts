// 테스트용 smart HTTP git 서버. git http-backend(CGI)를 감싼다
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function startGitServer(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'ariadne-git-'))
  const seed = join(root, 'seed')
  const bare = join(root, 'repo.git')
  const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
  execFileSync('git', ['init', '-q', '-b', 'main', seed])
  git(seed, 'config', 'user.email', 'seed@example.com')
  git(seed, 'config', 'user.name', 'seed')
  for (const [path, content] of Object.entries(files)) {
    execFileSync('mkdir', ['-p', join(seed, path, '..')])
    writeFileSync(join(seed, path), content)
  }
  git(seed, 'add', '.')
  git(seed, 'commit', '-qm', 'seed')
  execFileSync('git', ['clone', '-q', '--bare', seed, bare])
  git(bare, 'config', 'http.receivepack', 'true')

  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost')
    const child = spawn('git', ['http-backend'], {
      env: {
        ...process.env,
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: url.pathname,
        QUERY_STRING: url.search.slice(1),
        REQUEST_METHOD: req.method!,
        CONTENT_TYPE: req.headers['content-type'] ?? '',
        REMOTE_USER: 'tester',
        REMOTE_ADDR: '127.0.0.1',
      },
    })
    req.pipe(child.stdin)
    let head = Buffer.alloc(0)
    let started = false
    child.stdout.on('data', (chunk: Buffer) => {
      if (started) return void res.write(chunk)
      head = Buffer.concat([head, chunk])
      const crlf = head.indexOf('\r\n\r\n')
      const lf = head.indexOf('\n\n')
      const end = crlf >= 0 ? crlf : lf
      if (end < 0) return
      const sep = crlf >= 0 ? 4 : 2
      for (const line of head.subarray(0, end).toString().split(/\r?\n/)) {
        const i = line.indexOf(':')
        const key = line.slice(0, i).trim()
        const value = line.slice(i + 1).trim()
        if (key.toLowerCase() === 'status') res.statusCode = Number.parseInt(value, 10)
        else res.setHeader(key, value)
      }
      started = true
      res.write(head.subarray(end + sep))
    })
    child.stdout.on('end', () => res.end())
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}/repo.git`,
    root,
    // 다른 사람 역할: 일반 git으로 clone해서 고치고 push
    other(edit: (dir: string) => void, message = 'other change') {
      const dir = join(root, `other-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      execFileSync('git', ['clone', '-q', bare, dir])
      git(dir, 'config', 'user.email', 'other@example.com')
      git(dir, 'config', 'user.name', 'other')
      edit(dir)
      git(dir, 'add', '-A')
      git(dir, 'commit', '-qm', message)
      git(dir, 'push', '-q', 'origin', 'main')
    },
    show: (ref: string, path: string) => git(bare, 'show', `${ref}:${path}`),
    log: (ref = 'main') => git(bare, 'log', '--format=%s', ref).trim().split('\n'),
    // 원격 저장소에서 git 명령 (rev-parse 등)
    git: (...args: string[]) => git(bare, ...args).trim(),
    branches: () => git(bare, 'branch', '--format=%(refname:short)').trim().split('\n'),
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      rmSync(root, { recursive: true, force: true })
    },
  }
}
