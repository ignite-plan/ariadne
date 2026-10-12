import { useState } from 'react'
import type { DraftInput, ManualTree } from '../../../shared/api.ts'
import { slugify as slug } from '../../../../src/core/naming.ts'
import { api } from '../api.ts'
import { useAsyncAction } from '../hooks.ts'
import { Modal } from './Modal.tsx'

const NEW_CHAPTER = '__new__'
const END = -1

// 직접 쓰기: 빈 화면 파일을 만든다 / Claude: 초안 패널로 넘긴다
export function NewSectionDialog({
  tree,
  chapterDir,
  onCreated,
  onDraft,
  onClose,
}: {
  tree: ManualTree
  chapterDir?: string
  onCreated: (path: string) => void
  onDraft: (input: DraftInput) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'manual' | 'claude'>('claude')
  const [chapter, setChapter] = useState(chapterDir ?? NEW_CHAPTER)
  const [chapterTitle, setChapterTitle] = useState('')
  const [position, setPosition] = useState(END)
  const [title, setTitle] = useState('')
  const [menu, setMenu] = useState('')
  const [path, setPath] = useState('')
  const [notes, setNotes] = useState('')
  const { run, busy, error } = useAsyncAction()

  const isNew = chapter === NEW_CHAPTER
  const chapterIndex = position === END ? undefined : position

  const create = () =>
    run(async () =>
      onCreated(await api.manual.create(isNew ? { title, newChapterTitle: chapterTitle, chapterIndex } : { title, chapterDir: chapter })),
    )

  const draft = () =>
    onDraft({
      menu: menu.trim(),
      ...(isNew ? { newChapterTitle: (chapterTitle || menu).trim(), chapterIndex } : { chapterDir: chapter }),
      path: path.trim() || undefined,
      notes: notes.trim() || undefined,
    })

  const ready =
    mode === 'manual'
      ? slug(title) && (!isNew || slug(chapterTitle))
      : menu.trim() && (!isNew || slug(chapterTitle || menu))

  return (
    <Modal
      title="새 화면 추가"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="button" onClick={onClose}>
            취소
          </button>
          {mode === 'manual' ? (
            <button className="button primary" disabled={!ready || busy} onClick={create}>
              추가
            </button>
          ) : (
            <button className="button primary" disabled={!ready} onClick={draft}>
              다음
            </button>
          )}
        </>
      }
    >
      <div className="segmented">
        <button className={mode === 'claude' ? 'active' : ''} onClick={() => setMode('claude')}>
          Claude로 초안 만들기
        </button>
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>
          빈 화면 직접 쓰기
        </button>
      </div>

      {mode === 'claude' && (
        <>
          <label className="field">
            <span>메뉴 이름 (영어, 기획서·화면에서 찾을 이름)</span>
            <input value={menu} onChange={(e) => setMenu(e.target.value)} placeholder="Menu Management" autoFocus />
          </label>
          <p className="hint first">Claude가 Confluence 기획서에서 화면 구성을 찾고, STG 화면을 열어 화면별 섹션과 캡처를 만듭니다.</p>
        </>
      )}

      <label className="field">
        <span>장</span>
        <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
          <option value={NEW_CHAPTER}>+ 새 장</option>
          {tree.chapters.map((c) => (
            <option key={c.dir} value={c.dir}>
              {c.no}. {c.title}
            </option>
          ))}
        </select>
      </label>
      {isNew && (
        <div className="field-row wide">
          <label className="field">
            <span>새 장 이름 (영어)</span>
            <input
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder={mode === 'claude' ? menu || 'Menu Management' : 'Menu Management'}
            />
          </label>
          <label className="field">
            <span>위치</span>
            <select value={position} onChange={(e) => setPosition(Number(e.target.value))}>
              <option value={END}>맨 뒤 ({tree.chapters.length + 1}장)</option>
              {tree.chapters.map((c, i) => (
                <option key={c.dir} value={i}>
                  {i + 1}장 ({c.title} 앞)
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {mode === 'manual' ? (
        <>
          <label className="field">
            <span>화면 이름 (영어, 매뉴얼 제목으로 쓰입니다)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ready && !busy && create()}
              placeholder="Menu List View"
            />
          </label>
          {slug(title) && <p className="hint">파일: …/{slug(title)}.md</p>}
        </>
      ) : (
        <details className="advanced">
          <summary>더 알려 주기 (선택)</summary>
          <label className="field">
            <span>STG 경로</span>
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/menu" />
          </label>
          <label className="field">
            <span>Claude에게 메모</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="예: 메뉴 권한 팝업도 포함" />
          </label>
        </details>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
