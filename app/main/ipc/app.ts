// 앱 버전, 알림 시험, 앱 안 업데이트, 외부 링크
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, net, shell } from 'electron'
import type { UpdateState } from '../../shared/api.ts'
import { appBundlePath, downloadAsset, stageFromDmg, writeInstallScript, type ResolveRedirect } from '../lib/app-update.ts'
import { latestAppRelease } from '../lib/github.ts'
import { profileHolders } from '../lib/profile-lock.ts'
import { log, logsDir } from '../log.ts'
import { testNotification } from '../notifier.ts'
import { getSettings, readToken } from '../settings.ts'
import { currentWindow, handle, netFetch, send, sessionDir, workspaceState } from './context.ts'

// net.fetch는 redirect: 'manual'을 지원하지 않는다("Redirect was cancelled"). net.request로 넘겨받을 주소만 읽는다
const netRedirect: ResolveRedirect = (url, headers) =>
  new Promise((resolve, reject) => {
    const request = net.request({ url, headers, redirect: 'manual' })
    request.on('redirect', (_status, _method, location) => {
      resolve(location)
      request.abort()
    })
    // 넘겨 주지 않으면 본문은 받지 않고 끊는다 (downloadAsset이 토큰과 함께 다시 받는다)
    request.on('response', () => {
      resolve(undefined)
      request.abort()
    })
    request.on('error', reject)
    request.end()
  })

// 받은 dmg와 꺼낸 새 앱을 두는 곳
const updatesDir = () => join(app.getPath('userData'), 'updates')
let updateState: UpdateState = { phase: 'idle' }

const setUpdateState = (state: UpdateState) => {
  updateState = state
  send('update-state', state)
  return state
}

export function registerApp() {
  handle('app:version', () => app.getVersion())
  handle('app:testNotification', () => testNotification(currentWindow))
  handle('app:checkUpdate', async () => {
    const token = readToken()
    if (!token) return null
    return latestAppRelease(netFetch, token, getSettings().repoUrl, app.getVersion()).catch(() => null)
  })
  handle('app:updateState', () => updateState)
  handle('app:downloadUpdate', async () => {
    if (updateState.phase === 'download' || updateState.phase === 'prepare') return updateState
    if (!app.isPackaged) throw new Error('개발 실행에서는 앱 안 업데이트를 쓸 수 없습니다')
    const token = readToken()
    if (!token) throw new Error('GitHub 토큰이 없습니다')
    const info = await latestAppRelease(netFetch, token, getSettings().repoUrl, app.getVersion())
    if (!info) return setUpdateState({ phase: 'idle' })
    if (!info.asset) throw new Error('릴리스에 dmg가 없습니다. 릴리스 페이지에서 직접 받으세요')
    const dir = updatesDir()
    try {
      setUpdateState({ phase: 'download', total: info.asset.size })
      const dmg = await downloadAsset(
        netFetch,
        token,
        info.asset,
        join(dir, info.asset.name),
        (p) => setUpdateState({ phase: 'download', loaded: p.loaded, total: p.total }),
        netRedirect,
      )
      setUpdateState({ phase: 'prepare' })
      await stageFromDmg(dmg, join(dir, 'Ariadne.app'), info.latest)
      rmSync(dmg, { force: true })
      log.write('info', 'update', `새 버전 ${info.latest} 준비됨`)
      return setUpdateState({ phase: 'ready', version: info.latest })
    } catch (error) {
      log.error('update', error)
      return setUpdateState({ phase: 'error', message: (error as Error).message })
    }
  })
  handle('app:installUpdate', async () => {
    if (updateState.phase !== 'ready') throw new Error('먼저 새 버전을 받으세요')
    const target = appBundlePath(app.getPath('exe'))
    if (!target) throw new Error('앱 위치를 찾지 못했습니다. 릴리스 페이지에서 직접 받아 설치하세요')
    // Claude 작업·영상 만들기가 돌고 있으면 끊기지 않게 막는다
    const busy = workspaceState().cloned ? profileHolders(sessionDir()) : []
    if (busy.length) throw new Error(`${busy.join(', ')} 중에는 업데이트할 수 없습니다. 끝난 뒤 다시 누르세요`)
    const dir = updatesDir()
    const script = writeInstallScript(dir)
    log.write('info', 'update', `${updateState.version}(으)로 바꾸고 다시 엽니다: ${target}`)
    spawn('/bin/sh', [script, String(process.pid), join(dir, 'Ariadne.app'), target, join(logsDir(), 'update.log')], {
      detached: true,
      stdio: 'ignore',
    }).unref()
    app.quit()
  })
  handle('app:openExternal', (url) => {
    if (!/^https:\/\//.test(url)) throw new Error('https 링크만 열 수 있습니다')
    return shell.openExternal(url)
  })
}
