import { useState } from 'react'
import type { FileChange, Settings, SubmitResult, SyncState } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Modal } from './Modal.tsx'

const STATUS_LABEL = { added: '추가', modified: '수정', deleted: '삭제' } as const

function defaultMessage(changes: FileChange[]) {
  const sections = [...new Set(changes.filter((c) => c.kind === 'section').map((c) => c.label))]
  const images = changes.filter((c) => c.kind === 'image').length
  const parts = sections.slice(0, 3)
  const rest = sections.length - parts.length
  const subject = parts.length ? `${parts.join(', ')}${rest > 0 ? ` 외 ${rest}건` : ''} 수정` : '매뉴얼 수정'
  return `docs: ${subject}${images ? ` (이미지 ${images}장)` : ''}`
}

export function SubmitDialog({
  changes,
  sync,
  settings,
  onDone,
  onClose,
}: {
  changes: FileChange[]
  sync?: SyncState
  settings: Settings
  onDone: (result: SubmitResult) => void
  onClose: () => void
}) {
  const [message, setMessage] = useState(() => defaultMessage(changes))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      onDone(await api.workspace.submit(message))
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const pendingCommit = !changes.length && (sync?.status === 'ahead' || sync?.status === 'diverged')

  return (
    <Modal
      title="변경사항 제출"
      onClose={() => !busy && onClose()}
      dismissible={!busy}
      width={560}
      footer={
        <>
          <button className="button" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="button primary" onClick={submit} disabled={busy || (!changes.length && !pendingCommit)}>
            {busy ? '올리는 중…' : settings.submitMode === 'push' ? '제출하고 바로 반영' : '제출 (PR)'}
          </button>
        </>
      }
    >
      {pendingCommit && <p className="notice">지난번에 올리지 못한 변경이 있습니다. 다시 제출합니다.</p>}
      {changes.length > 0 && (
        <ul className="submit-list">
          {changes.map((c) => (
            <li key={c.path}>
              <span className={`status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
              <span className="ellipsis">{c.label}</span>
            </li>
          ))}
        </ul>
      )}
      <label className="field">
        <span>무엇을 바꿨나요</span>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="hint">
        {settings.submitMode === 'push'
          ? '매뉴얼 원본(main)에 바로 반영합니다. 다른 사람과 같은 곳을 고쳤으면 자동으로 PR을 만들어 개발자에게 넘깁니다.'
          : 'PR을 만들어 개발자 검토 후 반영합니다.'}
      </p>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
