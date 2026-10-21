// 매뉴얼 삭제 확인. 실수로 지우지 않게 매뉴얼 id를 직접 입력해야 지울 수 있다
import { useState } from 'react'
import type { ManualInfo } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { useAsyncAction } from '../hooks.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'

export function DeleteManualDialog({ manual, onDeleted, onClose }: { manual: ManualInfo; onDeleted: () => void; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const { run, busy, error } = useAsyncAction()
  const remove = () =>
    run(async () => {
      await api.manual.deleteManual(manual.id)
      onDeleted()
    })

  return (
    <Modal
      title="매뉴얼 삭제"
      onClose={() => !busy && onClose()}
      dismissible={!busy}
      width={460}
      footer={
        <>
          <button className="button" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="button danger" onClick={remove} disabled={busy || typed.trim() !== manual.id}>
            <Icon name="trash" size={14} /> {busy ? '지우는 중…' : '삭제'}
          </button>
        </>
      }
    >
      <p>
        <b>{manual.title}</b> <span className="muted">({manual.id})</span>
        <br />
        화면 {manual.sections}개, 이미지 {manual.images}장을 모두 지웁니다.
      </p>
      <p className="notice">
        <b>제출하면 모든 사람의 앱에서 사라집니다.</b> 제출하기 전에는 변경 탭의 되돌리기로 그대로 돌아옵니다.
      </p>
      <label className="field">
        <span>
          확인을 위해 매뉴얼 id <code>{manual.id}</code>를 입력하세요
        </span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={manual.id} autoFocus aria-label="매뉴얼 id 확인" />
      </label>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
