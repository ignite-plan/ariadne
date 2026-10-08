// 새 버전 받기 → 준비 → 다시 시작. 위쪽 배너와 설정 → 정보에서 같이 쓴다
import { useEffect, useState } from 'react'
import type { UpdateInfo, UpdateState } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { useToast } from './Toast.tsx'

const percent = (s: Extract<UpdateState, { phase: 'download' }>) => (s.total && s.loaded ? ` ${Math.floor((s.loaded / s.total) * 100)}%` : '')

export function UpdateAction({ update }: { update: UpdateInfo }) {
  const toast = useToast()
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  useEffect(() => {
    void api.app.updateState().then(setState)
    return api.on('update-state', setState)
  }, [])

  const download = async () => {
    try {
      setState(await api.app.downloadUpdate())
    } catch (e) {
      setState({ phase: 'error', message: errorMessage(e) })
    }
  }
  const install = async () => {
    try {
      await api.app.installUpdate()
    } catch (e) {
      toast.error(e)
    }
  }
  const manual = (
    <button className="link" onClick={() => api.app.openExternal(update.url)}>
      직접 받기 <Icon name="external" size={12} />
    </button>
  )

  if (state.phase === 'download') return <span className="update-action muted">새 버전 받는 중…{percent(state)}</span>
  if (state.phase === 'prepare') return <span className="update-action muted">새 버전 준비 중…</span>
  if (state.phase === 'ready') {
    return (
      <span className="update-action">
        {state.version} 준비됨.
        <button className="button primary small" onClick={() => void install()}>
          지금 다시 시작
        </button>
      </span>
    )
  }
  return (
    <span className="update-action">
      {update.asset && (
        <button className="button primary small" onClick={() => void download()}>
          업데이트
        </button>
      )}
      {manual}
      {state.phase === 'error' && <span className="form-error">{state.message}</span>}
    </span>
  )
}
