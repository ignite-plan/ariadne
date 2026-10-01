import { useCallback, useEffect, useState } from 'react'
import type { AuthStatus, Settings, WorkspaceState } from '../../shared/api.ts'
import { api } from './api.ts'
import { Onboarding } from './components/Onboarding.tsx'
import { Workbench } from './components/Workbench.tsx'

interface Boot {
  settings: Settings
  auth: AuthStatus
  workspace: WorkspaceState
}

export function App() {
  const [boot, setBoot] = useState<Boot>()

  const load = useCallback(async () => {
    const [settings, auth, workspace] = await Promise.all([api.settings.get(), api.auth.status(), api.workspace.state()])
    setBoot({ settings, auth, workspace })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!boot) {
    return (
      <div className="splash">
        <Thread />
      </div>
    )
  }

  // 토큰과 리포가 준비되어야 편집 화면으로 간다
  const ready = boot.auth.hasToken && boot.workspace.cloned
  if (!ready) return <Onboarding initial={boot} onDone={load} />
  return <Workbench onReset={load} />
}

// Ariadne의 실. 로딩 표시
export function Thread() {
  return (
    <svg className="thread" width="56" height="56" viewBox="0 0 56 56" aria-label="불러오는 중">
      <path d="M8 28c0-11 9-20 20-20s20 9 20 20-9 20-20 20c-8 0-14-6-14-14s6-13 13-13 12 5 12 12-5 10-10 10-8-3-8-8 3-6 6-6" />
    </svg>
  )
}
