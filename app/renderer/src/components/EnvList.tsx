import type { EnvCheck } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { Icon } from './Icon.tsx'

export function EnvList({ checks }: { checks?: EnvCheck[] }) {
  if (!checks) return <p className="muted">점검 중…</p>
  return (
    <ul className="env-list">
      {checks.map((c) => (
        <li key={c.id} className={c.ok ? 'ok' : c.required ? 'fail' : 'warn'}>
          <span className="env-icon">
            <Icon name={c.ok ? 'check' : 'alert'} size={15} />
          </span>
          <div>
            <div className="env-label">
              {c.label}
              {!c.required && <span className="tag">선택</span>}
            </div>
            <div className="env-detail">{c.detail}</div>
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
