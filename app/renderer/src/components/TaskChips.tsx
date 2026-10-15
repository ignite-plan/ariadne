// 상단 바의 작업 표시. 숨겨 둔 Claude 작업과 영상 만들기를 보여 주고, 누르면 그 패널을 연다
import { formatClock } from '../../../shared/format.ts'
import { useNow } from '../hooks.ts'
import { screenProgress } from '../../../shared/draft-log.ts'
import { draftLabel } from '../../../shared/draft-mode.ts'
import { useTasks } from '../tasks.tsx'
import { Icon } from './Icon.tsx'

export function TaskChips() {
  const tasks = useTasks()
  const { claude, video } = tasks
  const running = claude?.phase === 'running' || Boolean(video)
  const now = useNow(running)

  // 패널을 보고 있으면 표시하지 않는다
  const showClaude = claude && tasks.draftPanel?.id !== claude.panel
  const progress = claude && screenProgress(claude)
  const waiting = tasks.queue.items.length
  const queueText = waiting ? ` · 대기 ${waiting}${tasks.queue.paused ? ' · 멈춤' : ''}` : ''
  return (
    <>
      {showClaude && (
        <button
          className={`task-chip ${claude.phase === 'done' ? (claude.error ? 'failed' : 'done') : ''}`}
          onClick={tasks.showDraft}
          title={claude.phase === 'running' ? '작업은 계속됩니다. 누르면 진행 상황을 봅니다' : '결과 보기'}
        >
          <Icon
            name={claude.phase === 'running' ? 'sync' : claude.error ? 'alert' : 'check'}
            size={13}
            className={claude.phase === 'running' ? 'spin' : ''}
          />
          Claude {draftLabel(claude.input)}
          {claude.phase === 'running' && progress?.total ? ` ${progress.finished}/${progress.total}` : ''}
          {claude.phase === 'running' && claude.ask ? ' · 확인 필요' : ''}
          {claude.phase === 'running' ? ` · ${formatClock(now - claude.startedAt)}` : claude.error ? ' 실패' : ' 완료'}
          {queueText}
        </button>
      )}
      {/* 지금 작업 표시가 없는데 대기만 남았으면(멈춤) 따로 보여 준다 */}
      {!showClaude && waiting > 0 && claude?.phase !== 'running' && (
        <button className={`task-chip ${tasks.queue.paused ? 'failed' : ''}`} onClick={tasks.showDraft} title="대기 중인 Claude 최신화">
          <Icon name="alert" size={13} />
          Claude 최신화{queueText}
        </button>
      )}
      {video && (
        <button className="task-chip" onClick={() => tasks.openVideo(video.id)} title={`"${video.title}" 영상을 만드는 중입니다`}>
          <Icon name="video" size={13} />
          영상 만들기 · {video.progress?.message ?? '시작하는 중'}
        </button>
      )}
    </>
  )
}
