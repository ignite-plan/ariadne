// 상단 바의 작업 표시. 숨겨 둔 Claude 작업과 영상 만들기를 보여 주고, 누르면 그 패널을 연다
import { formatClock } from '../../../shared/format.ts'
import { useNow } from '../hooks.ts'
import { draftLabel, screenProgress, useTasks } from '../tasks.tsx'
import { Icon } from './Icon.tsx'

export function TaskChips({ onOpenVideo }: { onOpenVideo: (id: string) => void }) {
  const tasks = useTasks()
  const { claude, video } = tasks
  const running = claude?.phase === 'running' || Boolean(video)
  const now = useNow(running)

  // 패널을 보고 있으면 표시하지 않는다
  const showClaude = claude && tasks.draftPanel !== claude.input
  const progress = claude && screenProgress(claude)
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
        </button>
      )}
      {video && (
        <button className="task-chip" onClick={() => onOpenVideo(video.id)} title={`"${video.title}" 영상을 만드는 중입니다`}>
          <Icon name="video" size={13} />
          영상 만들기 · {video.progress?.message ?? '시작하는 중'}
        </button>
      )}
    </>
  )
}
