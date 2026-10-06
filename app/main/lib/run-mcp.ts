// 앱이 실행하는 Claude에 넘길 MCP 설정. Claude Code는 PC에 등록된 MCP 서버의 도구 정의를 전부 불러와
// 첫 턴부터 문맥을 10만 토큰 넘게 쓴다(그래서 자동 요약이 반복되다 멈췄다). --strict-mcp-config로 Ariadne와 필요한 Atlassian만 넘긴다.
// Electron에 의존하지 않는다 (단위 테스트 대상)
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface McpServerConfig {
  type?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  [key: string]: unknown
}

// 로컬 mcp-atlassian(sooperset)의 Confluence 읽기 도구. ENABLED_TOOLS로 이것만 켠다 (Jira·쓰기 도구 정의를 싣지 않는다)
export const MCP_ATLASSIAN_READ_TOOLS = [
  'confluence_search',
  'confluence_get_page',
  'confluence_get_page_children',
  'confluence_get_page_ancestors',
  'confluence_get_page_history',
  'confluence_get_page_diff',
  'confluence_get_comments',
  'confluence_get_labels',
  'confluence_get_attachments',
  'confluence_get_page_images',
  'confluence_get_space_page_tree',
]

// 앱 작업에 쓰는 기본 도구. 나머지(Bash, 웹, 하위 에이전트 등)는 정의도 싣지 않는다
export const BUILTIN_TOOLS = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'TodoWrite', 'ToolSearch']

// Claude Code 설정 파일: CLAUDE_CONFIG_DIR이 있으면 그 안, 아니면 ~/.claude.json
export function claudeConfigFile(env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  return env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, '.claude.json') : join(home, '.claude.json')
}

// 등록된 MCP 서버 설정. 이 작업 폴더 범위(local)가 사용자 범위(user)보다 우선한다
export function readClaudeMcpServers(file: string, cwds: string[]): Record<string, McpServerConfig> {
  if (!existsSync(file)) return {}
  let config: { mcpServers?: Record<string, McpServerConfig>; projects?: Record<string, { mcpServers?: Record<string, McpServerConfig> }> }
  try {
    config = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
  const local = cwds.map((cwd) => config.projects?.[cwd]?.mcpServers ?? {})
  return Object.assign({}, config.mcpServers ?? {}, ...local)
}

const isMcpAtlassian = (server: McpServerConfig) =>
  (server.type ?? 'stdio') === 'stdio' &&
  (/mcp-atlassian/.test(server.command ?? '') || (server.args ?? []).some((a) => /mcp-atlassian/.test(a)) || Boolean(server.env?.CONFLUENCE_URL))

// 로컬 mcp-atlassian이면 Confluence 읽기 도구만, 읽기 전용으로 띄운다. 원격 Atlassian MCP는 그대로
export function confluenceReadOnly(server: McpServerConfig): McpServerConfig {
  if (!isMcpAtlassian(server)) return server
  return { ...server, env: { ...server.env, ENABLED_TOOLS: MCP_ATLASSIAN_READ_TOOLS.join(','), READ_ONLY_MODE: 'true' } }
}

// Ariadne + 이번 작업에 줄 Atlassian 서버. 설정을 못 찾은 서버(플러그인·claude.ai 커넥터 등)가 있으면 strict로 실행할 수 없다
export function buildRunMcpConfig(
  ariadne: Record<string, unknown>,
  atlassian: string[],
  registered: Record<string, McpServerConfig>,
): { config: { mcpServers: Record<string, unknown> }; strict: boolean; missing: string[] } {
  const missing = atlassian.filter((name) => !registered[name])
  if (missing.length) return { config: { mcpServers: ariadne }, strict: false, missing }
  const servers = Object.fromEntries(atlassian.map((name) => [name, confluenceReadOnly(registered[name])]))
  return { config: { mcpServers: { ...servers, ...ariadne } }, strict: true, missing }
}
