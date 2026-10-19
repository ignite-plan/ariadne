// 가이드 영상 패널의 다이얼로그: 새 영상, Claude로 장면 하나 채우기
import { useEffect, useState } from 'react'
import type { ManualTree, VideoScenario } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { useAsyncAction } from '../hooks.ts'
import { findSection } from '../manual-tree.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { SectionsSelect } from './SectionSelect.tsx'

export function CreateVideoDialog({
  tree,
  currentSection,
  onClose,
  onCreated,
}: {
  tree?: ManualTree
  currentSection?: string
  onClose: () => void
  onCreated: (scenario: VideoScenario) => void
}) {
  const [sections, setSections] = useState(currentSection ? [currentSection] : [])
  const [title, setTitle] = useState('')
  const { run, busy, error } = useAsyncAction()

  // 지금 화면이 있으면 그 제목으로 시작한다
  useEffect(() => {
    const current = findSection(tree, currentSection)
    if (current) setTitle((v) => v || current.title)
  }, [tree, currentSection])

  const create = () => run(async () => onCreated(await api.video.create({ title, sections })))

  return (
    <Modal
      title="새 영상"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" onClick={() => void create()} disabled={!title.trim() || busy}>
            만들기
          </button>
        </>
      }
    >
      <div className="field">
        <span>연결할 화면 (여러 개면 이 순서로 보여 줍니다)</span>
        <SectionsSelect
          tree={tree}
          value={sections}
          onChange={(paths) => {
            // 첫 화면을 고르면 그 제목으로 시작한다 (직접 고친 제목은 두 번째 화면부터는 그대로)
            if (!sections.length && paths[0]) setTitle(findSection(tree, paths[0])?.title ?? title)
            setSections(paths)
          }}
        />
      </div>
      <label className="field">
        <span>영상 제목 (영어, 시작 카드에 나옵니다)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dealer List View" autoFocus />
      </label>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}

// 장면 하나를 Claude로 채울 때: 보여 줄 내용(한국어 가능)과 채우기/새 장면 넣기
export function SceneDraftDialog({
  scene,
  say,
  onClose,
  onStart,
}: {
  scene: number
  say?: string
  onClose: () => void
  onStart: (notes: string, insert: boolean) => void
}) {
  // 영어 내레이션이 아니면(요청을 적어 둔 것이면) 요청 칸에 옮겨 둔다
  const [notes, setNotes] = useState(say && /[^\x00-\x7F]/.test(say) ? say : '')
  const [insert, setInsert] = useState(false)
  return (
    <Modal
      title={`Claude로 장면 ${scene + 1}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={!notes.trim()} onClick={() => onStart(notes.trim(), insert)}>
            <Icon name="sparkle" /> 다음
          </button>
        </>
      }
    >
      <label className="field">
        <span>이 장면에서 보여 줄 것 (한국어로 써도 됩니다)</span>
        <textarea
          rows={4}
          value={notes}
          autoFocus
          onChange={(e) => setNotes(e.target.value)}
          placeholder="예: Menu Access Permission > Job title에서 Edit을 눌러 나오는 팝업에서 체크박스를 체크하는 화면"
        />
      </label>
      <div className="editor-checks">
        <label>
          <input type="radio" checked={!insert} onChange={() => setInsert(false)} />
          장면 {scene + 1} 채우기 (지금 내용을 바꿈)
        </label>
        <label>
          <input type="radio" checked={insert} onChange={() => setInsert(true)} />
          장면 {scene + 1} 다음에 새 장면으로 추가
        </label>
      </div>
      <p className="muted">Claude가 앞 장면을 STG에서 재생해 이 장면이 시작되는 화면부터 살펴보고, 영어 내레이션과 단계를 씁니다. 다른 장면은 그대로입니다.</p>
    </Modal>
  )
}
