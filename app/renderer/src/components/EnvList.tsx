import { useEffect, useRef, useState } from 'react'
import type { EnvCheck, PandocProgress } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'

const mb = (n?: number) => (n ? `${Math.round(n / (1 << 20))}MB` : '')

function progressText(p?: PandocProgress) {
  if (!p) return '준비 중…'
  if (p.phase === 'release') return '최신 버전 확인 중…'
  if (p.phase === 'extract') return '설치 중…'
  return `받는 중… ${mb(p.loaded)}${p.total ? ` / ${mb(p.total)}` : ''}`
}

// autoInstall: 없는 도구(pandoc)를 묻지 않고 바로 받아 설치한다 (첫 실행). 끝나면 onChanged로 다시 점검
export function EnvList({ checks, autoInstall = false, onChanged }: { checks?: EnvCheck[]; autoInstall?: boolean; onChanged?: () => void }) {
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<PandocProgress>()
  const [error, setError] = useState('')
  const tried = useRef(false)

  const install = async () => {
    setInstalling(true)
    setError('')
    setProgress(undefined)
    const off = api.on('pandoc-progress', setProgress)
    try {
      await api.env.installPandoc()
      onChanged?.()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      off()
      setInstalling(false)
    }
  }

  const needsPandoc = Boolean(checks?.some((c) => c.install === 'pandoc' && !c.ok))
  useEffect(() => {
    if (autoInstall && needsPandoc && !tried.current) {
      tried.current = true
      void install()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInstall, needsPandoc])

  if (!checks) return <p className="muted">점검 중…</p>
  return (
    <ul className="env-list">
      {checks.map((c) => (
        <li key={c.id} className={c.ok ? 'ok' : c.required ? 'fail' : 'warn'}>
          <span className="env-icon">
            <Icon name={c.ok ? 'check' : installing && c.install ? 'sync' : 'alert'} size={15} className={installing && c.install ? 'spin' : ''} />
          </span>
          <div>
            <div className="env-label">
              {c.label}
              {!c.required && <span className="tag">선택</span>}
            </div>
            <div className="env-detail">{installing && c.install ? progressText(progress) : c.detail}</div>
            {c.install && !c.ok && !installing && (
              <button className="link" onClick={() => void install()}>
                자동으로 설치
              </button>
            )}
            {c.install && error && <div className="form-error">{error}</div>}
            {c.link && (
              <button className="link" onClick={() => api.app.openExternal(c.link!.url)}>
                {c.link.label} <Icon name="external" size={12} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
