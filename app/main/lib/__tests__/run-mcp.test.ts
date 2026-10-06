import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { buildRunMcpConfig, claudeConfigFile, confluenceReadOnly, readClaudeMcpServers } from '../run-mcp.ts'

const atlassian = { type: 'stdio', command: '/Users/u/.mcp-atlassian-venv/bin/mcp-atlassian', args: [], env: { CONFLUENCE_URL: 'https://x', CONFLUENCE_API_TOKEN: 't' } }
const ariadne = { ariadne: { type: 'http', url: 'http://127.0.0.1:1/mcp' } }

describe('앱 작업의 MCP 설정', () => {
  it('설정 파일 위치: CLAUDE_CONFIG_DIR 우선', () => {
    assert.equal(claudeConfigFile({}, '/Users/u'), '/Users/u/.claude.json')
    assert.equal(claudeConfigFile({ CLAUDE_CONFIG_DIR: '/c' }, '/Users/u'), '/c/.claude.json')
  })

  it('사용자 범위 + 이 작업 폴더 범위(우선)를 읽고, 없거나 깨졌으면 빈 값', () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-mcp-'))
    try {
      const file = join(dir, '.claude.json')
      assert.deepEqual(readClaudeMcpServers(file, ['/w']), {})
      writeFileSync(file, '{oops')
      assert.deepEqual(readClaudeMcpServers(file, ['/w']), {})
      writeFileSync(
        file,
        JSON.stringify({
          mcpServers: { 'mcp-atlassian-hmg': atlassian, playwright: { command: 'npx' } },
          projects: { '/w': { mcpServers: { 'mcp-atlassian-hmg': { ...atlassian, command: 'local' } } }, '/other': { mcpServers: { x: {} } } },
        }),
      )
      const servers = readClaudeMcpServers(file, ['/w'])
      assert.equal(servers['mcp-atlassian-hmg'].command, 'local')
      assert.ok(servers.playwright)
      assert.equal(servers.x, undefined)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('로컬 mcp-atlassian은 Confluence 읽기 도구만, 읽기 전용. 원격은 그대로', () => {
    const ro = confluenceReadOnly(atlassian)
    assert.equal(ro.env?.READ_ONLY_MODE, 'true')
    assert.match(ro.env?.ENABLED_TOOLS ?? '', /^confluence_search,confluence_get_page,/)
    assert.doesNotMatch(ro.env?.ENABLED_TOOLS ?? '', /jira|create|update|delete/)
    assert.equal(ro.env?.CONFLUENCE_API_TOKEN, 't', '원래 설정은 유지')
    assert.equal(atlassian.env.CONFLUENCE_URL, 'https://x')
    assert.ok(!('READ_ONLY_MODE' in atlassian.env), '원본을 바꾸지 않는다')
    const remote = { type: 'http', url: 'https://mcp.atlassian.com/v1/sse' }
    assert.deepEqual(confluenceReadOnly(remote), remote)
  })

  it('Ariadne + 고른 Atlassian만 strict로. 설정을 못 찾은 서버가 있으면 strict 아님', () => {
    const registered = { 'mcp-atlassian-hmg': atlassian, playwright: { command: 'npx' } }
    const run = buildRunMcpConfig(ariadne, ['mcp-atlassian-hmg'], registered)
    assert.equal(run.strict, true)
    assert.deepEqual(Object.keys(run.config.mcpServers).sort(), ['ariadne', 'mcp-atlassian-hmg'])
    const none = buildRunMcpConfig(ariadne, [], registered)
    assert.deepEqual(none, { config: { mcpServers: ariadne }, strict: true, missing: [] })
    const loose = buildRunMcpConfig(ariadne, ['claude.ai Atlassian'], registered)
    assert.equal(loose.strict, false)
    assert.deepEqual(loose.missing, ['claude.ai Atlassian'])
  })
})
