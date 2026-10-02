import { useEffect, useState } from 'react'
import type { ReportResult } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'

const REPORT_EVENT = 'ariadne:report'

// 어디서든 신고 창을 연다 (오류 토스트의 [신고] 등)
export function openReport(error?: string) {
  window.dispatchEvent(new CustomEvent(REPORT_EVENT, { detail: { error } }))
}

// 앱 맨 위에 하나 둔다. 도움말 메뉴, 오류 토스트, 설정에서 연다
export function ReportHost() {
  const [open, setOpen] = useState<{ error?: string }>()
  useEffect(() => {
    const onEvent = (e: Event) => setOpen({ error: (e as CustomEvent<{ error?: string }>).detail?.error })
    window.addEventListener(REPORT_EVENT, onEvent)
    const off = api.on('open-report', () => setOpen({}))
    return () => {
      window.removeEventListener(REPORT_EVENT, onEvent)
      off()
    }
  }, [])
  return open ? <ReportDialog error={open.error} onClose={() => setOpen(undefined)} /> : null
}

function ReportDialog({ error, onClose }: { error?: string; onClose: () => void }) {
  const toast = useToast()
  const [description, setDescription] = useState('')
  const [includeLog, setIncludeLog] = useState(true)
  const [preview, setPreview] = useState<{ title: string; body: string }>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ReportResult>()
  const [failure, setFailure] = useState('')

  // 보낼 내용을 미리 보여 준다 (토큰·키·홈 경로는 가린 상태)
  useEffect(() => {
    const handle = setTimeout(() => {
      api.report.preview({ description, error, includeLog }).then(setPreview, () => setPreview(undefined))
    }, 300)
    return () => clearTimeout(handle)
  }, [description, error, includeLog])

  const submit = async () => {
    setBusy(true)
    setFailure('')
    try {
      const r = await api.report.submit({ description, error, includeLog })
      setResult(r)
      if (r.via === 'api') toast.show('success', '신고했습니다. 고마워요!')
    } catch (e) {
      setFailure(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="문제 신고"
      onClose={onClose}
      dismissible={!busy}
      width={640}
      footer={
        result ? (
          <button className="button primary" onClick={onClose}>
            닫기
          </button>
        ) : (
          <>
            {failure && <span className="form-error inline">{failure}</span>}
            <button className="button" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button className="button primary" onClick={submit} disabled={busy || (!description.trim() && !error)}>
              {busy ? '보내는 중…' : '신고 보내기'}
            </button>
          </>
        )
      }
    >
      {result ? (
        result.via === 'api' ? (
          <div className="report-done">
            <Icon name="check" size={20} />
            <p>
              신고가 접수되었습니다. 개발자가 확인합니다.
              <br />
              <button className="link" onClick={() => api.app.openExternal(result.url)}>
                신고 보기 <Icon name="external" size={12} />
              </button>
            </p>
          </div>
        ) : (
          <div className="report-done warn">
            <Icon name="info" size={20} />
            <p>
              토큰에 GitHub Issue 권한이 없어 브라우저에서 새 Issue 화면을 열었습니다. 내용이 채워져 있으니 <b>[Submit new issue]</b>를 눌러
              주세요. 전체 내용은 클립보드에도 복사해 두었습니다.
            </p>
          </div>
        )
      ) : (
        <>
          {error && (
            <div className="report-error">
              <b>화면에 나온 오류</b>
              <code>{error}</code>
            </div>
          )}
          <label className="field">
            <span>무엇을 하다가 생겼나요? (어떤 화면에서 무엇을 눌렀는지)</span>
            <textarea
              rows={4}
              value={description}
              autoFocus
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: Dealer List View에서 [캡처]를 누르고 3장 캡처를 했더니 멈췄습니다"
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={includeLog} onChange={(e) => setIncludeLog(e.target.checked)} />
            최근 로그 첨부 (원인을 찾는 데 도움이 됩니다)
          </label>
          <details className="report-preview">
            <summary>보낼 내용 보기 · 토큰·API 키·내 컴퓨터 경로는 가려집니다</summary>
            {preview ? (
              <>
                <p className="muted">
                  {preview.title} → GitHub 매뉴얼 리포 Issue
                </p>
                <pre>{preview.body}</pre>
              </>
            ) : (
              <p className="muted">만드는 중…</p>
            )}
          </details>
        </>
      )}
    </Modal>
  )
}
