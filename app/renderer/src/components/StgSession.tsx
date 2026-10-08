// STG 로그인 세션 표시와 MFA 로그인. 캡처·가이드 영상·Claude 작업이 같은 세션(tasks.session)을 본다
import { useEffect, useState } from 'react'
import { formatAge } from '../../../shared/format.ts'
import { api, errorMessage } from '../api.ts'
import { useTasks } from '../tasks.tsx'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'

export function StgSession({ disabled }: { disabled?: boolean }) {
  const toast = useToast()
  // busy: Claude 작업·영상 만들기 등이 공유 Chrome을 쓰는 중. 로그인은 화면이 보이는 Chrome을 따로 띄우므로 그동안 못 한다
  const { session, setSession, reloadSession, stgBusy: busy } = useTasks()
  const [loggingIn, setLoggingIn] = useState(false)
  const [checking, setChecking] = useState(false)

  // 매뉴얼마다 로그인 프로필이 다르다. 패널을 열 때 다시 읽는다
  useEffect(() => {
    void reloadSession()
  }, [reloadSession])

  const login = async () => {
    setLoggingIn(true)
    try {
      await api.capture.login()
      await reloadSession()
      toast.show('success', '로그인 세션을 저장했습니다')
    } catch (e) {
      if (!errorMessage(e).includes('취소')) toast.error(e)
    } finally {
      setLoggingIn(false)
    }
  }

  // 표식만 보고 '로그인됨'이라고 하지 않도록 실제로 STG를 열어 본다
  const check = async () => {
    setChecking(true)
    try {
      const result = await api.capture.checkSession()
      setSession(result)
      if (result.valid) toast.show('success', 'STG 로그인 세션이 살아 있습니다')
      else toast.show('error', 'STG 로그인 세션이 만료되었습니다. 다시 로그인하세요')
    } catch (e) {
      toast.error(e)
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <div className={`session ${session.exists ? 'ok' : ''}`}>
        <Icon name={session.exists ? 'check' : 'login'} />
        <div>
          <b>{session.exists ? 'STG 로그인됨' : 'STG 로그인 필요'}</b>
          <span className="muted">
            {session.exists && session.savedAt ? `${formatAge(Date.now() - session.savedAt)} 확인됨` : 'MFA 로그인이 필요합니다'}
          </span>
        </div>
        <div className="session-actions">
          {session.exists && (
            <button className="button small ghost" onClick={check} disabled={checking || loggingIn || disabled} title="STG를 열어 세션이 살아 있는지 확인합니다">
              {checking ? '확인 중…' : '확인'}
            </button>
          )}
          <button
            className="button small"
            onClick={login}
            disabled={loggingIn || checking || disabled || busy.length > 0}
            title={busy.length && !loggingIn ? `${busy.join(', ')} 중에는 로그인할 수 없습니다` : undefined}
          >
            {session.exists ? '다시 로그인' : '로그인'}
          </button>
        </div>
      </div>

      {loggingIn && (
        <Modal
          title="STG 로그인"
          onClose={() => void api.capture.cancelLogin()}
          width={440}
          footer={
            <>
              <button className="button" onClick={() => void api.capture.cancelLogin()}>
                취소
              </button>
              <button className="button primary" onClick={() => void api.capture.finishLogin()}>
                로그인 완료
              </button>
            </>
          }
        >
          <ol className="howto">
            <li>방금 열린 Chrome 창에서 STG에 로그인합니다 (MFA 포함)</li>
            <li>메인 화면이 보이면 아래 버튼을 누릅니다</li>
          </ol>
        </Modal>
      )}
    </>
  )
}
