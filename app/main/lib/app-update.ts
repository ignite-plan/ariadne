// 앱 안에서 업데이트: 릴리스의 dmg를 GitHub 토큰으로 받아 열고, 새 Ariadne.app을 꺼내 둔 뒤
// 앱이 끝나면 작은 셸 스크립트가 /Applications의 앱을 바꿔 끼우고 다시 연다.
// Apple Developer ID 서명이 없어 electron-updater(Squirrel.Mac)는 쓸 수 없다. Electron에 의존하지 않는다 (단위 테스트 대상)
import { execFile } from 'node:child_process'
import { chmodSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'
import type { Fetch } from './github.ts'

const run = promisify(execFile)


export interface UpdateAsset {
  // GitHub API의 asset 주소 (비공개 리포라 토큰으로 받는다)
  url: string
  name: string
  size: number
}

export interface UpdateProgress {
  phase: 'download' | 'prepare'
  loaded?: number
  total?: number
}

export function pickDmgAsset(assets: { url: string; name: string; size: number }[] = []): UpdateAsset | undefined {
  const asset = assets.find((a) => /-arm64\.dmg$/.test(a.name))
  return asset ? { url: asset.url, name: asset.name, size: asset.size } : undefined
}

// /Applications/Ariadne.app/Contents/MacOS/Ariadne → /Applications/Ariadne.app
export function appBundlePath(exePath: string) {
  const match = exePath.match(/^(.*?\.app)\/Contents\/MacOS\/[^/]+$/)
  return match?.[1]
}

// 넘겨받을 주소만 알아낸다 (따라가지 않음). 없으면 넘겨 주지 않는 응답
export type ResolveRedirect = (url: string, headers: Record<string, string>) => Promise<string | undefined>

// fetch의 redirect: 'manual'로 넘겨받을 주소를 읽는다 (Node fetch). Electron net.fetch는 manual을 지원하지 않아 ipc에서 net.request로 따로 넣는다
const fetchRedirect =
  (fetch: Fetch): ResolveRedirect =>
  async (url, headers) => {
    const res = await fetch(url, { headers, redirect: 'manual' })
    const location = res.headers.get('location')
    return res.status >= 300 && res.status < 400 && location ? location : undefined
  }

// asset을 받는다. API는 저장소(S3 등)로 넘겨 주는데, 넘겨받은 주소에 토큰을 보내면 거절되므로 직접 따라간다
export async function downloadAsset(
  fetch: Fetch,
  token: string,
  asset: UpdateAsset,
  file: string,
  onProgress?: (p: UpdateProgress) => void,
  resolveRedirect: ResolveRedirect = fetchRedirect(fetch),
) {
  mkdirSync(dirname(file), { recursive: true })
  const headers = { Accept: 'application/octet-stream', Authorization: `Bearer ${token}`, 'User-Agent': 'Ariadne' }
  const location = await resolveRedirect(asset.url, headers)
  const res = location ? await fetch(location, { headers: { 'User-Agent': 'Ariadne' } }) : await fetch(asset.url, { headers })
  if (!res.ok || !res.body) throw new Error(`새 버전을 받지 못했습니다 (${res.status})`)
  const total = Number(res.headers.get('content-length')) || asset.size || undefined
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
  const partial = `${file}.part`
  await pipeline(body, createWriteStream(partial))
  if (asset.size && statSync(partial).size !== asset.size) throw new Error('새 버전 파일이 덜 받아졌습니다. 다시 시도하세요')
  rmSync(file, { force: true })
  await run('/bin/mv', [partial, file])
  return file
}

export interface StageOptions {
  // 꺼낸 앱 확인 (기본: ad-hoc 서명이 깨지지 않았는지 codesign으로)
  verify?: (app: string) => Promise<void>
}

const codesignVerify = async (app: string) => {
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app])
}

export async function bundleVersion(app: string) {
  const { stdout } = await run('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', join(app, 'Contents', 'Info.plist')])
  return stdout.trim()
}

// dmg를 열어 Ariadne.app을 stagedApp으로 꺼낸다. 버전과 서명을 확인한다
export async function stageFromDmg(dmg: string, stagedApp: string, expectVersion: string, { verify = codesignVerify }: StageOptions = {}) {
  mkdirSync(dirname(stagedApp), { recursive: true })
  const mount = mkdtempSync(join(dirname(stagedApp), 'mount-'))
  // 디스크가 바쁘면 가끔 실패한다. 한 번 더 시도한다
  const attach = () => run('/usr/bin/hdiutil', ['attach', dmg, '-nobrowse', '-noverify', '-readonly', '-mountpoint', mount])
  await attach().catch(async () => {
    await new Promise((r) => setTimeout(r, 1500))
    await attach()
  })
  try {
    const source = join(mount, 'Ariadne.app')
    if (!existsSync(source)) throw new Error('받은 dmg에 Ariadne.app이 없습니다')
    rmSync(stagedApp, { recursive: true, force: true })
    await run('/usr/bin/ditto', [source, stagedApp])
  } finally {
    await run('/usr/bin/hdiutil', ['detach', mount, '-force']).catch(() => {})
    rmSync(mount, { recursive: true, force: true })
  }
  const version = await bundleVersion(stagedApp)
  if (version !== expectVersion) throw new Error(`받은 앱 버전(${version})이 ${expectVersion}이 아닙니다`)
  await verify(stagedApp)
  return stagedApp
}

// 앱이 끝나기를 기다렸다가 바꿔 끼우고 다시 연다. 실패하면 원래 앱을 되돌려 놓는다
export const INSTALL_SCRIPT = `#!/bin/sh
# usage: install.sh <pid> <staged app> <target app> <log> [open]
PID="$1"; SRC="$2"; DST="$3"; LOG="$4"; OPEN="\${5:-open}"
exec >>"$LOG" 2>&1
echo "$(date) 업데이트 시작: $SRC -> $DST"
while kill -0 "$PID" 2>/dev/null; do sleep 0.5; done
rm -rf "$DST.old"
if mv "$DST" "$DST.old" && /usr/bin/ditto "$SRC" "$DST"; then
  /usr/bin/xattr -cr "$DST" 2>/dev/null
  rm -rf "$DST.old" "$SRC"
  echo "$(date) 바꿨습니다"
else
  echo "$(date) 실패. 원래 앱으로 되돌립니다"
  rm -rf "$DST"
  [ -d "$DST.old" ] && mv "$DST.old" "$DST"
fi
[ "$OPEN" = "open" ] && /usr/bin/open "$DST"
`

export function writeInstallScript(dir: string) {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'install.sh')
  writeFileSync(file, INSTALL_SCRIPT)
  chmodSync(file, 0o755)
  return file
}
