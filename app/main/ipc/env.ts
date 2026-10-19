// 환경 점검과 앱이 대신 설치하는 도구(pandoc, 앱 전용 Claude Code)
import { sessionInfo } from '../../../src/core/session.ts'
import type { InstallProgress } from '../../shared/api.ts'
import { CLAUDE_CODE_VERSION, installClaude, type ToolProgress } from '../lib/claude-install.ts'
import { findClaude, setManagedClaude } from '../lib/claude.ts'
import { envChecks } from '../lib/env-check.ts'
import { findChrome, findFfmpeg } from '../lib/environment.ts'
import { installPandoc } from '../lib/pandoc-install.ts'
import { modelStatus } from '../lib/video-model.ts'
import { getSettings, profileDir } from '../settings.ts'
import { handle, netFetch, pandoc, ref, send, toolsDir, videoModelDir, workspaceState } from './context.ts'
import { authStatus } from './settings.ts'

// 앱 전용 Claude Code 설치는 한 번에 하나 (앱 시작 때 자동 설치와 환경 점검의 버튼이 겹칠 수 있다)
let installingClaude: ReturnType<typeof installClaude> | undefined

export function registerEnv() {
  handle('env:install', async (tool) => {
    const progress = (p: ToolProgress) => send('install-progress', { tool, ...p } satisfies InstallProgress)
    if (tool === 'pandoc') return installPandoc(toolsDir(), netFetch, progress)
    installingClaude ??= installClaude(toolsDir(), netFetch, progress)
      .then((installed) => {
        setManagedClaude(installed.path)
        return installed
      })
      .finally(() => (installingClaude = undefined))
    return installingClaude
  })
  handle('env:check', async () => {
    const settings = getSettings()
    const workspace = workspaceState()
    return envChecks({
      auth: await authStatus(),
      workspace,
      pandoc: pandoc(),
      toolsDir: toolsDir(),
      chrome: findChrome(),
      claude: await findClaude(settings.claudePath || undefined, false, settings.claudeAuth),
      claudeOverride: Boolean(settings.claudePath || process.env.ARIADNE_CLAUDE_PATH),
      claudeVersion: CLAUDE_CODE_VERSION,
      ffmpeg: findFfmpeg(),
      voice: modelStatus(videoModelDir()),
      session: sessionInfo(profileDir(workspace.cloned ? ref().manual : settings.manual)),
      now: Date.now(),
    })
  })
}
