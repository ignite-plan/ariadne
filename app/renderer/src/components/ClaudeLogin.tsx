// claude.ai 로그인을 앱 안에서 (claude auth login). 설정 → 고급과 Claude 점검 화면이 같이 쓴다
import { useEffect, useRef, useState } from 'react'
import type { ClaudeLoginStatus } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'

export const loginLabel = (s: ClaudeLoginStatus) => `claude.ai 로그인됨${s.account ? ` (${s.account})` : ''}`

// 로그인 창: 브라우저가 열리면 거기서 로그인하고, 안 열리면 주소를 누르고, 코드가 나오면 붙여 넣는다
export function ClaudeLoginDialog({ onClose, onDone }: { onClose: () => void; onDone: (status: ClaudeLoginStatus) => void }) {
  const toast = useToast()
  const [url, setUrl] = useState<string>()
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()
  const finished = useRef(false)

  useEffect(() => {
    const off = api.on('claude-login-url', setUrl)
    api.claudeLogin
      .start()
      .then((status) => {
        finished.current = true
        toast.show('success', loginLabel(status))
        onDone(status)
        onClose()
      })
      .catch((e) => {
        finished.current = true
        if (!/취소했습니다/.test(errorMessage(e))) setError(errorMessage(e))
      })
    return () => {
      off()
      // 창을 닫으면 기다리던 로그인도 끝낸다
      if (!finished.current) void api.claudeLogin.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendCode = async () => {
    try {
      await api.claudeLogin.sendCode(code)
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      title="claude.ai 로그인"
      onClose={onClose}
      width={520}
      footer={
        <button className="button" onClick={onClose}>
          {error ? '닫기' : '취소'}
        </button>
      }
    >
      {error ? (
        <p className="form-error">{error}</p>
      ) : (
        <div className="claude-login">
          <p>브라우저가 열리면 claude.ai 계정으로 로그인하고 [승인]을 누르세요. 끝나면 이 창이 저절로 닫힙니다.</p>
          {url ? (
            <p className="muted">
              브라우저가 열리지 않았으면{' '}
              <button className="link" onClick={() => void api.app.openExternal(url)}>
                로그인 페이지 열기
              </button>
            </p>
          ) : (
            <p className="muted">로그인 페이지를 준비하는 중…</p>
          )}
          <label className="field">
            <span>브라우저에 코드가 나오면 붙여 넣으세요</span>
            <div className="row">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="코드" disabled={sent} />
              <button className="button" onClick={() => void sendCode()} disabled={!code.trim() || sent}>
                {sent ? '확인 중…' : '코드 보내기'}
              </button>
            </div>
          </label>
        </div>
      )}
    </Modal>
  )
}

// 설정 → 고급: 지금 로그인 상태와 [로그인] / [로그아웃]
export function ClaudeLoginRow() {
  const toast = useToast()
  const [status, setStatus] = useState<ClaudeLoginStatus | null>()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = () => api.claudeLogin.status().then(setStatus, (e) => setStatus({ loggedIn: false, error: errorMessage(e) }))
  useEffect(() => {
    void load()
  }, [])

  const logout = async () => {
    setBusy(true)
    try {
      setStatus(await api.claudeLogin.logout())
      toast.show('success', 'claude.ai에서 로그아웃했습니다')
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="claude-login-row">
      <span className={status?.loggedIn ? 'ok' : 'muted'}>
        {status === undefined
          ? '로그인 상태 확인 중…'
          : status === null
            ? 'Claude Code가 없습니다 (환경 점검에서 앱 전용으로 설치)'
            : status.loggedIn
              ? loginLabel(status)
              : 'claude.ai 로그인 필요'}
      </span>
      {status && (
        <button className="button small" onClick={() => (status.loggedIn ? void logout() : setOpen(true))} disabled={busy}>
          {status.loggedIn ? '로그아웃' : 'claude.ai 로그인'}
        </button>
      )}
      {open && <ClaudeLoginDialog onClose={() => setOpen(false)} onDone={setStatus} />}
    </div>
  )
}
