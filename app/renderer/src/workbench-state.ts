// 편집 화면(Workbench) 상태: 사이드바 데이터·동기화, 열린 화면과 자동 저장, 미리보기, 기억해 두는 화면 설정
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileChange, ManualTree, PreviewChapter, PreviewScope, ReviewBase, SectionDoc, SectionMeta, SyncState, Todo } from '../../shared/api.ts'
import { reviewHunks } from '../../shared/review-diff.ts'
import { api, errorMessage } from './api.ts'
import type { EditorHandle } from './components/Editor.tsx'
import { useToast } from './components/Toast.tsx'
import { useAutosave } from './hooks.ts'

// localStorage. 못 쓰면 기억하지 않는다
export function storage(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    localStorage.setItem(key, value)
  } catch {
    // 저장소를 못 쓰면 기억하지 않는다
  }
  return null
}

export function usePersistentState<T extends string>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (storage(key) as T | null) || initial)
  const set = useCallback(
    (next: T) => {
      setValue(next)
      storage(key, next)
    },
    [key],
  )
  return [value, set] as const
}

// 사이드바: 목차, TODO, 바뀐 파일, 원격과의 동기화 상태
export function useWorkspaceSide() {
  const toast = useToast()
  const [tree, setTree] = useState<ManualTree>()
  const [todos, setTodos] = useState<Todo[]>([])
  const [changes, setChanges] = useState<FileChange[]>([])
  const [sync, setSync] = useState<SyncState>()
  const [syncing, setSyncing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 목차를 돌려준다 (읽지 못했으면 undefined)
  const refresh = useCallback(async () => {
    try {
      const [t, td, ch] = await Promise.all([api.manual.tree(), api.manual.todos(), api.workspace.changes()])
      setTree(t)
      setTodos(td)
      setChanges(ch)
      return t
    } catch (e) {
      toast.error(e)
      return undefined
    }
  }, [toast])

  // 저장이 몰릴 때 한 번만 다시 읽는다
  const scheduleRefresh = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void refresh(), 800)
  }, [refresh])

  const runSync = useCallback(
    async (quiet = false) => {
      setSyncing(true)
      try {
        const before = sync?.status
        const state = await api.workspace.sync()
        setSync(state)
        if (!quiet && state.status === 'offline') toast.show('error', state.message)
        if (before !== 'synced' || state.status === 'synced') await refresh()
        return state
      } catch (e) {
        if (!quiet) toast.error(e)
      } finally {
        setSyncing(false)
      }
    },
    [refresh, sync?.status, toast],
  )

  return { tree, setTree, todos, changes, sync, syncing, refresh, scheduleRefresh, runSync }
}

export const LAST_PATH = 'ariadne.lastPath'

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

// 열린 화면 하나: 읽기, 입력이 멈추면 저장(0.6초), ⌘S·창 닫기 전 저장, front-matter 저장
export function useSectionDocument({ onSaved }: { onSaved: () => void }) {
  const toast = useToast()
  const [doc, setDoc] = useState<SectionDoc>()
  // 같은 화면을 다시 읽어도(Claude 수정, 되돌리기) 편집기를 새 내용으로 다시 그리게 한다
  const [version, setVersion] = useState(0)
  const [body, setBody] = useState('')
  const editor = useRef<EditorHandle>(null)
  const pendingLine = useRef<number | undefined>(undefined)
  const autosave = useAutosave<{ path: string; body: string }>({
    save: (job) => api.manual.write(job.path, job.body),
    onSaved,
    onError: (e) => toast.error(e),
  })
  const { flush } = autosave

  const open = useCallback(
    async (path: string, line?: number) => {
      if (!(await flush())) return
      try {
        const next = await api.manual.read(path)
        pendingLine.current = line
        setDoc(next)
        setBody(next.body)
        setVersion((v) => v + 1)
        storage(LAST_PATH, path)
      } catch (e) {
        toast.error(e)
      }
    },
    [flush, toast],
  )

  // 문서를 연 뒤 TODO 줄로 이동
  useEffect(() => {
    if (pendingLine.current === undefined) return
    const line = pendingLine.current
    pendingLine.current = undefined
    requestAnimationFrame(() => editor.current?.goToLine(line))
  }, [doc])

  // 창을 닫기 전에 저장, ⌘S로 바로 저장
  useEffect(() => {
    const onBeforeUnload = () => void flush()
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 's') {
        e.preventDefault()
        void flush().then((ok) => ok && toast.show('success', '저장했습니다'))
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('keydown', onKey)
    }
  }, [flush, toast])

  const change = (text: string) => {
    if (!doc) return
    setBody(text)
    autosave.schedule({ path: doc.path, body: text })
  }

  const saveMeta = async (meta: SectionMeta) => {
    if (!doc || !(await flush())) return
    try {
      await api.manual.write(doc.path, body, meta)
      setDoc({ ...doc, meta })
      onSaved()
      toast.show('success', '섹션 정보를 저장했습니다')
    } catch (e) {
      toast.error(e)
    }
  }

  return {
    doc,
    body,
    version,
    editor,
    saveState: autosave.state as SaveState,
    flush,
    // 대기 중인 저장을 버린다 (되돌리기·삭제로 파일이 바뀔 때)
    discard: autosave.discard,
    open,
    close: () => setDoc(undefined),
    change,
    saveMeta,
  }
}

// 미리보기: 입력이 멈추면 pandoc으로 다시 그린다. nonce가 바뀌면 이미지만 바뀌어도 다시 그린다
// word: Word와 같은 내용으로 그린다 (전체·장 미리보기 안의 지금 화면. TODO를 뺀다)
export function usePreview(doc: SectionDoc | undefined, body: string, enabled: boolean, nonce: number, word = false) {
  const [preview, setPreview] = useState<{ html?: string; error?: string }>({})
  useEffect(() => {
    if (!doc || !enabled) return
    const handle = setTimeout(async () => {
      try {
        setPreview({ html: await api.preview.render(doc.path, body, word ? { word } : undefined) })
      } catch (e) {
        setPreview({ error: errorMessage(e) })
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [doc, body, enabled, nonce, word])
  return preview
}

// 전체·장 미리보기: 다른 화면은 디스크 내용으로 (main이 화면별로 기억해 바뀐 것만 다시 그린다).
// tree가 바뀌면(저장·동기화·Claude 작업 뒤) 다시 읽는다
export function useManualPreview(scope: PreviewScope, chapterDir: string | undefined, enabled: boolean, tree: unknown, nonce: number) {
  const [state, setState] = useState<{ chapters?: PreviewChapter[]; error?: string; loading: boolean }>({ loading: false })
  const target = scope === 'chapter' ? chapterDir : undefined
  useEffect(() => {
    if (!enabled || scope === 'section' || (scope === 'chapter' && !chapterDir)) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    const handle = setTimeout(() => {
      api.preview.manual(target).then(
        (chapters) => alive && setState({ chapters, loading: false }),
        (e) => alive && setState({ error: errorMessage(e), loading: false }),
      )
    }, 300)
    return () => {
      alive = false
      clearTimeout(handle)
    }
  }, [scope, target, enabled, tree, nonce, chapterDir])
  return state
}

// Claude 변경 검토: 최신화가 고치기 직전 본문(main에 저장)과 지금 본문을 비교한다.
// 화면을 다시 열 때(version)마다 새로 읽는다. 미리보기용으로 고치기 전 본문도 pandoc으로 그린다
export function useReview(doc: SectionDoc | undefined, version: number, body: string, previewEnabled: boolean, nonce: number) {
  const [base, setBase] = useState<ReviewBase>()
  const [beforeHtml, setBeforeHtml] = useState<string>()
  const path = doc?.path

  useEffect(() => {
    setBase(undefined)
    if (!path) return
    let alive = true
    api.review.get(path).then(
      (next) => alive && setBase(next ?? undefined),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [path, version])

  useEffect(() => {
    setBeforeHtml(undefined)
    if (!path || !base || !previewEnabled) return
    let alive = true
    api.preview.render(path, base.before).then(
      (html) => alive && setBeforeHtml(html),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [path, base, previewEnabled, nonce])

  const hunks = useMemo(() => (base ? reviewHunks(base.before, body) : []), [base, body])

  const clear = useCallback(async () => {
    if (!path) return
    await api.review.clear(path)
    setBase(undefined)
  }, [path])

  // 기획자가 고쳐서 원문과 같아졌으면 표시할 것이 없다
  const active = Boolean(base && hunks.length)
  return { active, at: base?.at, hunks, beforeHtml: active ? beforeHtml : undefined, clear }
}
