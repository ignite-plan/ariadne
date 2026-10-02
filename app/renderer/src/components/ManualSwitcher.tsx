import { useEffect, useState } from 'react'
import type { ManualInfo } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { Icon } from './Icon.tsx'

// 위쪽 매뉴얼 이름. 누르면 매뉴얼 전환과 새 매뉴얼 가져오기
export function ManualSwitcher({
  current,
  title,
  version,
  onSwitch,
  onImport,
}: {
  current?: string
  title?: string
  version?: string
  onSwitch: (id: string) => void
  onImport: () => void
}) {
  const [open, setOpen] = useState(false)
  const [manuals, setManuals] = useState<ManualInfo[]>([])

  useEffect(() => {
    if (open) void api.manual.list().then(setManuals)
  }, [open])

  return (
    <div className="menu-anchor">
      <button className="manual-switch" onClick={() => setOpen(!open)} title="매뉴얼 바꾸기">
        <span className="ellipsis">{title ?? '매뉴얼'}</span>
        {version && <span className="muted">v{version}</span>}
        <Icon name="chevron" size={12} className="chevron down" />
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu left">
            <div className="menu-label">매뉴얼</div>
            {manuals.map((m) => (
              <button
                key={m.id}
                className={m.id === current ? 'current' : ''}
                onClick={() => {
                  setOpen(false)
                  if (m.id !== current) onSwitch(m.id)
                }}
              >
                <b>
                  {m.id === current && <Icon name="check" size={13} />} {m.title}
                </b>
                <span>
                  {m.id} · v{m.version}
                </span>
              </button>
            ))}
            <div className="menu-divider" />
            <button
              onClick={() => {
                setOpen(false)
                onImport()
              }}
            >
              <b>
                <Icon name="plus" size={13} /> 새 매뉴얼 가져오기…
              </b>
              <span>Word 원본으로 새 매뉴얼을 만듭니다</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
