import { useEffect, useState } from 'react'
import type { ManualInfo } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { DeleteManualDialog } from './DeleteManualDialog.tsx'
import { Icon } from './Icon.tsx'

// 위쪽 매뉴얼 이름. 누르면 매뉴얼 전환, 새 매뉴얼 가져오기, 매뉴얼 삭제(지금 매뉴얼 말고)
export function ManualSwitcher({
  current,
  title,
  version,
  onSwitch,
  onImport,
  onDeleted,
}: {
  current?: string
  title?: string
  version?: string
  onSwitch: (id: string) => void
  onImport: () => void
  // 매뉴얼을 지운 뒤 (변경 탭에 "매뉴얼 삭제"가 생긴다)
  onDeleted: (manual: ManualInfo) => void
}) {
  const [open, setOpen] = useState(false)
  const [manuals, setManuals] = useState<ManualInfo[]>([])
  const [deleting, setDeleting] = useState<ManualInfo>()

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
              <div key={m.id} className="manual-row">
                <button
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
                    {m.id} · v{m.version} · 화면 {m.sections}
                  </span>
                </button>
                {/* 지금 매뉴얼과 마지막 하나는 지울 수 없다 */}
                {m.id !== current && manuals.length > 1 && (
                  <button
                    className="icon-button small manual-delete"
                    title={`${m.title} 매뉴얼 삭제`}
                    aria-label={`${m.id} 매뉴얼 삭제`}
                    onClick={() => {
                      setOpen(false)
                      setDeleting(m)
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
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
      {deleting && (
        <DeleteManualDialog
          manual={deleting}
          onClose={() => setDeleting(undefined)}
          onDeleted={() => {
            const removed = deleting
            setDeleting(undefined)
            onDeleted(removed)
          }}
        />
      )}
    </div>
  )
}
