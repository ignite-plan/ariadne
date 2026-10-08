import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { appBundlePath, bundleVersion, downloadAsset, pickDmgAsset, stageFromDmg, writeInstallScript } from '../app-update.ts'

// 가짜 Ariadne.app (Info.plist 버전만)
function fakeApp(dir: string, version: string) {
  const app = join(dir, 'Ariadne.app')
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>`,
  )
  writeFileSync(join(app, 'Contents', 'MacOS', 'Ariadne'), `#!/bin/sh\necho ${version}\n`)
  return app
}

describe('앱 안 업데이트', { skip: process.platform !== 'darwin' && 'macOS 필요' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'app-update-'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  it('릴리스에서 arm64 dmg를 고르고, 실행 파일 경로에서 앱 위치를 찾는다', () => {
    assert.deepEqual(
      pickDmgAsset([
        { url: 'a', name: 'Ariadne-1.7.0-arm64.dmg.blockmap', size: 1 },
        { url: 'b', name: 'Ariadne-1.7.0-arm64.dmg', size: 2 },
      ]),
      { url: 'b', name: 'Ariadne-1.7.0-arm64.dmg', size: 2 },
    )
    assert.equal(pickDmgAsset([]), undefined)
    assert.equal(appBundlePath('/Applications/Ariadne.app/Contents/MacOS/Ariadne'), '/Applications/Ariadne.app')
    assert.equal(appBundlePath('/usr/local/bin/electron'), undefined)
  })

  it('넘겨받은 주소로는 토큰 없이 받는다. 크기가 다르면 실패', async () => {
    const bytes = Buffer.from('dmg-bytes')
    const calls: { url: string; auth?: string; redirect?: string }[] = []
    const fetch = async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url, auth: headers.Authorization, redirect: init?.redirect })
      if (url === 'https://api/asset') return new Response(null, { status: 302, headers: { location: 'https://s3/signed' } })
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
    }
    const file = await downloadAsset(fetch, 'tok', { url: 'https://api/asset', name: 'x.dmg', size: bytes.length }, join(dir, 'dl', 'x.dmg'))
    assert.deepEqual(readFileSync(file), bytes)
    assert.deepEqual(calls, [
      { url: 'https://api/asset', auth: 'Bearer tok', redirect: 'manual' },
      { url: 'https://s3/signed', auth: undefined, redirect: undefined },
    ])
    await assert.rejects(downloadAsset(fetch, 'tok', { url: 'https://api/asset', name: 'y.dmg', size: 999 }, join(dir, 'dl', 'y.dmg')), /덜 받아졌습니다/)
  })

  it('dmg를 열어 앱을 꺼내고 버전을 확인한다', async () => {
    const src = join(dir, 'dmgsrc')
    fakeApp(src, '9.9.9')
    const dmg = join(dir, 'Ariadne-9.9.9-arm64.dmg')
    execFileSync('/usr/bin/hdiutil', ['create', '-quiet', '-srcfolder', src, '-volname', 'Ariadne 9.9.9', '-format', 'UDZO', '-ov', '-o', dmg])
    const verified: string[] = []
    const staged = await stageFromDmg(dmg, join(dir, 'updates', 'Ariadne.app'), '9.9.9', { verify: async (app) => void verified.push(app) })
    assert.equal(await bundleVersion(staged), '9.9.9')
    assert.deepEqual(verified, [staged])
    await assert.rejects(stageFromDmg(dmg, join(dir, 'updates', 'Ariadne.app'), '1.0.0', { verify: async () => {} }), /9\.9\.9\)이 1\.0\.0이 아닙니다/)
  })

  it('앱이 끝나면 바꿔 끼운다. 꺼낸 앱이 없으면 원래 앱을 지킨다', async () => {
    const swap = join(dir, 'swap')
    const target = fakeApp(join(swap, 'Applications'), '1.0.0')
    const staged = fakeApp(join(swap, 'staged'), '2.0.0')
    const script = writeInstallScript(join(swap, 'updates'))
    const log = join(swap, 'update.log')
    const runScript = (src: string) =>
      new Promise<void>((resolve) => {
        const app = spawn('/bin/sleep', ['0.3'])
        spawn('/bin/sh', [script, String(app.pid), src, target, log, 'noopen']).on('close', () => resolve())
      })
    await runScript(staged)
    assert.equal(await bundleVersion(target), '2.0.0')
    assert.ok(!existsSync(`${target}.old`) && !existsSync(staged))
    await runScript(join(swap, 'missing.app'))
    assert.equal(await bundleVersion(target), '2.0.0', '실패하면 원래 앱으로 되돌린다')
    assert.match(readFileSync(log, 'utf8'), /바꿨습니다[\s\S]*실패\. 원래 앱으로 되돌립니다/)
  })
})
