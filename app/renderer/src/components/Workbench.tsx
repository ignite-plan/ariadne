import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  FileChange,
  ManualTree,
  SectionDoc,
  SectionMeta,
  Settings,
  SubmitResult,
  SyncState,
  Todo,
  UpdateInfo,
} from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { isDraftTarget, useClaudeDone, useTasks } from '../tasks.tsx'
import { CapturePanel } from './CapturePanel.tsx'
import { VideoPanel } from './VideoPanel.tsx'
import { DiffDialog } from './DiffDialog.tsx'
import { DraftPanel } from './DraftPanel.tsx'
import { Editor, type EditorHandle } from './Editor.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { ImageDialog, type PastedImage } from './ImageDialog.tsx'
import { ImportWizard } from './ImportWizard.tsx'
import { ManualSwitcher } from './ManualSwitcher.tsx'
import { MetaPanel } from './MetaPanel.tsx'
import { Confirm } from './Modal.tsx'
import { NewSectionDialog } from './NewSectionDialog.tsx'
import { Preview } from './Preview.tsx'
import { SettingsDialog } from './SettingsDialog.tsx'
import { Sidebar, type SidebarTab } from './Sidebar.tsx'
import { SubmitDialog } from './SubmitDialog.tsx'
import { TaskChips } from './TaskChips.tsx'
import { useToast } from './Toast.tsx'
import { UpdateAction } from './UpdateAction.tsx'

type Layout = 'editor' | 'split' | 'preview'
type SaveState = 'saved' | 'pending' | 'saving' | 'error'
type Dialog =
  | { type: 'image'; pasted?: PastedImage }
  | { type: 'new'; chapterDir?: string }
  | { type: 'submit' }
  | { type: 'import' }
  | { type: 'diff'; path: string; title: string }
  | { type: 'settings'; tab?: 'general' | 'env' | 'affected' }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; run: () => Promise<void> }

const LAST_PATH = 'ariadne.lastPath'
const LAYOUT = 'ariadne.layout'

function storage(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    localStorage.setItem(key, value)
  } catch {
    // 저장소를 못 쓰면 기억하지 않는다
  }
  return null
}

const SYNC_LABEL: Record<SyncState['status'], { icon: IconName; text: string }> = {
  synced: { icon: 'check', text: '최신' },
  behind: { icon: 'sync', text: '새 변경 있음' },
  ahead: { icon: 'upload', text: '올릴 커밋 있음' },
  diverged: { icon: 'sync', text: '합칠 변경 있음' },
  offline: { icon: 'alert', text: '오프라인' },
}

export function Workbench({ onReset }: { onReset: () => void }) {
  const toast = useToast()
  const [settings, setSettings] = useState<Settings>()
  const [tree, setTree] = useState<ManualTree>()
  const [todos, setTodos] = useState<Todo[]>([])
  const [changes, setChanges] = useState<FileChange[]>([])
  const [sync, setSync] = useState<SyncState>()
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<SidebarTab>('toc')
  const [doc, setDoc] = useState<SectionDoc>()
  // 같은 화면을 다시 읽어도(Claude 수정, 되돌리기) 편집기를 새 내용으로 다시 그리게 한다
  const [docVersion, setDocVersion] = useState(0)
  const [body, setBody] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [preview, setPreview] = useState<{ html?: string; error?: string }>({})
  const [layout, setLayoutState] = useState<Layout>(() => (storage(LAYOUT) as Layout) || 'split')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [videoing, setVideoing] = useState(false)
  // 영상 패널을 열 때 고를 영상 (토스트·작업 표시의 [보기])
  const [videoInitial, setVideoInitial] = useState<string>()
  const tasks = useTasks()
  const [building, setBuilding] = useState(false)
  const [buildMenu, setBuildMenu] = useState(false)
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  // 이미지 파일만 바뀌었을 때 미리보기를 다시 그리기 위한 값
  const [previewNonce, setPreviewNonce] = useState(0)

  const editor = useRef<EditorHandle>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const pending = useRef<{ path: string; body: string } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const sideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingLine = useRef<number | undefined>(undefined)

  const setLayout = (next: Layout) => {
    setLayoutState(next)
    storage(LAYOUT, next)
  }

  const refreshSide = useCallback(async () => {
    try {
      const [t, td, ch] = await Promise.all([api.manual.tree(), api.manual.todos(), api.workspace.changes()])
      setTree(t)
      setTodos(td)
      setChanges(ch)
    } catch (e) {
      toast.error(e)
    }
  }, [toast])

  const scheduleSideRefresh = useCallback(() => {
    clearTimeout(sideTimer.current)
    sideTimer.current = setTimeout(() => void refreshSide(), 800)
  }, [refreshSide])

  // 대기 중인 저장을 바로 쓴다. 섹션 전환, 빌드, 제출 전에 부른다
  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    const job = pending.current
    if (!job) return true
    pending.current = null
    setSaveState('saving')
    try {
      await api.manual.write(job.path, job.body)
      setSaveState(pending.current ? 'pending' : 'saved')
      scheduleSideRefresh()
      return true
    } catch (e) {
      pending.current ??= job
      setSaveState('error')
      toast.error(e)
      return false
    }
  }, [scheduleSideRefresh, toast])

  const openSection = useCallback(
    async (path: string, line?: number) => {
      if (!(await flush())) return
      try {
        const next = await api.manual.read(path)
        pendingLine.current = line
        setDoc(next)
        setBody(next.body)
        setDocVersion((v) => v + 1)
        setSaveState('saved')
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

  const runSync = useCallback(
    async (quiet = false) => {
      setSyncing(true)
      try {
        const before = sync?.status
        const state = await api.workspace.sync()
        setSync(state)
        if (!quiet && state.status === 'offline') toast.show('error', state.message)
        if (before !== 'synced' || state.status === 'synced') await refreshSide()
        return state
      } catch (e) {
        if (!quiet) toast.error(e)
      } finally {
        setSyncing(false)
      }
    },
    [refreshSide, sync?.status, toast],
  )

  // 시작: 설정, 원격 받아오기, 목차, 마지막 화면
  useEffect(() => {
    void (async () => {
      setSettings(await api.settings.get())
      await runSync(true)
      const t = await api.manual.tree().catch((e) => {
        toast.error(e)
        return undefined
      })
      if (!t) return
      const all = t.chapters.flatMap((c) => c.sections.map((s) => s.path))
      const last = storage(LAST_PATH)
      const first = last && all.includes(last) ? last : all[0]
      if (first) await openSection(first)
      setUpdate(await api.app.checkUpdate())
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChange = (text: string) => {
    if (!doc) return
    setBody(text)
    pending.current = { path: doc.path, body: text }
    setSaveState('pending')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flush(), 600)
  }

  // 미리보기: 입력이 멈추면 pandoc으로 다시 그린다
  useEffect(() => {
    if (!doc || layout === 'editor') return
    const handle = setTimeout(async () => {
      try {
        setPreview({ html: await api.preview.render(doc.path, body) })
      } catch (e) {
        setPreview({ error: errorMessage(e) })
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [doc, body, layout, previewNonce])

  // 창을 닫기 전에 저장
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

  const syncScroll = (ratio: number) => {
    const el = previewRef.current
    if (!el || layout !== 'split') return
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  const onImageFile = async (file: File) => {
    const data = new Uint8Array(await file.arrayBuffer())
    setDialog({
      type: 'image',
      pasted: { data, previewUrl: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, '') || 'image' },
    })
  }

  const saveMeta = async (meta: SectionMeta) => {
    if (!doc || !(await flush())) return
    try {
      await api.manual.write(doc.path, body, meta)
      setDoc({ ...doc, meta })
      scheduleSideRefresh()
      toast.show('success', '섹션 정보를 저장했습니다')
    } catch (e) {
      toast.error(e)
    }
  }

  const build = async (chapters?: number[]) => {
    setBuildMenu(false)
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

  const openSubmit = async () => {
    if (!(await flush())) return
    await refreshSide()
    setDialog({ type: 'submit' })
  }

  const onSubmitted = async (result: SubmitResult) => {
    setDialog(null)
    const commitUrl = settings ? `${settings.repoUrl.replace(/\.git$/, '')}/commit/${result.commit}` : undefined
    if (result.mode === 'push') {
      toast.show('success', '제출했습니다. 매뉴얼 원본에 반영되었습니다', commitUrl ? { label: '보기', run: () => void api.app.openExternal(commitUrl) } : undefined)
    } else {
      toast.show(
        result.conflict ? 'info' : 'success',
        result.conflict
          ? '다른 사람의 변경과 겹쳐 PR로 올렸습니다. 개발자가 합친 뒤 반영됩니다'
          : 'PR을 만들었습니다. 검토 후 반영됩니다',
        result.url ? { label: 'PR 보기', run: () => void api.app.openExternal(result.url!) } : undefined,
      )
    }
    await runSync(true)
    await refreshSide()
    if (doc) await openSection(doc.path).catch(() => undefined)
  }

  const askRevert = (targets: FileChange[]) => {
    setDialog({
      type: 'confirm',
      title: '변경 되돌리기',
      message:
        targets.length === 1
          ? `"${targets[0].label}"의 변경을 버리고 마지막으로 제출된 상태로 되돌립니다.`
          : `변경 ${targets.length}개를 모두 버리고 마지막으로 제출된 상태로 되돌립니다.`,
      confirmLabel: '되돌리기',
      danger: true,
      run: async () => {
        pending.current = null
        clearTimeout(saveTimer.current)
        await api.workspace.revert(targets.map((t) => t.path))
        const t = await api.manual.tree()
        const all = t.chapters.flatMap((c) => c.sections.map((s) => s.path))
        const next = doc && all.includes(doc.path) ? doc.path : all[0]
        // 문서를 먼저 연다. 변경 목록이 먼저 비면 그 사이 다른 화면을 연 것을 늦게 덮어쓴다
        if (next) await openSection(next)
        await refreshSide()
        toast.show('success', '되돌렸습니다')
      },
    })
  }

  const askRemove = (path: string, title: string) => {
    setDialog({
      type: 'confirm',
      title: '화면 삭제',
      message: `"${title}" 화면을 매뉴얼에서 지웁니다. 제출하기 전에는 변경 탭에서 되돌릴 수 있습니다.`,
      confirmLabel: '삭제',
      danger: true,
      run: async () => {
        if (doc?.path === path) {
          pending.current = null
          clearTimeout(saveTimer.current)
        }
        await api.manual.remove(path)
        const t = await api.manual.tree()
        await refreshSide()
        if (doc?.path === path) {
          const first = t.chapters[0]?.sections[0]?.path
          if (first) await openSection(first)
          else setDoc(undefined)
        }
      },
    })
  }

  // Claude로 최신화: 화면 하나 또는 장 전체
  const startRefresh = async ({ chapterDir, path }: { chapterDir: string; path?: string }) => {
    const chapter = tree?.chapters.find((c) => c.dir === chapterDir)
    if (!chapter || !(await flush())) return
    const targets = path ? [path] : chapter.sections.map((s) => s.path)
    const hint = path && doc?.path === path ? doc.meta.routes?.[0] : undefined
    tasks.openDraft({ mode: 'refresh', menu: chapter.title, targets, path: hint })
  }

  // Claude 작업이 끝나면(패널을 숨겨 두었어도) 고친 파일을 다시 읽는다. 열린 화면의 예전 내용이 자동 저장으로 덮어쓰지 않게 한다
  useClaudeDone((task) => {
    if (task.input.mode === 'video' || task.input.mode === 'video-scene' || !task.result) return
    void refreshSide().then(async () => {
      if (doc) await openSection(doc.path).catch(() => undefined)
    })
  })

  const openVideo = useCallback((id?: string) => {
    setVideoInitial(id)
    setVideoing(true)
  }, [])

  useEffect(() => {
    tasks.setVideoOpener(openVideo)
    return () => tasks.setVideoOpener(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVideo])

  // 순서를 바꾸면 폴더/파일 번호가 바뀐다. 지금 연 화면을 번호를 뺀 이름으로 다시 찾는다
  const reopenAfterMove = async () => {
    const t = await api.manual.tree()
    setTree(t)
    if (!doc) return
    const key = (path: string) => path.split('/').map((p) => p.replace(/^\d+-/, '')).join('/')
    const next = t.chapters.flatMap((c) => c.sections).find((s) => key(s.path) === key(doc.path))
    if (next && next.path !== doc.path) await openSection(next.path)
    await refreshSide()
  }

  const moveChapter = async (dir: string, toIndex: number) => {
    if (!(await flush())) return
    try {
      await api.manual.moveChapter(dir, toIndex)
      await reopenAfterMove()
    } catch (e) {
      toast.error(e)
    }
  }

  const moveSection = async (path: string, toIndex: number) => {
    if (!(await flush())) return
    try {
      await api.manual.moveSection(path, toIndex)
      await reopenAfterMove()
    } catch (e) {
      toast.error(e)
    }
  }

  // 다른 매뉴얼로 바꾸면 목차와 첫 화면을 다시 연다
  const switchManual = async (id: string) => {
    if (!(await flush())) return
    try {
      setSettings(await api.settings.update({ manual: id }))
      storage(LAST_PATH, '')
      setDoc(undefined)
      await refreshSide()
      const t = await api.manual.tree()
      const first = t.chapters[0]?.sections[0]?.path
      if (first) await openSection(first)
    } catch (e) {
      toast.error(e)
    }
  }

  const currentChapter = tree?.chapters.find((c) => doc?.path.startsWith(`${c.dir}/`))
  const syncInfo = sync ? SYNC_LABEL[sync.status] : undefined
  const claudeRunning = tasks.claude?.phase === 'running'
  // Claude가 고치는 중에는 제출하지 않는다 (반쯤 고친 파일이 올라간다)
  const canSubmit = (changes.length > 0 || sync?.status === 'ahead' || sync?.status === 'diverged') && !claudeRunning
  // Claude가 지금 이 화면을 고치는 중이면 편집을 막는다 (끝나면 디스크에서 다시 읽는다)
  const docLocked = Boolean(claudeRunning && doc && tasks.claude && isDraftTarget(tasks.claude.input, doc.path))

  return (
    <div className="workbench">
      <header className="titlebar">
        <div className="titlebar-left">
          <div className="brand">
            <span className="brand-mark" />
            Ariadne
          </div>
          <ManualSwitcher
            current={tree?.manual}
            title={tree?.title}
            version={tree?.version}
            onSwitch={(id) => void switchManual(id)}
            onImport={() => setDialog({ type: 'import' })}
          />
          {syncInfo && (
            <button
              className={`sync-badge ${sync!.status}`}
              onClick={() => void runSync()}
              disabled={syncing}
              title={sync!.message || '원격에서 받아오기'}
            >
              <Icon name={syncing ? 'sync' : syncInfo.icon} size={13} className={syncing ? 'spin' : ''} />
              {syncing ? '동기화 중' : syncInfo.text}
            </button>
          )}
        </div>
        <div className="titlebar-right">
          <TaskChips onOpenVideo={openVideo} />
          <button className="button ghost" onClick={() => setCapturing(true)}>
            <Icon name="camera" /> 캡처
          </button>
          <button className="button ghost" onClick={() => setVideoing(true)}>
            <Icon name="video" /> 영상
          </button>
          <div className="menu-anchor">
            <button className="button ghost" onClick={() => setBuildMenu(!buildMenu)} disabled={building}>
              <Icon name="word" /> {building ? '만드는 중…' : 'Word 만들기'}
            </button>
            {buildMenu && (
              <>
                <div className="menu-backdrop" onClick={() => setBuildMenu(false)} />
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
          <button
            className="button primary"
            onClick={openSubmit}
            disabled={!canSubmit}
            title={claudeRunning ? 'Claude 작업이 끝난 뒤 제출할 수 있습니다' : undefined}
          >
            <Icon name="upload" /> 제출{changes.length > 0 && <span className="count light">{changes.length}</span>}
          </button>
          <button className="icon-button" onClick={() => setDialog({ type: 'settings' })} title="설정">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {update && (
        <div className="banner">
          새 버전 {update.latest}이 있습니다.
          <UpdateAction update={update} />
          <button className="icon-button small" onClick={() => setUpdate(null)} aria-label="닫기">
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      <div className="workspace">
        <Sidebar
          tab={tab}
          onTab={setTab}
          tree={tree}
          todos={todos}
          changes={changes}
          current={doc?.path}
          onOpen={(path) => void openSection(path)}
          onOpenTodo={(t) => void openSection(t.path, t.line)}
          onNewSection={(chapterDir) => setDialog({ type: 'new', chapterDir })}
          onRemoveSection={askRemove}
          onRevert={askRevert}
          onMoveChapter={(dir, i) => void moveChapter(dir, i)}
          onMoveSection={(path, i) => void moveSection(path, i)}
          onRefresh={(target) => void startRefresh(target)}
          onDiff={(c) => setDialog({ type: 'diff', path: c.path, title: c.label })}
        />

        <main className="document">
          {doc ? (
            <>
              <div className="doc-header">
                <div className="breadcrumb ellipsis">
                  {currentChapter && (
                    <span className="muted">
                      {currentChapter.no}. {currentChapter.title} /
                    </span>
                  )}{' '}
                  {tree?.chapters.flatMap((c) => c.sections).find((s) => s.path === doc.path)?.title ?? doc.path}
                </div>
                {currentChapter && (
                  <button
                    className="button small ghost"
                    title="최신 Confluence 기획서와 STG 화면에 맞춰 이 화면을 고칩니다"
                    onClick={() => void startRefresh({ chapterDir: currentChapter.dir, path: doc.path })}
                  >
                    <Icon name="sparkle" size={14} /> Claude로 최신화
                  </button>
                )}
                <span className={`save-state ${saveState}`}>
                  {{ saved: '저장됨', pending: '입력 중', saving: '저장 중…', error: '저장 실패' }[saveState]}
                </span>
                <div className="segmented small">
                  <button className={layout === 'editor' ? 'active' : ''} onClick={() => setLayout('editor')} title="편집만">
                    편집
                  </button>
                  <button className={layout === 'split' ? 'active' : ''} onClick={() => setLayout('split')} title="나란히">
                    <Icon name="split" size={13} />
                  </button>
                  <button className={layout === 'preview' ? 'active' : ''} onClick={() => setLayout('preview')} title="미리보기만">
                    미리보기
                  </button>
                </div>
              </div>
              {docLocked && (
                <p className="notice doc-lock">
                  Claude가 이 화면을 고치는 중입니다. 끝나면 고친 내용으로 다시 열리고, 그때부터 편집할 수 있습니다.
                </p>
              )}
              <fieldset className="lock" disabled={docLocked}>
                <MetaPanel meta={doc.meta} onSave={saveMeta} />
              </fieldset>
              <div className={`panes ${layout}`}>
                <div className="pane editor-pane">
                  <fieldset className="lock toolbar" disabled={docLocked}>
                    <ToolButton icon="bold" label="굵게 (항목 이름)" onClick={() => editor.current?.wrap('**', '**', 'Label')} />
                    <ToolButton
                      icon="button"
                      label="버튼 이름 [Save]"
                      onClick={() => editor.current?.wrap('**\\[', '\\]**', 'Button')}
                    />
                    <span className="divider" />
                    <ToolButton icon="list" label="목록" onClick={() => editor.current?.prefixLines('- ')} />
                    <ToolButton icon="indent" label="하위 목록" onClick={() => editor.current?.prefixLines('  ')} />
                    <span className="divider" />
                    <ToolButton icon="image" label="이미지 넣기" onClick={() => setDialog({ type: 'image' })} />
                    <ToolButton
                      icon="flag"
                      label="TODO 남기기 (확인 필요한 내용)"
                      onClick={() => editor.current?.wrap('<!-- TODO: ', ' -->', '확인 필요')}
                    />
                    <span className="spacer" />
                    <ToolButton icon="undo" label="되돌리기 (⌘Z)" onClick={() => editor.current?.undo()} />
                    <ToolButton icon="redo" label="다시 실행 (⇧⌘Z)" onClick={() => editor.current?.redo()} />
                  </fieldset>
                  <Editor
                    readOnly={docLocked}
                    ref={editor}
                    docKey={`${doc.path}#${docVersion}`}
                    value={body}
                    onChange={onChange}
                    onImageFile={(f) => void onImageFile(f)}
                    onScrollRatio={syncScroll}
                  />
                </div>
                <div className="pane preview-pane">
                  <Preview ref={previewRef} html={preview.html} error={preview.error} />
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Icon name="book" size={32} />
              <p>왼쪽 목차에서 화면을 고르세요.</p>
            </div>
          )}
        </main>
      </div>

      {capturing && settings && (
        <div className="overlay">
          <CapturePanel
            manual={settings.manual}
            currentSection={doc?.path}
            onAdopted={() => {
              scheduleSideRefresh()
              setPreviewNonce((n) => n + 1)
            }}
            onClose={() => {
              setCapturing(false)
              void refreshSide()
              if (doc) void openSection(doc.path)
            }}
          />
        </div>
      )}

      {videoing && (
        <div className="overlay">
          <VideoPanel
            currentSection={doc?.path}
            initial={videoInitial}
            onClose={() => {
              setVideoing(false)
              setVideoInitial(undefined)
              void refreshSide()
            }}
          />
        </div>
      )}

      {/* 영상 패널 위에도 뜨도록 뒤에 둔다 (영상 초안·장면 채우기) */}
      {tasks.draftPanel && (
        <div className="overlay">
          <DraftPanel
            key={tasks.draftPanel.mode + (tasks.draftPanel.video ?? '') + tasks.draftPanel.menu}
            input={tasks.draftPanel}
            onOpenSection={(path) => {
              tasks.clearClaude()
              setVideoing(false)
              void refreshSide().then(() => openSection(path))
            }}
            onDiff={(path, title) => setDialog({ type: 'diff', path, title })}
            onDone={(input, changed) => {
              tasks.clearClaude()
              if (changed && (input.mode === 'refresh' || input.mode === 'create')) setTab(input.mode === 'refresh' ? 'changes' : 'toc')
            }}
          />
        </div>
      )}

      {dialog?.type === 'image' && settings && (
        <ImageDialog
          manual={settings.manual}
          pasted={dialog.pasted}
          onClose={() => setDialog(null)}
          onInsert={(md) => {
            setDialog(null)
            editor.current?.insert(md)
            scheduleSideRefresh()
          }}
        />
      )}
      {dialog?.type === 'new' && tree && (
        <NewSectionDialog
          tree={tree}
          chapterDir={dialog.chapterDir}
          onClose={() => setDialog(null)}
          onCreated={async (path) => {
            setDialog(null)
            await refreshSide()
            await openSection(path)
            setTab('toc')
          }}
          onDraft={async (input) => {
            setDialog(null)
            if (await flush()) tasks.openDraft(input)
          }}
        />
      )}
      {dialog?.type === 'submit' && settings && (
        <SubmitDialog
          changes={changes}
          sync={sync}
          settings={settings}
          onClose={() => setDialog(null)}
          onDone={(r) => void onSubmitted(r)}
        />
      )}
      {dialog?.type === 'diff' && (
        <DiffDialog path={dialog.path} title={dialog.title} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'import' && (
        <ImportWizard
          onClose={() => setDialog(null)}
          onDone={(id) => {
            setDialog(null)
            void switchManual(id).then(() =>
              toast.show('success', '새 매뉴얼을 가져왔습니다. 미리보기로 확인한 뒤 제출하세요'),
            )
          }}
        />
      )}
      {dialog?.type === 'settings' && (
        <SettingsDialog
          initialTab={dialog.tab}
          onClose={() => {
            setDialog(null)
            // 매뉴얼 설정(제목, 버전)이 바뀌었을 수 있다
            void refreshSide()
          }}
          onSettings={(next) => {
            if (next.manual !== settings?.manual) void switchManual(next.manual)
            else setSettings(next)
          }}
          onOpenSection={(path) => {
            setDialog(null)
            void openSection(path)
          }}
          onReset={onReset}
        />
      )}
      {dialog?.type === 'confirm' && (
        <Confirm
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          danger={dialog.danger}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            const run = dialog.run
            setDialog(null)
            try {
              await run()
            } catch (e) {
              toast.error(e)
            }
          }}
        />
      )}
    </div>
  )
}

function ToolButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="tool" onClick={onClick} title={label} aria-label={label}>
      <Icon name={icon} size={15} />
    </button>
  )
}
