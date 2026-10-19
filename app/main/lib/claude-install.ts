// 앱 전용 Claude Code. 기획자마다 설치한 claude 버전이 달라 동작이 갈리지 않게, 앱이 정한 버전의 macOS 실행 파일을
// npm 레지스트리에서 받아 userData/tools/claude/<버전>/claude에 둔다 (Node 필요 없는 Anthropic 서명 실행 파일).
// Electron에 의존하지 않는다 (단위 테스트 대상)
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'

const run = promisify(execFile)

// 앱이 쓰는 Claude Code 버전. 올릴 때는 앱 옵션(--bare, --strict-mcp-config, --tools, --effort, --model)이 그대로 되는지 확인한다.
// H-Chat 게이트웨이는 낮은 버전을 400(너무 낮은 버전)으로 거절한다 (2026-10 권장 2.1.292). 2.1.301: Sonnet 5.5
export const CLAUDE_CODE_VERSION = '2.1.301'
export const CLAUDE_PACKAGE = '@anthropic-ai/claude-code-darwin-arm64'

export const installedClaudePath = (toolsDir: string, version = CLAUDE_CODE_VERSION) => join(toolsDir, 'claude', version, 'claude')

export interface ToolProgress {
  phase: 'release' | 'download' | 'extract'
  loaded?: number
  total?: number
}

// npm 무결성 값(sha512-<base64>)과 파일이 같은지
async function checkIntegrity(file: string, integrity: string) {
  const [algo, expected] = integrity.split('-', 2)
  if (algo !== 'sha512' || !expected) throw new Error(`알 수 없는 무결성 형식: ${integrity}`)
  const hash = createHash('sha512')
  await pipeline(createReadStream(file), hash)
  if (hash.digest('base64') !== expected) throw new Error('받은 Claude Code 파일이 손상됐습니다 (무결성 불일치). 다시 시도하세요')
}

export async function installClaude(
  toolsDir: string,
  fetch: (url: string, init?: RequestInit) => Promise<Response>,
  onProgress?: (progress: ToolProgress) => void,
  version = CLAUDE_CODE_VERSION,
) {
  onProgress?.({ phase: 'release' })
  const meta = await fetch(`https://registry.npmjs.org/${CLAUDE_PACKAGE}/${version}`, { headers: { Accept: 'application/json' } })
  if (!meta.ok) throw new Error(`Claude Code ${version} 정보를 받지 못했습니다 (${meta.status})`)
  const dist = ((await meta.json()) as { dist?: { tarball?: string; integrity?: string; fileCount?: number } }).dist
  if (!dist?.tarball || !dist.integrity) throw new Error('npm 레지스트리 응답에 다운로드 주소가 없습니다')

  mkdirSync(toolsDir, { recursive: true })
  const work = mkdtempSync(join(toolsDir, 'claude-'))
  try {
    const tgz = join(work, 'claude.tgz')
    const res = await fetch(dist.tarball)
    if (!res.ok || !res.body) throw new Error(`Claude Code ${version}을 받지 못했습니다 (${res.status})`)
    const total = Number(res.headers.get('content-length')) || undefined
    let loaded = 0
    let last = 0
    const body = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>)
    body.on('data', (chunk: Buffer) => {
      loaded += chunk.length
      if (loaded - last >= 1 << 20 || loaded === total) {
        last = loaded
        onProgress?.({ phase: 'download', loaded, total })
      }
    })
    await pipeline(body, createWriteStream(tgz))
    await checkIntegrity(tgz, dist.integrity)

    onProgress?.({ phase: 'extract' })
    await run('/usr/bin/tar', ['-xzf', tgz, '-C', work])
    const binary = join(work, 'package', 'claude')
    if (!existsSync(binary)) throw new Error('받은 Claude Code 묶음에 실행 파일이 없습니다')
    chmodSync(binary, 0o755)
    const target = installedClaudePath(toolsDir, version)
    mkdirSync(dirname(target), { recursive: true })
    rmSync(target, { force: true })
    renameSync(binary, target)
    const { stdout } = await run(target, ['--version'], { timeout: 30000 })
    if (!stdout.includes(version)) throw new Error(`설치한 Claude Code 버전이 다릅니다: ${stdout.trim()}`)
    // 고정 버전을 올리면 예전 버전(약 220MB)은 다시 쓰지 않는다
    for (const old of readdirSync(join(toolsDir, 'claude'))) {
      if (old !== version) rmSync(join(toolsDir, 'claude', old), { recursive: true, force: true })
    }
    return { path: target, version: stdout.trim().split('\n')[0] }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
