// 편집 화면 상단 바: 매뉴얼 고르기, 동기화, 작업 표시, 캡처·영상·Word 만들기·제출·설정
import { useState } from 'react'
import type { ManualTree, SyncState } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { useTasks } from '../tasks.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { ManualSwitcher } from './ManualSwitcher.tsx'
import { TaskChips } from './TaskChips.tsx'
import { useToast } from './Toast.tsx'

const SYNC_LABEL: Record<SyncState['status'], { icon: IconName; text: string }> = {
  synced: { icon: 'check', text: '최신' },
  behind: { icon: 'sync', text: '새 변경 있음' },
  ahead: { icon: 'upload', text: '올릴 커밋 있음' },
  diverged: { icon: 'sync', text: '합칠 변경 있음' },
  offline: { icon: 'alert', text: '오프라인' },
}

type Chapter = ManualTree['chapters'][number]

export function TitleBar({
  tree,
  sync,
  syncing,
  changes,
  currentChapter,
  flush,
  onSync,
  onSwitchManual,
  onImport,
  onCapture,
  onSubmit,
  onSettings,
}: {
  tree?: ManualTree
  sync?: SyncState
  syncing: boolean
  changes: number
  currentChapter?: Chapter
  // 대기 중인 저장을 먼저 쓴다 (Word 만들기 전)
  flush: () => Promise<boolean>
  onSync: () => void
  onSwitchManual: (id: string) => void
  onImport: () => void
  onCapture: () => void
  onSubmit: () => void
  onSettings: () => void
}) {
  const tasks = useTasks()
  // 내 PC에 기록만 한 것이 있으면 그 수를 보여 준다 (제출하면 올라간다)
  const syncInfo = sync
    ? sync.recorded && sync.status !== 'offline'
      ? { icon: 'upload' as const, text: `내 PC 기록 ${sync.recorded}` }
      : SYNC_LABEL[sync.status]
    : undefined
  const claudeRunning = tasks.claude?.phase === 'running'
  // Claude가 고치는 중에는 제출하지 않는다 (반쯤 고친 파일이 올라간다)
  const canSubmit = (changes > 0 || sync?.status === 'ahead' || sync?.status === 'diverged') && !claudeRunning

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <div className="brand">
          <span className="brand-mark" />
          Ariadne
        </div>
        <ManualSwitcher current={tree?.manual} title={tree?.title} version={tree?.version} onSwitch={onSwitchManual} onImport={onImport} />
        {sync && syncInfo && (
          <button className={`sync-badge ${sync.status}`} onClick={onSync} disabled={syncing} title={sync.message || '원격에서 받아오기'}>
            <Icon name={syncing ? 'sync' : syncInfo.icon} size={13} className={syncing ? 'spin' : ''} />
            {syncing ? '동기화 중' : syncInfo.text}
          </button>
        )}
      </div>
      <div className="titlebar-right">
        <TaskChips />
        <button className="button ghost" onClick={onCapture}>
          <Icon name="camera" /> 캡처
        </button>
        <button className="button ghost" onClick={() => tasks.openVideo()}>
          <Icon name="video" /> 영상
        </button>
        <BuildMenu currentChapter={currentChapter} flush={flush} />
        <button
          className="button primary"
          onClick={onSubmit}
          disabled={!canSubmit}
          title={claudeRunning ? 'Claude 작업이 끝난 뒤 제출할 수 있습니다' : undefined}
        >
          <Icon name="upload" /> 제출{changes > 0 && <span className="count light">{changes}</span>}
        </button>
        <button className="icon-button" onClick={onSettings} title="설정">
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}

// Word 만들기: 전체 또는 지금 장만
function BuildMenu({ currentChapter, flush }: { currentChapter?: Chapter; flush: () => Promise<boolean> }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [building, setBuilding] = useState(false)

  const build = async (chapters?: number[]) => {
    setOpen(false)
    if (!(await flush())) return
    setBuilding(true)
    try {
      const result = await api.build.docx(chapters)
      toast.show('success', 'Word 문서를 만들었습니다', { label: '열기', run: () => void api.build.open(result.docx) })
      if (result.warnings.trim()) console.warn(result.warnings)
    } catch (e) {
      toast.error(e)
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="menu-anchor">
      <button className="button ghost" onClick={() => setOpen(!open)} disabled={building}>
        <Icon name="word" /> {building ? '만드는 중…' : 'Word 만들기'}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu">
            <button onClick={() => void build()}>
              <b>전체 매뉴얼</b>
              <span>모든 장</span>
            </button>
            {currentChapter && (
              <button onClick={() => void build([currentChapter.no])}>
                <b>지금 장만</b>
                <span>
                  {currentChapter.no}. {currentChapter.title}
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
