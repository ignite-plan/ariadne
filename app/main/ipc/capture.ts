// STG 로그인과 화면 캡처
import { adoptShots, capture } from '../../../src/core/capture.ts'
import { login } from '../../../src/core/login.ts'
import { checkSession, sessionInfo } from '../../../src/core/session.ts'
import type { ShotInfo } from '../../shared/api.ts'
import { hostTab, withExclusive } from '../lib/browser-host.ts'
import { profileHolders, withShared } from '../lib/profile-lock.ts'
import { listImages } from '../lib/sections.ts'
import { loadShotsBundled, shotSections } from '../lib/shots.ts'
import { captureBaseUrl, handle, ref, requireChrome, send, sessionDir } from './context.ts'

// 로그인 창에서 [로그인 완료]/[취소]를 누를 때까지 기다린다
let pendingLogin: { resolve: () => void; reject: (error: Error) => void } | undefined

export function registerCapture() {
  handle('capture:shots', async (): Promise<ShotInfo[]> => {
    const r = ref()
    const shots = await loadShotsBundled(r)
    const sections = shotSections(r)
    const images = new Set(listImages(r).map((i) => i.id))
    return shots.map((s) => ({
      id: s.id,
      path: s.path,
      manual: Boolean(s.manual),
      exists: images.has(s.id),
      sections: sections.get(s.id) ?? [],
    }))
  })
  handle('capture:session', () => sessionInfo(sessionDir()))
  // 공유 Chrome의 탭으로 확인한다 (Claude 작업·영상 만들기 중에도 된다)
  handle('capture:checkSession', () => {
    const r = ref()
    const session = sessionDir(r)
    return withShared(session, '세션 확인', () => checkSession(session, captureBaseUrl(r), hostTab(session)))
  })
  // 지금 STG 로그인 프로필을 쓰는 작업 이름 (화면이 보이는 Chrome이 필요한 버튼을 끌 때 쓴다)
  handle('capture:tasks', () => profileHolders(sessionDir()))
  handle('capture:login', async () => {
    requireChrome()
    pendingLogin?.reject(new Error('새 로그인으로 대체되었습니다'))
    const r = ref()
    const session = sessionDir(r)
    await withExclusive(session, 'STG 로그인', () =>
      login({
        baseUrl: captureBaseUrl(r),
        profileDir: session,
        waitUntilDone: () =>
          new Promise<void>((resolve, reject) => {
            pendingLogin = { resolve, reject }
          }),
      }),
    ).finally(() => {
      pendingLogin = undefined
    })
  })
  handle('capture:finishLogin', () => pendingLogin?.resolve())
  handle('capture:cancelLogin', () => pendingLogin?.reject(new Error('로그인을 취소했습니다')))
  handle('capture:run', async (ids) => {
    const r = ref()
    const shots = await loadShotsBundled(r)
    const session = sessionDir(r)
    return withShared(session, '화면 캡처', () =>
      capture({
        ...r,
        baseUrl: captureBaseUrl(r),
        profileDir: session,
        openTab: hostTab(session),
        shots,
        only: ids,
        apply: false,
        onProgress: (progress) => send('capture-progress', progress),
      }),
    )
  })
  handle('capture:adopt', (ids) => adoptShots(ref(), ids))
}
