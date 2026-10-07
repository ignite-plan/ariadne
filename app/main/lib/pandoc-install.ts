// pandoc을 앱이 받아 설치한다 (기획자가 pkg를 따로 설치하지 않게). GitHub 최신 릴리스의 arm64 macOS zip을
// net.fetch로 받아 userData/tools/pandoc에 푼다. Electron에 의존하지 않는다 (단위 테스트 대상)
import { execFile } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'

const run = promisify(execFile)

// GitHub API는 사내망처럼 같은 IP를 여럿이 쓰면 인증 없는 호출 한도에 걸린다(403). 그래서 API 대신
// releases/latest가 넘겨 주는 주소(/releases/tag/<버전>)에서 버전을 읽고 다운로드 주소를 만든다
export const PANDOC_LATEST_URL = 'https://github.com/jgm/pandoc/releases/latest'
// 최신 버전을 못 알아내면 이 버전을 받는다
export const PANDOC_FALLBACK_VERSION = '3.12'

export const pandocZipUrl = (version: string) =>
  `https://github.com/jgm/pandoc/releases/download/${version}/pandoc-${version}-arm64-macOS.zip`

// https://github.com/jgm/pandoc/releases/tag/3.12 → 3.12
export function versionFromReleaseUrl(url: string) {
  return url.match(/\/releases\/tag\/v?([0-9][0-9A-Za-z.-]*)$/)?.[1]
}

export interface PandocProgress {
  phase: 'release' | 'download' | 'extract'
  loaded?: number
  total?: number
}

// 앱이 설치한 pandoc 위치
export const installedPandocPath = (toolsDir: string) => join(toolsDir, 'pandoc', 'bin', 'pandoc')


// zip 안에서 bin/pandoc이 있는 폴더 (pandoc-3.12-arm64/)
function findPandocRoot(dir: string): string | undefined {
  if (existsSync(join(dir, 'bin', 'pandoc'))) return dir
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findPandocRoot(join(dir, entry.name))
      if (found) return found
    }
  }
  return undefined
}

export async function installPandoc(
  toolsDir: string,
  fetch: (url: string, init?: RequestInit) => Promise<Response>,
  onProgress?: (progress: PandocProgress) => void,
) {
  onProgress?.({ phase: 'release' })
  const latest = await fetch(PANDOC_LATEST_URL, { method: 'HEAD', headers: { 'User-Agent': 'Ariadne' } }).catch(() => undefined)
  const version = (latest?.ok && versionFromReleaseUrl(latest.url)) || PANDOC_FALLBACK_VERSION
  const asset = { version, name: `pandoc-${version}-arm64-macOS.zip`, url: pandocZipUrl(version) }

  mkdirSync(toolsDir, { recursive: true })
  const work = mkdtempSync(join(toolsDir, 'pandoc-'))
  try {
    const zip = join(work, asset.name)
    const file = await fetch(asset.url, { headers: { 'User-Agent': 'Ariadne' } })
    if (!file.ok || !file.body) throw new Error(`pandoc ${version}을 받지 못했습니다 (${file.status})`)
    const total = Number(file.headers.get('content-length')) || undefined
    let loaded = 0
    let last = 0
    const body = Readable.fromWeb(file.body as WebReadableStream<Uint8Array>)
    body.on('data', (chunk: Buffer) => {
      loaded += chunk.length
      if (loaded - last >= 1 << 20 || loaded === total) {
        last = loaded
        onProgress?.({ phase: 'download', loaded, total })
      }
    })
    await pipeline(body, createWriteStream(zip))
    if (total && statSync(zip).size !== total) throw new Error('pandoc 파일이 덜 받아졌습니다')

    onProgress?.({ phase: 'extract' })
    const out = join(work, 'out')
    mkdirSync(out)
    await run('/usr/bin/ditto', ['-x', '-k', zip, out])
    const root = findPandocRoot(out)
    if (!root) throw new Error('받은 pandoc 압축에서 bin/pandoc을 찾지 못했습니다')
    const target = join(toolsDir, 'pandoc')
    rmSync(target, { recursive: true, force: true })
    renameSync(root, target)
    const path = installedPandocPath(toolsDir)
    const { stdout } = await run(path, ['--version'])
    return { path, version: stdout.split('\n')[0] }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
