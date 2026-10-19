// Claude로 초안·최신화·영상 시나리오, 변경 영향(개발자용)
import { findAffected } from '../../../src/core/affected.ts'
import { draftLabel } from '../../shared/draft-mode.ts'
import { cancelDraft, checkDraft, decideDraft, startDraft } from '../draft.ts'
import { record } from '../lib/git.ts'
import { log } from '../log.ts'
import { hostTab } from '../lib/browser-host.ts'
import { withShared } from '../lib/profile-lock.ts'
import { getSettings } from '../settings.ts'
import { captureBaseUrl, claudeDataDir, handle, recordAuthor, ref, requireWorkspace, send, sessionDir } from './context.ts'

export function registerDraft() {
  handle('draft:check', (options) => checkDraft(getSettings().claudePath, options, getSettings().claudeAuth))
  handle('draft:start', async (input) => {
    const root = requireWorkspace()
    // Claude가 파일을 고치기 전에 지금까지 고친 것을 내 PC에 기록한다 (덮어쓰거나 되돌려도 이력에 남는다). 실패해도 작업은 한다
    await record(root, await recordAuthor(), `Claude ${draftLabel(input)} 전 자동 기록 (${input.menu})`).then(
      () => send('draft-event', { kind: 'status', text: '지금까지 고친 내용을 내 PC에 기록했습니다' }),
      (error: Error) => /기록할 새 변경이 없습니다/.test(error.message) || log.write('warn', 'record', `Claude 작업 전 자동 기록 실패: ${error.message}`),
    )
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
