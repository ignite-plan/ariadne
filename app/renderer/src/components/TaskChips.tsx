// 상단 바의 작업 표시. 숨겨 둔 Claude 작업과 영상 만들기를 보여 주고, 누르면 그 패널을 연다
import { useEffect, useState } from 'react'
import { draftLabel, useTasks } from '../tasks.tsx'
import { Icon } from './Icon.tsx'

const clock = (since: number) => {
  const s = Math.max(0, Math.round((Date.now() - since) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function TaskChips({ onOpenVideo }: { onOpenVideo: (id: string) => void }) {
  const tasks = useTasks()
  const { claude, video } = tasks
  const running = claude?.phase === 'running' || Boolean(video)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  // 패널을 보고 있으면 표시하지 않는다
  const showClaude = claude && tasks.draftPanel !== claude.input
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
          {claude.phase === 'running' ? ` · ${clock(claude.startedAt)}` : claude.error ? ' 실패' : ' 완료'}
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
