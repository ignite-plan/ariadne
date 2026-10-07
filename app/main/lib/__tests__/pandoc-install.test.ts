import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { installedPandocPath, installPandoc, PANDOC_FALLBACK_VERSION, PANDOC_LATEST_URL, pandocZipUrl, versionFromReleaseUrl, type PandocProgress } from '../pandoc-install.ts'

describe('pandoc 자동 설치', { skip: process.platform !== 'darwin' && 'macOS ditto 필요' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'pandoc-install-'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  it('releases/latest가 넘겨 준 주소에서 버전을 읽는다', () => {
    assert.equal(versionFromReleaseUrl('https://github.com/jgm/pandoc/releases/tag/3.12'), '3.12')
    assert.equal(versionFromReleaseUrl('https://github.com/jgm/pandoc/releases/tag/3.12.1'), '3.12.1')
    assert.equal(versionFromReleaseUrl('https://github.com/jgm/pandoc/releases'), undefined)
    assert.equal(pandocZipUrl('3.12'), 'https://github.com/jgm/pandoc/releases/download/3.12/pandoc-3.12-arm64-macOS.zip')
  })

  it('받아서 tools/pandoc에 풀고 실행해 본다. 다시 설치하면 바꾼다', async () => {
    // 가짜 pandoc zip: pandoc-9.9-arm64/bin/pandoc
    const src = join(dir, 'src')
    mkdirSync(join(src, 'pandoc-9.9-arm64', 'bin'), { recursive: true })
    const bin = join(src, 'pandoc-9.9-arm64', 'bin', 'pandoc')
    writeFileSync(bin, '#!/bin/sh\necho "pandoc 9.9"\n')
    chmodSync(bin, 0o755)
    const zip = join(dir, 'pandoc.zip')
    execFileSync('/usr/bin/ditto', ['-c', '-k', '--keepParent', join(src, 'pandoc-9.9-arm64'), zip])
    const bytes = readFileSync(zip)
    const urls: string[] = []
    const fetch = async (url: string) => {
      urls.push(url)
      if (url === PANDOC_LATEST_URL) {
        // 넘겨 준 최종 주소
        const res = new Response(null)
        Object.defineProperty(res, 'url', { value: 'https://github.com/jgm/pandoc/releases/tag/9.9' })
        return res
      }
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
    }
    const tools = join(dir, 'tools')
    const phases: string[] = []
    const result = await installPandoc(tools, fetch, (p: PandocProgress) => phases.push(p.phase))
    assert.deepEqual(result, { path: installedPandocPath(tools), version: 'pandoc 9.9' })
    assert.deepEqual(urls, [PANDOC_LATEST_URL, pandocZipUrl('9.9')])
    assert.ok(phases.includes('download') && phases.at(-1) === 'extract')
    // 작업 폴더는 남기지 않는다
    assert.deepEqual(execFileSync('ls', [tools], { encoding: 'utf8' }).trim().split('\n'), ['pandoc'])
    await installPandoc(tools, fetch)
    assert.ok(existsSync(installedPandocPath(tools)))
  })

  it('최신 버전을 못 알아내면 정해 둔 버전을 받고, 그것도 실패하면 알려 준다', async () => {
    const urls: string[] = []
    await assert.rejects(
      installPandoc(join(dir, 't2'), async (url) => (urls.push(url), new Response('no', { status: 403 }))),
      new RegExp(`pandoc ${PANDOC_FALLBACK_VERSION.replace('.', '\\.')}을 받지 못했습니다 \\(403\\)`),
    )
    assert.equal(urls[1], pandocZipUrl(PANDOC_FALLBACK_VERSION))
  })

})
