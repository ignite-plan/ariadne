// Claude 작업 하나가 헛돌지 않게 지켜본다: 시간 상한, 파일 고치기 연속 실패. 넘으면 stop(이유)을 한 번 부른다.
// Electron에 의존하지 않는다 (단위 테스트 대상)
import type { ClaudeEvent } from '../../shared/api.ts'

export interface GuardLimits {
  timeoutMs?: number
  // Edit/Write가 이만큼 연속으로 실패하면 멈춘다 (고칠 문장을 못 찾고 같은 시도를 되풀이하는 경우)
  maxEditFailures?: number
  // 같은 조회(같은 도구·같은 입력)를 이만큼 하면 멈춘다 (같은 Grep·Read·검색을 되풀이하며 헛도는 경우)
  maxRepeats?: number
  // 도구 오류가 이만큼 연달아 나면 멈춘다
  maxConsecutiveErrors?: number
}

// 같은 입력을 다시 부르는 게 정상인 STG 조작은 반복으로 세지 않는다 (같은 버튼을 다시 눌러 팝업을 여는 등)
const isLookup = (name: string) => /^(Read|Grep|Glob)$/.test(name) || /__(confluence|jira)_|__(search|fetch|get)/i.test(name)

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write'])

export function createRunGuard({ timeoutMs, maxEditFailures, maxRepeats, maxConsecutiveErrors }: GuardLimits, stop: (reason: string) => void) {
  let stopped: string | undefined
  const fire = (reason: string) => {
    if (stopped) return
    stopped = reason
    stop(reason)
  }
  const names = new Map<string, string>()
  let failures = 0
  let errors = 0
  const seen = new Map<string, number>()
  const timer = timeoutMs ? setTimeout(() => fire(`시간 상한(${Math.round(timeoutMs / 60000)}분)을 넘어 멈췄습니다`), timeoutMs) : undefined
  return {
    get stopped() {
      return stopped
    },
    onEvent(event: ClaudeEvent) {
      if (event.kind === 'tool') {
        names.set(event.id, event.name)
        if (maxRepeats && event.key !== undefined && isLookup(event.name)) {
          const key = `${event.name} ${event.key}`
          const count = (seen.get(key) ?? 0) + 1
          seen.set(key, count)
          if (count >= maxRepeats) fire(`같은 조회를 ${count}번 되풀이해 멈췄습니다: ${event.label}`)
        }
        return
      }
      if (event.kind !== 'tool_result') return
      errors = event.isError ? errors + 1 : 0
      if (maxConsecutiveErrors && errors >= maxConsecutiveErrors) fire(`도구 오류가 ${errors}번 연달아 나서 멈췄습니다`)
      if (EDIT_TOOLS.has(names.get(event.id) ?? '')) {
        failures = event.isError ? failures + 1 : 0
        if (maxEditFailures && failures >= maxEditFailures) fire(`파일 고치기가 ${failures}번 연속 실패해 멈췄습니다`)
      }
    },
    dispose() {
      clearTimeout(timer)
    },
  }
}
