import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 560,
  dismissible = true,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  dismissible?: boolean
}) {
  useEffect(() => {
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissible])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal="true">
        <header className="modal-header">
          <h2>{title}</h2>
          {dismissible && (
            <button className="icon-button" onClick={onClose} aria-label="닫기">
              <Icon name="x" />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button className="button" onClick={onCancel}>
            취소
          </button>
          <button className={danger ? 'button danger' : 'button primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-message">{message}</div>
    </Modal>
  )
}
