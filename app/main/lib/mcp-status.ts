// claude mcp list 결과 기억. 한 번에 30초쯤 걸려서, Atlassian이 연결됐다고 확인되면 앱을 끌 때까지(또는 다시 확인할 때까지) 기억한다.
// 실패는 기억하지 않는다 (잠깐 실패한 결과로 계속 "연결 없음"이 되지 않게 다음 점검·작업 때 다시 확인). Electron에 의존하지 않는다
import type { McpStatus } from './claude.ts'

export interface McpStatusCache {
  // refresh: 기억을 무시하고 다시 확인
  get(refresh?: boolean): Promise<{ servers: McpStatus[]; checkedAt: number }>
  clear(): void
}

export function createMcpStatusCache(
  list: () => Promise<McpStatus[]>,
  isWanted: (server: McpStatus) => boolean,
  { now = Date.now, onResult }: { now?: () => number; onResult?: (result: { servers?: McpStatus[]; error?: unknown; ms: number }) => void } = {},
): McpStatusCache {
  let saved: { servers: McpStatus[]; checkedAt: number } | undefined
  // 같은 때 여러 번 불러도 claude mcp list는 한 번만
  let pending: Promise<{ servers: McpStatus[]; checkedAt: number }> | undefined
  return {
    async get(refresh = false) {
      if (!refresh && saved) return saved
      if (pending) return pending
      const started = now()
      pending = list().then(
        (servers) => {
          const result = { servers, checkedAt: now() }
          saved = servers.some((s) => isWanted(s) && s.connected) ? result : undefined
          onResult?.({ servers, ms: now() - started })
          return result
        },
        (error) => {
          saved = undefined
          onResult?.({ error, ms: now() - started })
          throw error
        },
      )
      try {
        return await pending
      } finally {
        pending = undefined
      }
    },
    clear() {
      saved = undefined
    },
  }
}
