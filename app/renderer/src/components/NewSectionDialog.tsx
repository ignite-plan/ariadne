import { useState } from 'react'
import type { ManualTree } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Modal } from './Modal.tsx'

const NEW_CHAPTER = '__new__'

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function NewSectionDialog({
  tree,
  chapterDir,
  onCreated,
  onClose,
}: {
  tree: ManualTree
  chapterDir?: string
  onCreated: (path: string) => void
  onClose: () => void
}) {
  const [chapter, setChapter] = useState(chapterDir ?? tree.chapters.at(-1)?.dir ?? NEW_CHAPTER)
  const [chapterTitle, setChapterTitle] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const path = await api.manual.create(
        chapter === NEW_CHAPTER ? { title, newChapterTitle: chapterTitle } : { title, chapterDir: chapter },
      )
      onCreated(path)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const nextNo = Math.max(0, ...tree.chapters.map((c) => c.no)) + 1
  const ready = slug(title) && (chapter !== NEW_CHAPTER || slug(chapterTitle))

  return (
    <Modal
      title="새 화면 추가"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={!ready || busy} onClick={create}>
            추가
          </button>
        </>
      }
    >
      <label className="field">
        <span>장</span>
        <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
          {tree.chapters.map((c) => (
            <option key={c.dir} value={c.dir}>
              {c.no}. {c.title}
            </option>
          ))}
          <option value={NEW_CHAPTER}>+ 새 장 ({nextNo}장)</option>
        </select>
      </label>
      {chapter === NEW_CHAPTER && (
        <label className="field">
          <span>새 장 이름 (영어)</span>
          <input value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="Enrollment Management" />
        </label>
      )}
      <label className="field">
        <span>화면 이름 (영어, 매뉴얼 제목으로 쓰입니다)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ready && !busy && create()}
          placeholder="Enrollment Request List"
          autoFocus
        />
      </label>
      {slug(title) && <p className="hint">파일: …/{slug(title)}.md</p>}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
