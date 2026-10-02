// STG 로그인 세션 표시와 MFA 로그인. 캡처와 가이드 영상이 같은 세션을 쓴다
import { useEffect, useState } from 'react'
import type { SessionInfo } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'

function age(ms: number) {
  const minutes = Math.round((Date.now() - ms) / 60000)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`
}

export function StgSession({ disabled, onChange }: { disabled?: boolean; onChange?: (session: SessionInfo) => void }) {
  const toast = useToast()
  const [session, setSession] = useState<SessionInfo>({ exists: false })
  const [loggingIn, setLoggingIn] = useState(false)

  const update = (next: SessionInfo) => {
    setSession(next)
    onChange?.(next)
  }

  useEffect(() => {
    void api.capture.session().then(update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async () => {
    setLoggingIn(true)
    try {
      await api.capture.login()
      update(await api.capture.session())
      toast.show('success', '로그인 세션을 저장했습니다')
    } catch (e) {
      if (!errorMessage(e).includes('취소')) toast.error(e)
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <>
      <div className={`session ${session.exists ? 'ok' : ''}`}>
        <Icon name={session.exists ? 'check' : 'login'} />
        <div>
          <b>{session.exists ? 'STG 로그인됨' : 'STG 로그인 필요'}</b>
          <span className="muted">
            {session.exists && session.savedAt ? `${age(session.savedAt)} 로그인` : 'MFA 로그인이 필요합니다'}
          </span>
        </div>
        <button className="button small" onClick={login} disabled={loggingIn || disabled}>
          {session.exists ? '다시 로그인' : '로그인'}
        </button>
      </div>

      {loggingIn && (
        <Modal title="STG 로그인" onClose={() => void api.capture.cancelLogin()} width={440}>
          <ol className="howto">
            <li>방금 열린 Chrome 창에서 STG에 로그인합니다 (MFA 포함)</li>
            <li>메인 화면이 보이면 아래 버튼을 누릅니다</li>
          </ol>
          <div className="actions">
            <button className="button" onClick={() => void api.capture.cancelLogin()}>
              취소
            </button>
            <button className="button primary" onClick={() => void api.capture.finishLogin()}>
              로그인 완료
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
