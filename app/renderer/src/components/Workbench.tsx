import { useEffect, useRef, useState } from 'react'
import type { FileChange, Settings, SubmitResult, UpdateInfo } from '../../../shared/api.ts'
import { isDraftTarget } from '../../../shared/draft-log.ts'
import { isVideoDraft } from '../../../shared/draft-mode.ts'
import { api } from '../api.ts'
import { allSections, findSection, pickSection } from '../manual-tree.ts'
import { REVIEW_ATTR } from '../review-marks.ts'
import { useClaudeDone, useTasks } from '../tasks.tsx'
import { LAST_PATH, storage, usePersistentState, usePreview, useReview, useSectionDocument, useWorkspaceSide } from '../workbench-state.ts'
import { CapturePanel } from './CapturePanel.tsx'
import { DiffDialog } from './DiffDialog.tsx'
import { DocumentPane, type Layout } from './DocumentPane.tsx'
import { DraftPanel } from './DraftPanel.tsx'
import { Icon } from './Icon.tsx'
import { ImageDialog, type PastedImage } from './ImageDialog.tsx'
import { ImportWizard } from './ImportWizard.tsx'
import { Confirm } from './Modal.tsx'
import { NewSectionDialog } from './NewSectionDialog.tsx'
import { SettingsDialog } from './SettingsDialog.tsx'
import { Sidebar, type SidebarTab } from './Sidebar.tsx'
import { SubmitDialog } from './SubmitDialog.tsx'
import { TitleBar } from './TitleBar.tsx'
import { useToast } from './Toast.tsx'
import { UpdateAction } from './UpdateAction.tsx'
import { VideoPanel } from './VideoPanel.tsx'

type Dialog =
  | { type: 'image'; pasted?: PastedImage }
  | { type: 'new'; chapterDir?: string }
  | { type: 'submit' }
  | { type: 'import' }
  | { type: 'diff'; path: string; title: string }
  | { type: 'settings' }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; run: () => Promise<void> }

export function Workbench({ onReset }: { onReset: () => void }) {
  const toast = useToast()
  const tasks = useTasks()
  const [settings, setSettings] = useState<Settings>()
  const side = useWorkspaceSide()
  const { tree, changes, sync } = side
  const section = useSectionDocument({ onSaved: side.scheduleRefresh })
  const { doc, flush } = section
  const [tab, setTab] = useState<SidebarTab>('toc')
  const [layout, setLayout] = usePersistentState<Layout>('ariadne.layout', 'split')
  // 이미지 파일만 바뀌었을 때 미리보기를 다시 그리기 위한 값
  const [previewNonce, setPreviewNonce] = useState(0)
  const preview = usePreview(doc, section.body, layout !== 'editor', previewNonce)
  const previewRef = useRef<HTMLDivElement>(null)
  // Claude 변경 검토 (최신화가 고치기 직전 본문과 비교)
  const review = useReview(doc, section.version, section.body, layout !== 'editor', previewNonce)
  const [reviewIndex, setReviewIndex] = useState(0)
  // 결과 카드에서 연 화면은 첫 변경으로 간다
  const jumpToReview = useRef<string>(undefined)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  // 시작: 설정, 원격 받아오기, 목차, 마지막 화면
  useEffect(() => {
    void (async () => {
      setSettings(await api.settings.get())
      await side.runSync(true)
      const t = await api.manual.tree().catch((e) => {
        toast.error(e)
        return undefined
      })
      if (!t) return
      const first = pickSection(t, storage(LAST_PATH))
      if (first) await section.open(first)
      setUpdate(await api.app.checkUpdate())
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onImageFile = async (file: File) => {
    const data = new Uint8Array(await file.arrayBuffer())
    setDialog({
      type: 'image',
      pasted: { data, previewUrl: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, '') || 'image' },
    })
  }

  const openSubmit = async () => {
    if (!(await flush())) return
    await side.refresh()
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
        result.conflict ? '다른 사람의 변경과 겹쳐 PR로 올렸습니다. 개발자가 합친 뒤 반영됩니다' : 'PR을 만들었습니다. 검토 후 반영됩니다',
        result.url ? { label: 'PR 보기', run: () => void api.app.openExternal(result.url!) } : undefined,
      )
    }
    await side.runSync(true)
    await side.refresh()
    if (doc) await section.open(doc.path).catch(() => undefined)
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
        section.discard()
        await api.workspace.revert(targets.map((t) => t.path))
        const next = pickSection(await api.manual.tree(), doc?.path)
        // 문서를 먼저 연다. 변경 목록이 먼저 비면 그 사이 다른 화면을 연 것을 늦게 덮어쓴다
        if (next) await section.open(next)
        await side.refresh()
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
        const current = doc?.path === path
        if (current) section.discard()
        await api.manual.remove(path)
        const t = await side.refresh()
        if (!current) return
        const first = t && allSections(t)[0]?.path
        if (first) await section.open(first)
        else section.close()
      },
    })
  }

  // 변경 사이 이동. 편집기는 그 줄로, 미리보기만 볼 때는 표시한 문단으로
  const goToChange = (index: number) => {
    const count = review.hunks.length
    if (!count) return
    const next = ((index % count) + count) % count
    setReviewIndex(next)
    if (layout !== 'preview') section.editor.current?.goToLine(review.hunks[next].from)
    else {
      const marks = previewRef.current?.querySelectorAll(`[${REVIEW_ATTR}]`)
      if (marks?.length) marks[Math.round((next * (marks.length - 1)) / Math.max(1, count - 1))].scrollIntoView({ block: 'center' })
    }
  }

  useEffect(() => {
    setReviewIndex(0)
  }, [doc?.path, review.active])

  useEffect(() => {
    if (!doc || jumpToReview.current !== doc.path || !review.hunks.length) return
    jumpToReview.current = undefined
    // 미리보기가 다 그려진 뒤에 옮긴다
    setTimeout(() => goToChange(0), 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, review.hunks])

  const finishReview = async () => {
    try {
      await review.clear()
      await side.refresh()
      toast.show('success', 'Claude 변경 검토를 마쳤습니다')
    } catch (e) {
      toast.error(e)
    }
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
    if (isVideoDraft(task.input) || !task.result) return
    void side.refresh().then(async () => {
      if (doc) await section.open(doc.path).catch(() => undefined)
    })
  })

  // 순서를 바꾸면 폴더/파일 번호가 바뀐다. 지금 연 화면을 번호를 뺀 이름으로 다시 찾는다
  const reopenAfterMove = async () => {
    const t = await api.manual.tree()
    side.setTree(t)
    if (!doc) return
    const key = (path: string) => path.split('/').map((p) => p.replace(/^\d+-/, '')).join('/')
    const next = allSections(t).find((s) => key(s.path) === key(doc.path))
    if (next && next.path !== doc.path) await section.open(next.path)
    await side.refresh()
  }

  const move = async (run: () => Promise<unknown>) => {
    if (!(await flush())) return
    try {
      await run()
      await reopenAfterMove()
    } catch (e) {
      toast.error(e)
    }
  }

  // 다른 매뉴얼로 바꾸면 목차와 첫 화면을 다시 연다. saved: 설정 화면에서 이미 바꾼 설정
  const switchManual = async (id: string, saved?: Settings) => {
    if (!(await flush())) return
    try {
      setSettings(saved ?? (await api.settings.update({ manual: id })))
      storage(LAST_PATH, '')
      section.close()
      const t = await side.refresh()
      const first = t && allSections(t)[0]?.path
      if (first) await section.open(first)
    } catch (e) {
      toast.error(e)
    }
  }

  const currentChapter = tree?.chapters.find((c) => doc?.path.startsWith(`${c.dir}/`))
  const claudeRunning = tasks.claude?.phase === 'running'
  // Claude가 지금 이 화면을 고치는 중이면 편집을 막는다 (끝나면 디스크에서 다시 읽는다)
  const docLocked = Boolean(claudeRunning && doc && tasks.claude && isDraftTarget(tasks.claude.input, doc.path))

  return (
    <div className="workbench">
      <TitleBar
        tree={tree}
        sync={sync}
        syncing={side.syncing}
        changes={changes.length}
        currentChapter={currentChapter}
        flush={flush}
        onSync={() => void side.runSync()}
        onSwitchManual={(id) => void switchManual(id)}
        onImport={() => setDialog({ type: 'import' })}
        onCapture={() => setCapturing(true)}
        onSubmit={() => void openSubmit()}
        onSettings={() => setDialog({ type: 'settings' })}
      />

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
          todos={side.todos}
          changes={changes}
          current={doc?.path}
          onOpen={(path) => void section.open(path)}
          onOpenTodo={(t) => void section.open(t.path, t.line)}
          onNewSection={(chapterDir) => setDialog({ type: 'new', chapterDir })}
          onRemoveSection={askRemove}
          onRevert={askRevert}
          onMoveChapter={(dir, i) => void move(() => api.manual.moveChapter(dir, i))}
          onMoveSection={(path, i) => void move(() => api.manual.moveSection(path, i))}
          onRefresh={(target) => void startRefresh(target)}
          onDiff={(c) => setDialog({ type: 'diff', path: c.path, title: c.label })}
        />

        <main className="document">
          {doc ? (
            <DocumentPane
              doc={doc}
              docVersion={section.version}
              body={section.body}
              title={findSection(tree, doc.path)?.title ?? doc.path}
              chapter={currentChapter}
              saveState={section.saveState}
              layout={layout}
              locked={docLocked}
              preview={preview}
              editor={section.editor}
              previewRef={previewRef}
              onLayout={setLayout}
              onChange={section.change}
              onSaveMeta={section.saveMeta}
              onRefresh={() => currentChapter && void startRefresh({ chapterDir: currentChapter.dir, path: doc.path })}
              onInsertImage={() => setDialog({ type: 'image' })}
              onImageFile={(f) => void onImageFile(f)}
              review={
                review.active
                  ? {
                      hunks: review.hunks,
                      at: review.at,
                      beforeHtml: review.beforeHtml,
                      index: Math.min(reviewIndex, review.hunks.length - 1),
                      onGo: goToChange,
                      onDone: () => void finishReview(),
                    }
                  : undefined
              }
            />
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
              side.scheduleRefresh()
              setPreviewNonce((n) => n + 1)
            }}
            onClose={() => {
              setCapturing(false)
              void side.refresh()
              if (doc) void section.open(doc.path)
            }}
          />
        </div>
      )}

      {tasks.videoPanel && (
        <div className="overlay">
          <VideoPanel
            currentSection={doc?.path}
            initial={tasks.videoPanel.initial}
            onClose={() => {
              tasks.closeVideo()
              void side.refresh()
            }}
          />
        </div>
      )}

      {/* 영상 패널 위에도 뜨도록 뒤에 둔다 (영상 초안·장면 채우기) */}
      {tasks.draftPanel && (
        <div className="overlay">
          <DraftPanel
            key={tasks.draftPanel.id}
            panel={tasks.draftPanel}
            onOpenSection={(path) => {
              tasks.clearClaude()
              tasks.closeVideo()
              jumpToReview.current = path
              void side.refresh().then(() => section.open(path))
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
            section.editor.current?.insert(md)
            side.scheduleRefresh()
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
            await side.refresh()
            await section.open(path)
            setTab('toc')
          }}
          onDraft={async (input) => {
            setDialog(null)
            if (await flush()) tasks.openDraft(input)
          }}
        />
      )}
      {dialog?.type === 'submit' && settings && (
        <SubmitDialog changes={changes} sync={sync} settings={settings} onClose={() => setDialog(null)} onDone={(r) => void onSubmitted(r)} />
      )}
      {dialog?.type === 'diff' && <DiffDialog path={dialog.path} title={dialog.title} onClose={() => setDialog(null)} />}
      {dialog?.type === 'import' && (
        <ImportWizard
          onClose={() => setDialog(null)}
          onDone={(id) => {
            setDialog(null)
            void switchManual(id).then(() => toast.show('success', '새 매뉴얼을 가져왔습니다. 미리보기로 확인한 뒤 제출하세요'))
          }}
        />
      )}
      {dialog?.type === 'settings' && (
        <SettingsDialog
          onClose={() => {
            setDialog(null)
            // 매뉴얼 설정(제목, 버전)이 바뀌었을 수 있다
            void side.refresh()
          }}
          onSettings={(next) => {
            if (next.manual !== settings?.manual) void switchManual(next.manual, next)
            else setSettings(next)
          }}
          onOpenSection={(path) => {
            setDialog(null)
            void section.open(path)
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
