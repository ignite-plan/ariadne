import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { ReportHost } from './components/ReportDialog.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { api } from './api.ts'
import { TasksProvider } from './tasks.tsx'
import './styles.css'

// 화면에서 난 예외도 로그에 남긴다 (문제 신고에 첨부)
window.addEventListener('error', (e) => void api.log.write('error', 'window', `${e.message}\n${e.error?.stack ?? ''}`))
window.addEventListener('unhandledrejection', (e) =>
  void api.log.write('error', 'promise', e.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e.reason)),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <TasksProvider>
        <App />
      </TasksProvider>
      <ReportHost />
    </ToastProvider>
  </StrictMode>,
)
