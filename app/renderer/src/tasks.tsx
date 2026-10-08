// 패널을 닫아도 이어지는 작업 상태. Claude 작업과 영상 만들기는 STG 공유 Chrome의 탭을 나눠 써서 동시에 돈다.
// 패널은 이 상태를 보여 주기만 하고, 상단 칩(TaskChips)에서 다시 연다. STG 로그인 세션 표시도 여기 한 곳에 둔다
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DraftInput, DraftResult, RefreshScope, SessionInfo, VideoProgress, VideoRunOptions, VideoRunResult } from '../../shared/api.ts'
import { applyTaskEvent, type ClaudeTask } from '../../shared/draft-log.ts'
import { draftLabel } from '../../shared/draft-mode.ts'
import { formatDuration } from '../../shared/format.ts'
import { api, errorMessage } from './api.ts'
import { useToast } from './components/Toast.tsx'

export type { ClaudeTask }

// 열린 Claude 패널. id로 작업과 짝을 맞춘다 (같은 입력으로 다시 열어도 다른 패널)
export interface DraftPanelState {
  input: DraftInput
  id: number
}

export interface VideoTask {
  id: string
  title: string
  progress?: VideoProgress
  startedAt: number
}

interface Tasks {
  claude?: ClaudeTask
  // 열려 있는 Claude 패널 (시작 전 점검 화면이거나 지금 작업을 보는 중)
  draftPanel?: DraftPanelState
  openDraft(input: DraftInput): void
  showDraft(): void
  hideDraft(): void
  // force: 최신화에서 기획서가 안 바뀐 화면도 다시 확인
  startClaude(panel: DraftPanelState, options?: { force?: boolean; scope?: RefreshScope }): Promise<void>
  // 끝난 작업을 지우고 패널을 닫는다
  clearClaude(): void
  // 영상 만들기 (미리보기는 패널에서 직접 한다)
  video?: VideoTask
  runVideo(id: string, title: string, options: VideoRunOptions): Promise<VideoRunResult>
  // 영상 패널. initial: 열 때 고를 영상 (토스트·작업 표시의 [보기])
  videoPanel?: { initial?: string }
  openVideo(initial?: string): void
  closeVideo(): void
  // 지금 STG 로그인 프로필을 쓰는 작업 이름 (main 잠금). 있으면 화면이 보이는 Chrome이 필요한 작업(로그인·미리보기·기록)을 못 한다
  stgBusy: string[]
  // STG 로그인 세션. 캡처·영상·Claude 패널이 같은 표시를 본다
  session: SessionInfo
  setSession(session: SessionInfo): void
  reloadSession(): Promise<SessionInfo>
}

const TasksContext = createContext<Tasks | null>(null)

export function useTasks() {
  const tasks = useContext(TasksContext)
  if (!tasks) throw new Error('TasksProvider 밖에서 useTasks를 썼습니다')
  return tasks
}

const panelOf = (task: ClaudeTask): DraftPanelState => ({ input: task.input, id: task.panel })

export function TasksProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [claude, setClaude] = useState<ClaudeTask>()
  const [draftPanel, setDraftPanel] = useState<DraftPanelState>()
  const [video, setVideo] = useState<VideoTask>()
  const [videoPanel, setVideoPanel] = useState<{ initial?: string }>()
  const [stgBusy, setStgBusy] = useState<string[]>([])
  const [session, setSessionState] = useState<SessionInfo>({ exists: false })
  const claudeRef = useRef<ClaudeTask>(undefined)
  claudeRef.current = claude
  const panelRef = useRef<DraftPanelState>(undefined)
  panelRef.current = draftPanel
  const seq = useRef(0)
  const panelSeq = useRef(0)

  // 세션 표식만 본다 ({ exists, savedAt }). 확인 결과의 valid 같은 값은 담지 않는다
  const setSession = useCallback((next: SessionInfo) => setSessionState({ exists: next.exists, savedAt: next.savedAt }), [])
  const reloadSession = useCallback(async () => {
    const next = await api.capture.session()
    setSession(next)
    return next
  }, [setSession])

  useEffect(() => {
    void api.capture.tasks().then(setStgBusy, () => undefined)
    // 작업 폴더가 없으면(첫 실행) 읽지 못한다
    void reloadSession().catch(() => undefined)
    const offTasks = api.on('stg-tasks', (names) => setStgBusy(names))
    const offDraft = api.on('draft-event', (event) => {
      setClaude((c) => (c && c.phase === 'running' ? applyTaskEvent(c, event) : c))
      // 패널을 숨겨 두었으면 답이 필요하다고 알린다
      const current = claudeRef.current
      if (event.kind === 'ask' && current && panelRef.current?.id !== current.panel) {
        toast.show('error', 'Claude 작업이 확인을 기다립니다', { label: '보기', run: () => setDraftPanel(panelOf(current)) })
      }
    })
    const offVideo = api.on('video-progress', (progress) => setVideo((v) => v && { ...v, progress }))
    return () => {
      offTasks()
      offDraft()
      offVideo()
    }
  }, [])

  const openDraft = useCallback(
    (input: DraftInput) => {
      const current = claudeRef.current
      if (current?.phase === 'running') {
        // 한 번에 하나만. 돌고 있는 작업을 보여 준다
        setDraftPanel(panelOf(current))
        return toast.show('info', `Claude ${draftLabel(current.input)} 작업이 끝난 뒤 새 작업을 할 수 있습니다`)
      }
      setClaude(undefined)
      setDraftPanel({ input, id: ++panelSeq.current })
    },
    [toast],
  )

  const startClaude = useCallback(
    async (panel: DraftPanelState, options: { force?: boolean; scope?: RefreshScope } = {}) => {
      const { input } = panel
      const task: ClaudeTask = {
        input,
        panel: panel.id,
        scope: options.scope,
        phase: 'running',
        log: [],
        screens: {},
        error: '',
        startedAt: Date.now(),
        seq: ++seq.current,
      }
      setClaude(task)
      let result: DraftResult | undefined
      let error = ''
      try {
        result = await api.draft.start({
          ...input,
          ...(options.force ? { force: true } : {}),
          ...(options.scope ? { scope: options.scope } : {}),
        })
        if (!result.ok) error = result.text || 'Claude가 오류로 끝났습니다'
      } catch (e) {
        error = errorMessage(e)
      }
      setClaude((c) => (c?.seq === task.seq ? { ...c, phase: 'done', result, error, endedAt: Date.now() } : c))
      // 작업 중에 세션이 만료됐으면 표시를 갱신한다
      void reloadSession().catch(() => undefined)
      // 패널을 숨겨 두었으면 끝났다고 알린다
      if (panelRef.current?.id !== panel.id) {
        const name = `Claude ${draftLabel(input)}`
        const action = { label: '결과 보기', run: () => setDraftPanel(panel) }
        if (error) toast.show('error', `${name} 작업이 끝나지 못했습니다`, action)
        else toast.show('success', `${name} 작업을 마쳤습니다 (${formatDuration(Date.now() - task.startedAt)})`, action)
      }
    },
    [toast, reloadSession],
  )

  const openVideo = useCallback((initial?: string) => setVideoPanel({ initial }), [])

  const runVideo = useCallback(
    async (id: string, title: string, options: VideoRunOptions) => {
      setVideo({ id, title, startedAt: Date.now() })
      try {
        const result = await api.video.run(id, options)
        const action = { label: '보기', run: () => openVideo(id) }
        if (result.ok) toast.show('success', `"${title}" 영상을 만들었습니다 (${formatDuration(result.durationMs)})`, action)
        else {
          const where = result.scene === undefined ? '' : result.scene === 'cleanup' ? ' (정리 단계)' : ` (장면 ${result.scene + 1})`
          toast.show('error', `"${title}" 영상을 만들지 못했습니다${where}: ${result.error}`, action)
        }
        return result
      } finally {
        setVideo(undefined)
        void reloadSession().catch(() => undefined)
      }
    },
    [toast, openVideo, reloadSession],
  )

  const value = useMemo<Tasks>(
    () => ({
      claude,
      draftPanel,
      openDraft,
      showDraft: () => {
        const current = claudeRef.current
        if (current) setDraftPanel(panelOf(current))
      },
      hideDraft: () => setDraftPanel(undefined),
      startClaude,
      clearClaude: () => {
        setDraftPanel(undefined)
        setClaude((c) => (c?.phase === 'running' ? c : undefined))
      },
      video,
      runVideo,
      videoPanel,
      openVideo,
      closeVideo: () => setVideoPanel(undefined),
      stgBusy,
      session,
      setSession,
      reloadSession,
    }),
    [claude, draftPanel, openDraft, startClaude, video, runVideo, videoPanel, openVideo, stgBusy, session, setSession, reloadSession],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

// 끝난 Claude 작업을 화면마다 한 번만 처리한다
export function useClaudeDone(fn: (task: ClaudeTask) => void) {
  const { claude } = useTasks()
  const handled = useRef(claude?.phase === 'done' ? claude.seq : 0)
  const callback = useRef(fn)
  callback.current = fn
  useEffect(() => {
    if (claude?.phase !== 'done' || handled.current === claude.seq) return
    handled.current = claude.seq
    callback.current(claude)
  }, [claude])
}
