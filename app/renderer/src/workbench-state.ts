// 편집 화면(Workbench) 상태: 사이드바 데이터·동기화, 열린 화면과 자동 저장, 미리보기, 기억해 두는 화면 설정
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileChange, ManualTree, SectionDoc, SectionMeta, SyncState, Todo } from '../../shared/api.ts'
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
export function usePreview(doc: SectionDoc | undefined, body: string, enabled: boolean, nonce: number) {
  const [preview, setPreview] = useState<{ html?: string; error?: string }>({})
  useEffect(() => {
    if (!doc || !enabled) return
    const handle = setTimeout(async () => {
      try {
        setPreview({ html: await api.preview.render(doc.path, body) })
      } catch (e) {
        setPreview({ error: errorMessage(e) })
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [doc, body, enabled, nonce])
  return preview
}
