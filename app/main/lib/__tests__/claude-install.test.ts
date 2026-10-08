import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { CLAUDE_PACKAGE, installClaude, installedClaudePath } from '../claude-install.ts'

describe('앱 전용 Claude Code 설치', { skip: process.platform !== 'darwin' && 'macOS tar 필요' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-install-'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  // npm 묶음과 같은 모양: package/claude
  const tgz = join(dir, 'pkg.tgz')
  mkdirSync(join(dir, 'src', 'package'), { recursive: true })
  writeFileSync(join(dir, 'src', 'package', 'claude'), '#!/bin/sh\necho "9.9.9 (Claude Code)"\n')
  chmodSync(join(dir, 'src', 'package', 'claude'), 0o755)
  execFileSync('/usr/bin/tar', ['-czf', tgz, '-C', join(dir, 'src'), 'package'])
  const bytes = readFileSync(tgz)
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  const fakeFetch = (good = integrity) => {
    const urls: string[] = []
    const fetch = async (url: string) => {
      urls.push(url)
      if (url.startsWith('https://registry.npmjs.org/')) return Response.json({ dist: { tarball: 'https://registry/x.tgz', integrity: good } })
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
    }
    return { fetch, urls }
  }

  it('레지스트리에서 정한 버전을 받아 무결성을 확인하고 tools/claude/<버전>에 둔다', async () => {
    const tools = join(dir, 'tools')
    const { fetch, urls } = fakeFetch()
    const result = await installClaude(tools, fetch, undefined, '9.9.9')
    assert.deepEqual(result, { path: installedClaudePath(tools, '9.9.9'), version: '9.9.9 (Claude Code)' })
    assert.equal(urls[0], `https://registry.npmjs.org/${CLAUDE_PACKAGE}/9.9.9`)
    assert.deepEqual(execFileSync('ls', [tools], { encoding: 'utf8' }).trim().split('\n'), ['claude'], '작업 폴더는 남기지 않는다')
  })

  it('무결성이 다르거나 버전이 다르면 설치하지 않는다', async () => {
    const tools = join(dir, 'bad')
    await assert.rejects(installClaude(tools, fakeFetch('sha512-AAAA').fetch, undefined, '9.9.9'), /손상됐습니다/)
    await assert.rejects(installClaude(tools, fakeFetch().fetch, undefined, '1.0.0'), /버전이 다릅니다/)
    assert.ok(!existsSync(installedClaudePath(tools, '9.9.9')))
  })
})
