import { useEffect, useId, type ReactNode } from 'react'
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
  // 화면 낭독기와 테스트가 제목으로 대화상자를 찾을 수 있게 제목을 이름으로 잇는다
  const titleId = useId()
  useEffect(() => {
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissible])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
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
  width = 420,
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  width?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={width}
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
