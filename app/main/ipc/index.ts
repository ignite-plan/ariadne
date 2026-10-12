// renderer 요청 처리. 채널 이름은 '<namespace>:<method>' (shared/api.ts API_METHODS, preload와 같은 목록)
import { existsSync } from 'node:fs'
import type { BrowserWindow } from 'electron'
import { installedClaudePath } from '../lib/claude-install.ts'
import { setManagedClaude } from '../lib/claude.ts'
import { onLockChange, profileHolders } from '../lib/profile-lock.ts'
import { registerApp } from './app.ts'
import { registerCapture } from './capture.ts'
import { send, sessionDir, setWindow, toolsDir } from './context.ts'
import { registerDraft } from './draft.ts'
import { registerEnv } from './env.ts'
import { registerManual } from './manual.ts'
import { registerReport } from './report.ts'
import { registerSettings } from './settings.ts'
import { registerVideo } from './video.ts'
import { registerWorkspace } from './workspace.ts'

export { openReport } from './report.ts'

export function registerIpc(getWindow: () => BrowserWindow | undefined) {
  setWindow(getWindow)
  // 앱 전용 Claude Code가 설치돼 있으면 내 PC의 claude보다 먼저 쓴다
  const managedClaude = installedClaudePath(toolsDir())
  setManagedClaude(existsSync(managedClaude) ? managedClaude : undefined)
  onLockChange(() => {
    try {
      send('stg-tasks', profileHolders(sessionDir()))
    } catch {
      // 작업 폴더가 없으면 알릴 작업도 없다
    }
  })

  registerSettings()
  registerEnv()
  registerWorkspace()
  registerManual()
  registerCapture()
  registerVideo()
  registerDraft()
  registerReport()
  registerApp()
}
