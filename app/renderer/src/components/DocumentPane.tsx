// 열린 화면: 위치·최신화·저장 상태·보기 방식, front-matter, 편집기 도구 막대, 편집기와 미리보기
import type { RefObject } from 'react'
import type { ManualTree, SectionDoc, SectionMeta } from '../../../shared/api.ts'
import type { SaveState } from '../workbench-state.ts'
import { useToast } from './Toast.tsx'
import { Editor, type EditorHandle } from './Editor.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { MetaPanel } from './MetaPanel.tsx'
import { Preview } from './Preview.tsx'

export type Layout = 'editor' | 'split' | 'preview'

const SAVE_LABEL: Record<SaveState, string> = { saved: '저장됨', pending: '입력 중', saving: '저장 중…', error: '저장 실패' }

export function DocumentPane({
  doc,
  docVersion,
  body,
  title,
  chapter,
  saveState,
  layout,
  locked,
  preview,
  editor,
  previewRef,
  onLayout,
  onChange,
  onSaveMeta,
  onRefresh,
  onInsertImage,
  onImageFile,
}: {
  doc: SectionDoc
  docVersion: number
  body: string
  title: string
  chapter?: ManualTree['chapters'][number]
  saveState: SaveState
  layout: Layout
  // Claude가 이 화면을 고치는 중이면 편집을 막는다 (끝나면 디스크에서 다시 읽는다)
  locked: boolean
  preview: { html?: string; error?: string }
  editor: RefObject<EditorHandle | null>
  previewRef: RefObject<HTMLDivElement | null>
  onLayout: (layout: Layout) => void
  onChange: (text: string) => void
  onSaveMeta: (meta: SectionMeta) => Promise<void>
  onRefresh: () => void
  onInsertImage: () => void
  onImageFile: (file: File) => void
}) {
  const toast = useToast()
  // 나란히 볼 때 편집기 스크롤에 미리보기를 맞춘다
  const syncScroll = (ratio: number) => {
    const el = previewRef.current
    if (!el || layout !== 'split') return
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  return (
    <>
      <div className="doc-header">
        <div className="breadcrumb ellipsis">
          {chapter && (
            <span className="muted">
              {chapter.no}. {chapter.title} /
            </span>
          )}{' '}
          {title}
        </div>
        {chapter && (
          <button className="button small ghost" title="최신 Confluence 기획서와 STG 화면에 맞춰 이 화면을 고칩니다" onClick={onRefresh}>
            <Icon name="sparkle" size={14} /> Claude로 최신화
          </button>
        )}
        <span className={`save-state ${saveState}`}>{SAVE_LABEL[saveState]}</span>
        <div className="segmented small">
          <button className={layout === 'editor' ? 'active' : ''} onClick={() => onLayout('editor')} title="편집만">
            편집
          </button>
          <button className={layout === 'split' ? 'active' : ''} onClick={() => onLayout('split')} title="나란히">
            <Icon name="split" size={13} />
          </button>
          <button className={layout === 'preview' ? 'active' : ''} onClick={() => onLayout('preview')} title="미리보기만">
            미리보기
          </button>
        </div>
      </div>
      {locked && (
        <p className="notice doc-lock">Claude가 이 화면을 고치는 중입니다. 끝나면 고친 내용으로 다시 열리고, 그때부터 편집할 수 있습니다.</p>
      )}
      <fieldset className="lock" disabled={locked}>
        <MetaPanel meta={doc.meta} onSave={onSaveMeta} />
      </fieldset>
      <div className={`panes ${layout}`}>
        <div className="pane editor-pane">
          <fieldset className="lock toolbar" disabled={locked}>
            <ToolButton icon="bold" label="굵게 (항목 이름)" onClick={() => editor.current?.wrap('**', '**', 'Label')} />
            <ToolButton icon="button" label="버튼 이름 [Save]" onClick={() => editor.current?.wrap('**\\[', '\\]**', 'Button')} />
            <ToolButton icon="highlight" label="노란 형광펜 (선택한 글자, 다시 누르면 해제)" onClick={() => editor.current?.toggleMark()} />
            <span className="divider" />
            <ToolButton icon="list" label="목록" onClick={() => editor.current?.prefixLines('- ')} />
            <ToolButton icon="indent" label="하위 목록" onClick={() => editor.current?.prefixLines('  ')} />
            <span className="divider" />
            <ToolButton icon="image" label="이미지 넣기" onClick={onInsertImage} />
            <ToolButton
              icon="center"
              label="이미지 가운데 정렬 (커서가 있는 줄의 이미지, 다시 누르면 해제)"
              onClick={() => {
                if (editor.current && !editor.current.toggleCenter()) toast.show('info', '이미지가 있는 줄에 커서를 두고 누르세요')
              }}
            />
            <ToolButton icon="flag" label="TODO 남기기 (확인 필요한 내용)" onClick={() => editor.current?.wrap('<!-- TODO: ', ' -->', '확인 필요')} />
            <span className="spacer" />
            <ToolButton icon="undo" label="되돌리기 (⌘Z)" onClick={() => editor.current?.undo()} />
            <ToolButton icon="redo" label="다시 실행 (⇧⌘Z)" onClick={() => editor.current?.redo()} />
          </fieldset>
          <Editor
            readOnly={locked}
            ref={editor}
            docKey={`${doc.path}#${docVersion}`}
            value={body}
            onChange={onChange}
            onImageFile={onImageFile}
            onScrollRatio={syncScroll}
          />
        </div>
        <div className="pane preview-pane">
          <Preview ref={previewRef} html={preview.html} error={preview.error} />
        </div>
      </div>
    </>
  )
}

function ToolButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="tool" onClick={onClick} title={label} aria-label={label}>
      <Icon name={icon} size={15} />
    </button>
  )
}
