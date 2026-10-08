import { useEffect, useRef, useState } from 'react'
import type { EnvCheck, InstallProgress } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'

const mb = (n?: number) => (n ? `${Math.round(n / (1 << 20))}MB` : '')

type Tool = NonNullable<EnvCheck['install']>

function progressText(p?: InstallProgress) {
  if (!p) return '준비 중…'
  if (p.phase === 'release') return '최신 버전 확인 중…'
  if (p.phase === 'extract') return '설치 중…'
  return `받는 중… ${mb(p.loaded)}${p.total ? ` / ${mb(p.total)}` : ''}`
}

// autoInstall: 앱이 대신 설치할 수 있는 도구(pandoc, 앱 전용 Claude Code)를 묻지 않고 차례로 받아 설치한다 (첫 실행).
// 끝나면 onChanged로 다시 점검
export function EnvList({ checks, autoInstall = false, onChanged }: { checks?: EnvCheck[]; autoInstall?: boolean; onChanged?: () => void }) {
  const [installing, setInstalling] = useState<Tool>()
  const [progress, setProgress] = useState<InstallProgress>()
  const [errors, setErrors] = useState<Partial<Record<Tool, string>>>({})
  const tried = useRef(false)

  const installOne = async (tool: Tool) => {
    setInstalling(tool)
    setErrors((e) => ({ ...e, [tool]: undefined }))
    setProgress(undefined)
    const off = api.on('install-progress', (p) => p.tool === tool && setProgress(p))
    try {
      await api.env.install(tool)
    } catch (e) {
      setErrors((prev) => ({ ...prev, [tool]: errorMessage(e) }))
    } finally {
      off()
      setInstalling(undefined)
    }
  }
  const install = async (tools: Tool[]) => {
    for (const tool of tools) await installOne(tool)
    onChanged?.()
  }

  const missing = (checks ?? []).filter((c) => c.install && !c.ok).map((c) => c.install!) as Tool[]
  useEffect(() => {
    if (autoInstall && missing.length && !tried.current) {
      tried.current = true
      void install(missing)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInstall, missing.join()])

  if (!checks) return <p className="muted">점검 중…</p>
  return (
    <ul className="env-list">
      {checks.map((c) => (
        <li key={c.id} className={c.ok ? 'ok' : c.required ? 'fail' : 'warn'}>
          <span className="env-icon">
            <Icon name={c.ok ? 'check' : installing && installing === c.install ? 'sync' : 'alert'} size={15} className={installing && installing === c.install ? 'spin' : ''} />
          </span>
          <div>
            <div className="env-label">
              {c.label}
              {!c.required && <span className="tag">선택</span>}
            </div>
            <div className="env-detail">{installing && installing === c.install ? progressText(progress) : c.detail}</div>
            {c.install && !c.ok && !installing && (
              <button className="link" onClick={() => void install([c.install!])}>
                {c.install === 'claude' ? '앱 전용으로 설치' : '자동으로 설치'}
              </button>
            )}
            {c.install && errors[c.install] && <div className="form-error">{errors[c.install]}</div>}
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
