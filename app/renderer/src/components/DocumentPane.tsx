// 열린 화면: 위치·최신화·저장 상태·보기 방식, front-matter, 편집기 도구 막대, 편집기와 미리보기
import type { RefObject } from 'react'
import type { ManualTree, PreviewChapter, PreviewScope, SectionDoc, SectionMeta } from '../../../shared/api.ts'
import { formatAge } from '../../../shared/format.ts'
import type { ReviewHunk } from '../../../shared/review-diff.ts'
import type { SaveState } from '../workbench-state.ts'
import { useToast } from './Toast.tsx'
import { Editor, type EditorHandle } from './Editor.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { MetaPanel } from './MetaPanel.tsx'
import { FullPreview } from './FullPreview.tsx'
import { Preview } from './Preview.tsx'

export type Layout = 'editor' | 'split' | 'preview'

const SCOPES: { id: PreviewScope; label: string; title: string }[] = [
  { id: 'section', label: '이 화면', title: '지금 화면만 (TODO도 보임)' },
  { id: 'chapter', label: '이 장', title: '지금 장의 화면을 Word 순서대로 이어서 (TODO는 Word처럼 뺌)' },
  { id: 'all', label: '전체', title: '매뉴얼 전체를 Word와 같은 순서·내용으로 (TODO는 Word처럼 뺌)' },
]

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
  review,
  previewScope,
  onPreviewScope,
  full,
  onOpenSection,
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
  // 미리보기 범위: 이 화면 / 이 장 / 전체 (장·전체는 Word와 같은 내용)
  previewScope: PreviewScope
  onPreviewScope: (scope: PreviewScope) => void
  full: { chapters?: PreviewChapter[]; loading: boolean; error?: string }
  onOpenSection: (path: string) => void
  // Claude 변경 검토 중이면 바뀐 곳과 이동·검토 완료
  review?: {
    hunks: ReviewHunk[]
    at?: number
    beforeHtml?: string
    index: number
    onGo: (index: number) => void
    onDone: () => void
  }
}) {
  const toast = useToast()
  // 나란히 볼 때 편집기 스크롤에 미리보기를 맞춘다. 장·전체 미리보기면 지금 화면 구간 안에서 맞춘다
  const syncScroll = (ratio: number) => {
    const el = previewRef.current
    if (!el || layout !== 'split') return
    if (previewScope === 'section') {
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
      return
    }
    const current = el.querySelector<HTMLElement>('[data-current="true"]')
    if (!current) return
    const top = current.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    el.scrollTop = top + ratio * Math.max(0, current.offsetHeight - el.clientHeight)
  }
  // Word에 표기가 글자로 나오는 화면 수 (장·전체 미리보기)
  const issueSections = previewScope === 'section' ? [] : (full.chapters ?? []).flatMap((c) => c.sections.filter((s) => s.issues.length))
  const goToIssue = () => {
    const first = previewRef.current?.querySelector<HTMLElement>('.full-section.has-issue')
    first?.scrollIntoView({ block: 'start', behavior: 'smooth' })
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
      {review && review.hunks.length > 0 && (
        <div className="review-bar">
          <Icon name="sparkle" size={14} />
          <b>Claude 변경</b>
          <span className="review-count">
            {review.index + 1} / {review.hunks.length}
          </span>
          <button className="icon-button small" onClick={() => review.onGo(review.index - 1)} title="이전 변경" aria-label="이전 변경">
            <Icon name="up" size={14} />
          </button>
          <button className="icon-button small" onClick={() => review.onGo(review.index + 1)} title="다음 변경" aria-label="다음 변경">
            <Icon name="down" size={14} />
          </button>
          <span className="muted ellipsis">
            {review.at ? `${Date.now() - review.at < 60000 ? '방금' : formatAge(Date.now() - review.at)} 최신화 · ` : ''}
            <span className="review-legend ins">넣은 글자</span> <span className="review-legend del">지운 글자</span>
          </span>
          <span className="spacer" />
          <button className="button small" onClick={review.onDone} title="표시를 끕니다. 내용은 그대로 둡니다">
            <Icon name="check" size={14} /> 검토 완료
          </button>
        </div>
      )}
      <fieldset className="lock" disabled={locked}>
        <MetaPanel meta={doc.meta} onSave={onSaveMeta} />
      </fieldset>
      <div className={`panes ${layout}`}>
        <div className="pane editor-pane">
          <div className="toolbar">
          <fieldset className="lock tool-group" disabled={locked}>
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
          </fieldset>
          <span className="spacer" />
          {/* 찾기는 Claude가 고치는 중(잠김)에도 된다. 바꾸기만 막는다 */}
          <ToolButton icon="search" label="찾기·바꾸기 (⌘F, ⌥⌘F)" onClick={() => editor.current?.openSearch()} />
          <fieldset className="lock tool-group" disabled={locked}>
            <ToolButton icon="undo" label="되돌리기 (⌘Z)" onClick={() => editor.current?.undo()} />
            <ToolButton icon="redo" label="다시 실행 (⇧⌘Z)" onClick={() => editor.current?.redo()} />
          </fieldset>
          </div>
          <Editor
            readOnly={locked}
            ref={editor}
            docKey={`${doc.path}#${docVersion}`}
            value={body}
            onChange={onChange}
            onImageFile={onImageFile}
            onScrollRatio={syncScroll}
            review={review?.hunks}
          />
        </div>
        <div className="pane preview-pane">
          <div className="preview-bar">
            <div className="segmented small" role="group" aria-label="미리보기 범위">
              {SCOPES.map((s) => (
                <button key={s.id} className={previewScope === s.id ? 'active' : ''} onClick={() => onPreviewScope(s.id)} title={s.title}>
                  {s.label}
                </button>
              ))}
            </div>
            {full.loading && previewScope !== 'section' && <Icon name="sync" size={13} className="spin muted" />}
            {issueSections.length > 0 && (
              <button
                className="button small ghost preview-issues"
                onClick={goToIssue}
                title={`Word에 **나 {.mark} 같은 표기가 글자로 그대로 나오는 화면: ${issueSections.map((s) => s.title).join(', ')}`}
              >
                <Icon name="alert" size={13} /> Word 표기 문제 {issueSections.length}
              </button>
            )}
          </div>
          {previewScope === 'section' ? (
            <Preview ref={previewRef} html={preview.html} error={preview.error} beforeHtml={review?.beforeHtml} />
          ) : (
            <FullPreview
              ref={previewRef}
              chapters={full.chapters}
              loading={full.loading}
              error={full.error}
              currentPath={doc.path}
              liveHtml={preview.html}
              onOpenSection={onOpenSection}
            />
          )}
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
