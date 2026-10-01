import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'

interface ToastItem {
  id: number
  kind: 'info' | 'success' | 'error'
  message: ReactNode
  action?: { label: string; run: () => void }
}

interface ToastApi {
  show: (kind: ToastItem['kind'], message: ReactNode, action?: ToastItem['action']) => void
  error: (error: unknown) => void
}

const ToastContext = createContext<ToastApi>({ show: () => {}, error: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback<ToastApi['show']>(
    (kind, message, action) => {
      const id = Date.now() + Math.random()
      setItems((list) => [...list.slice(-3), { id, kind, message, action }])
      setTimeout(() => dismiss(id), kind === 'error' ? 9000 : action ? 8000 : 4000)
    },
    [dismiss],
  )
  const error = useCallback((e: unknown) => show('error', errorMessage(e)), [show])
  const value = useMemo(() => ({ show, error }), [show, error])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'} />
            <div className="toast-message">{t.message}</div>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="icon-button small" onClick={() => dismiss(t.id)} aria-label="닫기">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
