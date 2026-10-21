import { useState } from 'react'
import type { FileChange, Settings, SubmitResult, SyncState } from '../../../shared/api.ts'
import { CHANGE_STATUS_LABEL as STATUS_LABEL } from '../../../shared/format.ts'
import { api } from '../api.ts'
import { useAsyncAction } from '../hooks.ts'
import { Modal } from './Modal.tsx'

function defaultMessage(changes: FileChange[]) {
  const sections = [...new Set(changes.filter((c) => c.kind === 'section').map((c) => c.label))]
  const images = changes.filter((c) => c.kind === 'image').length
  const parts = sections.slice(0, 3)
  const rest = sections.length - parts.length
  const removed = changes.filter((c) => c.kind === 'manual-removed').map((c) => c.path.split('/')[1])
  const edited = parts.length ? `${parts.join(', ')}${rest > 0 ? ` 외 ${rest}건` : ''} 수정` : ''
  const subject = [removed.length ? `매뉴얼 삭제 (${removed.join(', ')})` : '', edited].filter(Boolean).join(', ') || '매뉴얼 수정'
  return `docs: ${subject}${images ? ` (이미지 ${images}장)` : ''}`
}

export function SubmitDialog({
  changes,
  sync,
  settings,
  onDone,
  onRecorded,
  onClose,
}: {
  changes: FileChange[]
  sync?: SyncState
  settings: Settings
  onDone: (result: SubmitResult) => void
  // 내 PC에 기록만 했을 때 (지금까지 기록 수)
  onRecorded: (recorded: number) => void
  onClose: () => void
}) {
  const [message, setMessage] = useState(() => defaultMessage(changes))
  const { run, busy, error } = useAsyncAction()

  const submit = () => run(async () => onDone(await api.workspace.submit(message)))
  const record = () => run(async () => onRecorded((await api.workspace.record(message)).recorded))

  const recorded = sync?.recorded ?? 0
  const pendingCommit = !changes.length && !recorded && (sync?.status === 'ahead' || sync?.status === 'diverged')

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
          <button
            className="button"
            onClick={record}
            disabled={busy || !changes.length}
            title="원격에 올리지 않고 내 PC에만 기록합니다. 고친 내용이 이력에 남아 날아가지 않습니다"
          >
            내 PC에 기록만
          </button>
          <button className="button primary" onClick={submit} disabled={busy || (!changes.length && !pendingCommit)}>
            {busy ? '올리는 중…' : settings.submitMode === 'push' ? '제출하고 바로 반영' : '제출 (PR)'}
          </button>
        </>
      }
    >
      {pendingCommit && <p className="notice">지난번에 올리지 못한 변경이 있습니다. 다시 제출합니다.</p>}
      {recorded > 0 && (
        <p className="notice">내 PC에만 기록한 것이 {recorded}건 있습니다. 제출하면 아래 변경과 함께 한 번에 올라갑니다.</p>
      )}
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
        [내 PC에 기록만]은 원격에 올리지 않고 이력만 남깁니다(오프라인에서도 됩니다).{' '}
        {settings.submitMode === 'push'
          ? '매뉴얼 원본(main)에 바로 반영합니다. 다른 사람과 같은 곳을 고쳤으면 자동으로 PR을 만들어 개발자에게 넘깁니다.'
          : 'PR을 만들어 개발자 검토 후 반영합니다.'}
      </p>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
