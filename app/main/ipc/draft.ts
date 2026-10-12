// Claude로 초안·최신화·영상 시나리오, 변경 영향(개발자용)
import { findAffected } from '../../../src/core/affected.ts'
import { cancelDraft, checkDraft, decideDraft, startDraft } from '../draft.ts'
import { hostTab } from '../lib/browser-host.ts'
import { withShared } from '../lib/profile-lock.ts'
import { getSettings } from '../settings.ts'
import { captureBaseUrl, claudeDataDir, handle, ref, requireWorkspace, send, sessionDir } from './context.ts'

export function registerDraft() {
  handle('draft:check', (options) => checkDraft(getSettings().claudePath, options, getSettings().claudeAuth))
  handle('draft:start', (input) => {
    requireWorkspace()
    const r = ref()
    const settings = getSettings()
    // Claude 작업 내내 공유 잠금을 잡는다 (언제 STG를 열지 몰라 로그인·미리보기·기록은 막는다). 영상 만들기·캡처는 함께 돈다
    const session = sessionDir(r)
    return withShared(session, 'Claude 작업', () =>
      startDraft({
        ref: r,
        input,
        claudePath: settings.claudePath,
        claudeAuth: settings.claudeAuth,
        model: settings.claudeModel,
        effort: settings.claudeEffort,
        codeDir: settings.dealerhubWebDir || undefined,
        captureBaseUrl: captureBaseUrl(r),
        profileDir: session,
        openTab: hostTab(session),
        claudeDataDir: claudeDataDir(),
        onEvent: (event) => send('draft-event', event),
      }),
    )
  })
  handle('draft:cancel', () => cancelDraft())
  handle('draft:decide', (id, proceed) => decideDraft(id, proceed))

  handle('affected:run', (base, head) => {
    const { dealerhubWebDir } = getSettings()
    if (!dealerhubWebDir) throw new Error('설정에서 dealerhub-web 경로를 지정하세요')
    return findAffected({ ...ref(), repo: dealerhubWebDir, base, head: head || 'HEAD' })
  })
}
