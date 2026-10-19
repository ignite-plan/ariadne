// 최신화 진행: 기획서 요약 → 건너뛸 화면 고르기 → 화면별 작업을 몇 개씩 동시에 → 근거 버전 기록.
// 실제 Claude·STG 실행은 바깥에서 넣는다 (단위 테스트 대상)
import type { SectionMeta } from '../../../src/core/manual.ts'
import type { DraftEvent, ScreenResult } from '../../shared/api.ts'
import { hasScopedChanges, needsRefresh, screenBrief, specRefs, type SpecDigest } from './spec.ts'

export interface ScreenRun {
  ok: boolean
  // 이 화면 파일을 고쳤는지 (false면 바꿀 곳이 없었음)
  changed: boolean
  todos?: number
  text?: string
  durationMs?: number
}

export interface BatchDeps {
  targets: string[]
  force?: boolean
  // 반영 범위(기간·티켓)가 있다: 요약에서 반영할 변경이 없는 화면은 건너뛰고, 일부만 반영하므로 근거 버전을 남기지 않는다
  scoped?: boolean
  concurrency: number
  // 기획서 요약. Confluence를 못 쓰면 undefined (그때는 모든 화면을 STG로만 확인)
  runSpec: () => Promise<SpecDigest | undefined>
  readMeta: (target: string) => SectionMeta
  runScreen: (target: string, brief: string) => Promise<ScreenRun>
  // 성공한 화면에 근거 기획서 버전을 남긴다 (다음 최신화에서 건너뛰기용)
  recordRefresh: (target: string, digest: SpecDigest) => void
  onEvent: (event: DraftEvent) => void
  isCancelled: () => boolean
  // 기획서 요약이 실패했을 때 요약 없이 계속할지 (없으면 경고만 하고 계속)
  onSpecFailed?: (message: string) => Promise<boolean>
  // 다시 해도 같은 이유로 실패하는 오류인지 (인증, 모델, Claude Code 버전). 그러면 묻지 않고, 남은 화면도 돌리지 않고 멈춘다
  isBlocking?: (message: string) => boolean
}

// 화면 파일을 못 읽으면 기록이 없는 것으로 (화면 작업에서 오류가 난다)
function safeMeta(deps: BatchDeps, target: string): SectionMeta {
  try {
    return deps.readMeta(target)
  } catch {
    return {}
  }
}

export async function runRefreshBatch(deps: BatchDeps) {
  const { targets, onEvent } = deps
  const results = new Map<string, ScreenResult>()
  const set = (target: string, result: ScreenResult) => {
    results.set(target, result)
    onEvent({ kind: 'screen', target, status: result.status, text: result.text })
  }
  for (const target of targets) set(target, { target, status: 'waiting' })

  onEvent({ kind: 'phase', phase: 'spec', text: '기획서 요약 중' })
  let digest: SpecDigest | undefined
  // 멈춘 이유 (막히는 오류)
  let blocked: string | undefined
  const stopAll = (message: string) => {
    for (const target of targets) set(target, { target, status: 'failed', text: message })
    onEvent({ kind: 'phase', phase: 'done', text: 'Claude를 실행할 수 없어 멈췄습니다' })
    return { digest: undefined, screens: targets.map((t) => results.get(t)!), blocked: message }
  }
  try {
    digest = await deps.runSpec()
  } catch (error) {
    const message = (error as Error).message
    if (deps.isBlocking?.(message)) return stopAll(message)
    if (deps.onSpecFailed && !(await deps.onSpecFailed(message))) {
      for (const target of targets) set(target, { target, status: 'cancelled' })
      onEvent({ kind: 'phase', phase: 'done', text: '기획서 요약 실패로 중지했습니다' })
      return { digest: undefined, screens: targets.map((t) => results.get(t)!) }
    }
    onEvent({ kind: 'warning', text: `기획서 요약 없이 화면별로 직접 확인합니다: ${message}` })
  }
  const refs = specRefs(digest)

  const queue: string[] = []
  for (const target of targets) {
    if (deps.scoped) {
      if (digest && !hasScopedChanges(digest, target)) set(target, { target, status: 'skipped', text: '반영 범위에 해당하는 변경이 없습니다' })
      else queue.push(target)
    } else if (!deps.force && refs.length && !needsRefresh(safeMeta(deps, target), refs)) {
      set(target, { target, status: 'skipped', text: '근거 기획서가 지난번 최신화 이후 바뀌지 않았습니다' })
    } else queue.push(target)
  }

  onEvent({ kind: 'phase', phase: 'screens', text: queue.length ? `화면 ${queue.length}개 최신화 중` : '최신화할 화면이 없습니다' })
  const worker = async () => {
    for (let target = queue.shift(); target !== undefined; target = queue.shift()) {
      if (deps.isCancelled()) {
        set(target, { target, status: 'cancelled' })
        continue
      }
      if (blocked) {
        set(target, { target, status: 'failed', text: `앞 화면과 같은 이유로 실행하지 않았습니다: ${blocked}` })
        continue
      }
      set(target, { target, status: 'running' })
      try {
        const run = await deps.runScreen(target, screenBrief(digest, target))
        if (!run.ok && run.text && deps.isBlocking?.(run.text)) blocked ??= run.text
        if (run.ok && digest && refs.length && !deps.scoped) deps.recordRefresh(target, digest)
        set(target, {
          target,
          status: deps.isCancelled() && !run.ok ? 'cancelled' : run.ok ? (run.changed ? 'done' : 'unchanged') : 'failed',
          text: run.ok ? undefined : run.text,
          todos: run.todos,
          durationMs: run.durationMs,
        })
      } catch (error) {
        set(target, { target, status: deps.isCancelled() ? 'cancelled' : 'failed', text: (error as Error).message })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(deps.concurrency, queue.length)) }, worker))
  onEvent({ kind: 'phase', phase: 'done', text: blocked ? 'Claude를 실행할 수 없어 멈췄습니다' : '최신화 끝' })
  return { digest, screens: targets.map((t) => results.get(t)!), blocked }
}
