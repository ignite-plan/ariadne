// 패널을 닫아도 이어지는 작업 상태. Claude 작업과 영상 만들기는 STG 공유 Chrome의 탭을 나눠 써서 동시에 돈다.
// 패널은 이 상태를 보여 주기만 하고, 상단 칩(TaskChips)에서 다시 연다. STG 로그인 세션 표시도 여기 한 곳에 둔다
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DraftInput, DraftResult, RefreshScope, SessionInfo, VideoProgress, VideoRunOptions, VideoRunResult } from '../../shared/api.ts'
import { canQueue, EMPTY_QUEUE, enqueue, moveQueued, pauseWith, removeQueued, resumeQueue, takeNext, type ClaudeQueue } from '../../shared/claude-queue.ts'
import { applyTaskEvent, type ClaudeTask } from '../../shared/draft-log.ts'
import { draftLabel } from '../../shared/draft-mode.ts'
import { formatDuration } from '../../shared/format.ts'
import { api, errorMessage } from './api.ts'
import { useToast } from './components/Toast.tsx'

export type { ClaudeTask }

export type ClaudeOptions = { force?: boolean; scope?: RefreshScope }

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
  // 지금 도는 작업 또는 마지막 작업
  claude?: ClaudeTask
  // 이번에 끝난 작업 (대기열로 여러 건이 이어서 끝나도 결과를 다시 열 수 있게, 최근 것이 앞)
  finished: ClaudeTask[]
  // 패널 번호로 작업 찾기 (지금 작업이나 끝난 작업)
  taskOf(panel: number): ClaudeTask | undefined
  // 열려 있는 Claude 패널 (시작 전 점검 화면이거나 지금 작업을 보는 중)
  draftPanel?: DraftPanelState
  openDraft(input: DraftInput): void
  openPanel(panel: DraftPanelState): void
  showDraft(): void
  hideDraft(): void
  // force: 최신화에서 기획서가 안 바뀐 화면도 다시 확인
  startClaude(panel: DraftPanelState, options?: ClaudeOptions): Promise<void>
  // 끝난 작업을 지우고 패널을 닫는다 (없으면 지금 연 패널)
  clearClaude(panel?: number): void
  // 최신화 대기열: 지금 작업이 끝나면 차례로 시작한다
  queue: ClaudeQueue
  enqueueClaude(panel: DraftPanelState, options: ClaudeOptions): void
  removeQueued(panel: number): void
  moveQueued(panel: number, delta: -1 | 1): void
  clearQueue(): void
  resumeQueue(): void
  // Claude 작업이 끝날 때마다 (패널을 닫아 두었어도, 대기열로 바로 다음 작업이 시작돼도) 한 번씩 부른다
  onClaudeDone(fn: (task: ClaudeTask) => void): () => void
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
  const [finished, setFinished] = useState<ClaudeTask[]>([])
  const [queue, setQueueState] = useState<ClaudeQueue>(EMPTY_QUEUE)
  const queueRef = useRef<ClaudeQueue>(EMPTY_QUEUE)
  // 상태와 ref를 같이 바꾼다 (자동 시작이 렌더를 기다리지 않고 최신 대기열을 본다)
  const setQueue = useCallback((update: (q: ClaudeQueue) => ClaudeQueue) => {
    queueRef.current = update(queueRef.current)
    setQueueState(queueRef.current)
  }, [])
  const doneListeners = useRef(new Set<(task: ClaudeTask) => void>())
  const startNextRef = useRef<() => Promise<void>>(async () => undefined)

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
      // 최신화는 도는 중에도 열어서 대기에 넣을 수 있다
      if (current?.phase === 'running' && !(canQueue(current.input) && canQueue(input))) {
        // 한 번에 하나만. 돌고 있는 작업을 보여 준다
        setDraftPanel(panelOf(current))
        return toast.show('info', `Claude ${draftLabel(current.input)} 작업이 끝난 뒤 새 작업을 할 수 있습니다`)
      }
      setDraftPanel({ input, id: ++panelSeq.current })
    },
    [toast],
  )

  const startClaude = useCallback(
    async (panel: DraftPanelState, options: ClaudeOptions = {}) => {
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
      // 마지막 진행 기록까지 담아 끝낸다 (이벤트는 claude 상태에 쌓였다)
      const done: ClaudeTask = { ...(claudeRef.current?.seq === task.seq ? claudeRef.current : task), phase: 'done', result, error, endedAt: Date.now() }
      claudeRef.current = done
      setClaude((c) => (c?.seq === task.seq ? { ...c, phase: 'done', result, error, endedAt: done.endedAt } : c))
      setFinished((list) => [done, ...list.filter((t) => t.panel !== done.panel)].slice(0, 10))
      for (const fn of doneListeners.current) {
        try {
          fn(done)
        } catch {
          // 화면 하나의 후처리 오류가 대기열을 멈추지 않게
        }
      }
      // 작업 중에 세션이 만료됐으면 표시를 갱신한다
      void reloadSession().catch(() => undefined)
      // 패널을 숨겨 두었으면 끝났다고 알린다
      if (panelRef.current?.id !== panel.id) {
        const name = `Claude ${draftLabel(input)}`
        const action = { label: '결과 보기', run: () => setDraftPanel(panel) }
        if (error) toast.show('error', `${name} 작업이 끝나지 못했습니다`, action)
        else toast.show('success', `${name} 작업을 마쳤습니다 (${formatDuration(Date.now() - task.startedAt)})`, action)
      }
      void startNextRef.current()
    },
    [toast, reloadSession],
  )

  // 대기 첫 항목을 시작한다. 만료된 세션으로 몇 분씩 돌지 않게 먼저 STG를 열어 본다 (패널의 [시작]과 같음)
  const isRunning = () => claudeRef.current?.phase === 'running'
  const startNext = useCallback(async () => {
    if (isRunning()) return
    const { next, queue: rest } = takeNext(queueRef.current)
    if (!next) return
    setQueue(() => rest)
    const panel: DraftPanelState = { input: next.input, id: next.panel }
    try {
      const current = await api.capture.session()
      if (current.exists) {
        const checked = await api.capture.checkSession()
        setSession(checked)
        if (!checked.valid) throw new Error('STG 로그인 세션이 만료되었습니다')
      }
    } catch (e) {
      const reason = errorMessage(e)
      setQueue((q) => pauseWith(q, reason, next))
      return toast.show('error', `대기 중인 최신화를 멈췄습니다: ${reason}. 다시 로그인한 뒤 [계속]을 누르세요`, {
        label: '보기',
        run: () => setDraftPanel(panel),
      })
    }
    // 세션을 확인하는 사이 기획자가 다른 작업을 시작했으면 맨 앞에 되돌린다 (그 작업이 끝나면 다시 꺼낸다)
    if (isRunning()) return setQueue((q) => ({ ...q, items: [next, ...q.items] }))
    // 시작할 대기 패널을 보고 있었으면 그대로 진행 화면이 된다
    void startClaude(panel, next.options)
  }, [setQueue, setSession, startClaude, toast])
  startNextRef.current = startNext

  const enqueueClaude = useCallback(
    (panel: DraftPanelState, options: ClaudeOptions) => {
      setQueue((q) => enqueue(q, { panel: panel.id, input: panel.input, options, addedAt: Date.now() }))
      setDraftPanel(undefined)
      // 그사이 앞 작업이 끝났으면 바로 시작한다
      if (claudeRef.current?.phase !== 'running') return void startNextRef.current()
      toast.show('info', `Claude ${draftLabel(panel.input)}를 대기에 추가했습니다 (${queueRef.current.items.length}번째)`)
    },
    [setQueue, toast],
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
      finished,
      taskOf: (panel: number) => (claude?.panel === panel ? claude : finished.find((t) => t.panel === panel)),
      draftPanel,
      openDraft,
      openPanel: (panel: DraftPanelState) => setDraftPanel(panel),
      showDraft: () => {
        const current = claudeRef.current
        if (current) setDraftPanel(panelOf(current))
        else {
          // 지금 작업이 없고 대기만 남았으면(멈춤) 첫 대기 패널을 연다
          const first = queueRef.current.items[0]
          if (first) setDraftPanel({ input: first.input, id: first.panel })
        }
      },
      hideDraft: () => setDraftPanel(undefined),
      startClaude,
      clearClaude: (panel?: number) => {
        const id = panel ?? panelRef.current?.id
        setDraftPanel(undefined)
        setFinished((list) => list.filter((t) => t.panel !== id))
        setClaude((c) => (c && c.phase !== 'running' && c.panel === id ? undefined : c))
      },
      queue,
      enqueueClaude,
      removeQueued: (panel: number) => setQueue((q) => removeQueued(q, panel)),
      moveQueued: (panel: number, delta: -1 | 1) => setQueue((q) => moveQueued(q, panel, delta)),
      clearQueue: () => setQueue(() => EMPTY_QUEUE),
      resumeQueue: () => {
        setQueue(resumeQueue)
        void startNextRef.current()
      },
      onClaudeDone: (fn: (task: ClaudeTask) => void) => {
        doneListeners.current.add(fn)
        return () => doneListeners.current.delete(fn)
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
    [claude, finished, draftPanel, openDraft, startClaude, queue, enqueueClaude, setQueue, video, runVideo, videoPanel, openVideo, stgBusy, session, setSession, reloadSession],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

// 끝난 Claude 작업을 화면마다 한 번씩 처리한다. 상태 변화를 보지 않고 알림을 받으므로,
// 대기열로 끝나자마자 다음 작업이 시작돼도 빠지지 않는다
export function useClaudeDone(fn: (task: ClaudeTask) => void) {
  const { onClaudeDone } = useTasks()
  const callback = useRef(fn)
  callback.current = fn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onClaudeDone((task) => callback.current(task)), [])
}
