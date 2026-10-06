// Claude 작업 하나가 헛돌지 않게 지켜본다: 시간 상한, 파일 고치기 연속 실패. 넘으면 stop(이유)을 한 번 부른다.
// Electron에 의존하지 않는다 (단위 테스트 대상)
import type { ClaudeEvent } from '../../shared/api.ts'

export interface GuardLimits {
  timeoutMs?: number
  // Edit/Write가 이만큼 연속으로 실패하면 멈춘다 (고칠 문장을 못 찾고 같은 시도를 되풀이하는 경우)
  maxEditFailures?: number
}

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write'])

export function createRunGuard({ timeoutMs, maxEditFailures }: GuardLimits, stop: (reason: string) => void) {
  let stopped: string | undefined
  const fire = (reason: string) => {
    if (stopped) return
    stopped = reason
    stop(reason)
  }
  const names = new Map<string, string>()
  let failures = 0
  const timer = timeoutMs ? setTimeout(() => fire(`시간 상한(${Math.round(timeoutMs / 60000)}분)을 넘어 멈췄습니다`), timeoutMs) : undefined
  return {
    get stopped() {
      return stopped
    },
    onEvent(event: ClaudeEvent) {
      if (event.kind === 'tool') names.set(event.id, event.name)
      else if (event.kind === 'tool_result' && EDIT_TOOLS.has(names.get(event.id) ?? '')) {
        failures = event.isError ? failures + 1 : 0
        if (maxEditFailures && failures >= maxEditFailures) fire(`파일 고치기가 ${failures}번 연속 실패해 멈췄습니다`)
      }
    },
    dispose() {
      clearTimeout(timer)
    },
  }
}
