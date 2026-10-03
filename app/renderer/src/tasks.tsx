// 패널을 닫아도 이어지는 작업 상태. Claude 작업과 영상 만들기는 STG 공유 Chrome의 탭을 나눠 써서 동시에 돈다.
// 패널은 이 상태를 보여 주기만 하고, 상단 칩(TaskChips)에서 다시 연다
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DraftEvent, DraftInput, DraftResult, VideoProgress, VideoRunOptions, VideoRunResult } from '../../shared/api.ts'
import { api, errorMessage } from './api.ts'
import { useToast } from './components/Toast.tsx'

export interface LogLine {
  id: string
  kind: 'status' | 'warning' | 'tool' | 'text' | 'error'
  text: string
  done?: boolean
  failed?: boolean
}

export function applyDraftEvent(lines: LogLine[], event: DraftEvent): LogLine[] {
  const id = `${Date.now()}-${Math.random()}`
  if (event.kind === 'status') return [...lines, { id, kind: 'status', text: event.text }]
  if (event.kind === 'warning') return [...lines, { id, kind: 'warning', text: event.text }]
  const e = event.event
  if (e.kind === 'tool') return [...lines, { id: e.id, kind: 'tool', text: e.label }]
  if (e.kind === 'tool_result') {
    return lines.map((l) => (l.id === e.id ? { ...l, done: true, failed: e.isError, text: e.isError ? `${l.text} — ${e.text}` : l.text } : l))
  }
  if (e.kind === 'text') {
    // 마지막 요약(JSON)은 결과 카드로 보여 준다
    const text = e.text.replace(/```json[\s\S]*?```/g, '').trim()
    return text ? [...lines, { id, kind: 'text', text }] : lines
  }
  if (e.kind === 'init' && e.mcp.some((m) => m.status !== 'connected')) {
    const failed = e.mcp.filter((m) => m.status !== 'connected').map((m) => m.name)
    return [...lines, { id, kind: 'status', text: `연결 안 된 MCP: ${failed.join(', ')}` }]
  }
  return lines
}

// 칩·토스트에 쓰는 작업 이름
export function draftLabel(input: DraftInput) {
  return { refresh: '최신화', create: '초안', video: '영상 초안', 'video-scene': '장면 채우기' }[input.mode ?? 'create']
}

// Claude가 고치고 있는 매뉴얼 화면인지 (그동안 편집을 막는다)
export function isDraftTarget(input: DraftInput, path: string) {
  if (input.mode === 'refresh') return Boolean(input.targets?.includes(path))
  if (input.mode === 'create') return Boolean(input.chapterDir && path.startsWith(`${input.chapterDir}/`))
  return false
}

export interface ClaudeTask {
  input: DraftInput
  phase: 'running' | 'done'
  log: LogLine[]
  result?: DraftResult
  error: string
  startedAt: number
  endedAt?: number
  // 작업 번호. 끝난 작업을 화면마다 한 번만 처리하게 쓴다
  seq: number
}

export interface VideoTask {
  id: string
  title: string
  progress?: VideoProgress
  startedAt: number
}

interface Tasks {
  claude?: ClaudeTask
  // 열려 있는 Claude 패널의 입력 (시작 전 점검 화면이거나 지금 작업을 보는 중)
  draftPanel?: DraftInput
  openDraft(input: DraftInput): void
  showDraft(): void
  hideDraft(): void
  startClaude(input: DraftInput): Promise<void>
  // 끝난 작업을 지우고 패널을 닫는다
  clearClaude(): void
  // 영상 만들기 (미리보기는 패널에서 직접 한다)
  video?: VideoTask
  runVideo(id: string, title: string, options: VideoRunOptions): Promise<VideoRunResult>
  // 지금 STG 로그인 프로필을 쓰는 작업 이름 (main 잠금). 있으면 화면이 보이는 Chrome이 필요한 작업(로그인·미리보기·기록)을 못 한다
  stgBusy: string[]
  // 토스트의 [보기]로 영상 패널을 연다 (Workbench가 등록)
  setVideoOpener(open: ((id: string) => void) | undefined): void
}

const TasksContext = createContext<Tasks | null>(null)

export function useTasks() {
  const tasks = useContext(TasksContext)
  if (!tasks) throw new Error('TasksProvider 밖에서 useTasks를 썼습니다')
  return tasks
}

const elapsedText = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}초` : `${Math.round(ms / 60000)}분`)

export function TasksProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [claude, setClaude] = useState<ClaudeTask>()
  const [draftPanel, setDraftPanel] = useState<DraftInput>()
  const [video, setVideo] = useState<VideoTask>()
  const [stgBusy, setStgBusy] = useState<string[]>([])
  const claudeRef = useRef<ClaudeTask>(undefined)
  claudeRef.current = claude
  const panelRef = useRef<DraftInput>(undefined)
  panelRef.current = draftPanel
  const videoOpener = useRef<((id: string) => void) | undefined>(undefined)
  const seq = useRef(0)

  useEffect(() => {
    void api.capture.tasks().then(setStgBusy, () => undefined)
    const offTasks = api.on('stg-tasks', (names: string[]) => setStgBusy(names))
    const offDraft = api.on('draft-event', (event: DraftEvent) =>
      setClaude((c) => (c && c.phase === 'running' ? { ...c, log: applyDraftEvent(c.log, event) } : c)),
    )
    const offVideo = api.on('video-progress', (progress: VideoProgress) => setVideo((v) => v && { ...v, progress }))
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
        setDraftPanel(current.input)
        return toast.show('info', `Claude ${draftLabel(current.input)} 작업이 끝난 뒤 새 작업을 할 수 있습니다`)
      }
      setClaude(undefined)
      setDraftPanel(input)
    },
    [toast],
  )

  const startClaude = useCallback(
    async (input: DraftInput) => {
      const task: ClaudeTask = { input, phase: 'running', log: [], error: '', startedAt: Date.now(), seq: ++seq.current }
      setClaude(task)
      let result: DraftResult | undefined
      let error = ''
      try {
        result = await api.draft.start(input)
        if (!result.ok) error = result.text || 'Claude가 오류로 끝났습니다'
      } catch (e) {
        error = errorMessage(e)
      }
      setClaude((c) => (c?.seq === task.seq ? { ...c, phase: 'done', result, error, endedAt: Date.now() } : c))
      // 패널을 숨겨 두었으면 끝났다고 알린다
      if (panelRef.current !== input) {
        const name = `Claude ${draftLabel(input)}`
        const action = { label: '결과 보기', run: () => setDraftPanel(input) }
        if (error) toast.show('error', `${name} 작업이 끝나지 못했습니다`, action)
        else toast.show('success', `${name} 작업을 마쳤습니다 (${elapsedText(Date.now() - task.startedAt)})`, action)
      }
    },
    [toast],
  )

  const runVideo = useCallback(
    async (id: string, title: string, options: VideoRunOptions) => {
      setVideo({ id, title, startedAt: Date.now() })
      try {
        const result = await api.video.run(id, options)
        const open = videoOpener.current
        const action = open ? { label: '보기', run: () => open(id) } : undefined
        if (result.ok) toast.show('success', `"${title}" 영상을 만들었습니다 (${elapsedText(result.durationMs)})`, action)
        else {
          const where = result.scene === undefined ? '' : result.scene === 'cleanup' ? ' (정리 단계)' : ` (장면 ${result.scene + 1})`
          toast.show('error', `"${title}" 영상을 만들지 못했습니다${where}: ${result.error}`, action)
        }
        return result
      } finally {
        setVideo(undefined)
      }
    },
    [toast],
  )

  const value = useMemo<Tasks>(
    () => ({
      claude,
      draftPanel,
      openDraft,
      showDraft: () => setDraftPanel(claudeRef.current?.input),
      hideDraft: () => setDraftPanel(undefined),
      startClaude,
      clearClaude: () => {
        setDraftPanel(undefined)
        setClaude((c) => (c?.phase === 'running' ? c : undefined))
      },
      video,
      runVideo,
      stgBusy,
      setVideoOpener: (open) => {
        videoOpener.current = open
      },
    }),
    [claude, draftPanel, openDraft, startClaude, video, runVideo, stgBusy],
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
