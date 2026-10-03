// 공유 Chrome: 로그인 프로필마다 headless Chrome 하나를 띄워 두고 작업마다 탭을 빌려 준다.
// Claude 작업과 영상 만들기가 같은 로그인 쿠키를 쓰므로, 한쪽이 BO 토큰을 갱신해도 다른 쪽이 로그아웃되지 않는다.
// 영상 worker(별도 프로세스)는 디버깅 포트(127.0.0.1)로 붙어 자기 탭을 연다 (session.ts cdpTab).
// 탭마다 route·init script를 따로 건다. context 단위로 걸면 다른 탭에 번진다
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserContext } from 'playwright'
import { DEVTOOLS_PORT_FILE, openProfile, readDevToolsPort, type OpenTab, type StgTab } from '../../../src/core/session.ts'
import type { Viewport } from '../../../src/core/manual.ts'
import { acquireExclusive } from './profile-lock.ts'

// 빌린 탭이 모두 돌아오고 이만큼 지나면 Chrome을 닫는다 (Claude 도구 호출 사이마다 다시 띄우지 않게)
const IDLE_MS = 5000

interface Host {
  context: BrowserContext
  endpoint: string
  leases: number
  idle?: ReturnType<typeof setTimeout>
}

const hosts = new Map<string, Promise<Host>>()
// 닫는 중인 Chrome. 같은 프로필로 다시 띄우기 전에 기다린다 (프로필은 Chrome 하나만 열 수 있다)
const closing = new Map<string, Promise<void>>()

async function start(profileDir: string): Promise<Host> {
  await closing.get(profileDir)
  // 지난번 Chrome이 남긴 포트를 읽지 않게 지운다
  rmSync(join(profileDir, DEVTOOLS_PORT_FILE), { force: true })
  const { context } = await openProfile(profileDir, { headless: true, debugPort: '0' })
  try {
    const port = await readDevToolsPort(profileDir)
    return { context, endpoint: `http://127.0.0.1:${port}`, leases: 0 }
  } catch (error) {
    await context.close().catch(() => {})
    throw error
  }
}

function host(profileDir: string) {
  let h = hosts.get(profileDir)
  if (!h) {
    const started = start(profileDir)
    h = started
    hosts.set(profileDir, started)
    const forget = () => {
      if (hosts.get(profileDir) === started) hosts.delete(profileDir)
    }
    // Chrome이 스스로 끝나면(비정상 종료) 다음 요청에서 새로 띄운다
    started.then((host) => host.context.on('close', () => {
      clearTimeout(host.idle)
      forget()
    }), forget)
  }
  return h
}

async function hold(profileDir: string) {
  const h = await host(profileDir)
  clearTimeout(h.idle)
  h.idle = undefined
  h.leases++
  let released = false
  return {
    host: h,
    release() {
      if (released) return
      released = true
      h.leases--
      if (h.leases === 0) h.idle = setTimeout(() => void closeHost(profileDir), IDLE_MS)
    },
  }
}

// main에서 쓰는 탭 하나 (Claude STG 탐색, 캡처, 세션 확인, Claude 영상 실행해 보기)
export async function leaseTab(profileDir: string, viewport: Viewport): Promise<StgTab> {
  const { host: h, release } = await hold(profileDir)
  try {
    const page = await h.context.newPage()
    await page.setViewportSize(viewport)
    let closed = false
    return {
      page,
      async close() {
        if (closed) return
        closed = true
        await page.close().catch(() => {})
        release()
      },
    }
  } catch (error) {
    release()
    throw error
  }
}

export function hostTab(profileDir: string): OpenTab {
  return ({ viewport }) => leaseTab(profileDir, viewport)
}

// 영상 worker가 붙을 주소. 놓을 때까지 Chrome을 닫지 않는다
export async function leaseEndpoint(profileDir: string) {
  const { host: h, release } = await hold(profileDir)
  return { url: h.endpoint, release }
}

export async function closeHost(profileDir: string) {
  const h = hosts.get(profileDir)
  if (!h) return closing.get(profileDir)
  hosts.delete(profileDir)
  const done = h
    .then(async (host) => {
      clearTimeout(host.idle)
      await host.context.close().catch(() => {})
    })
    .catch(() => {})
    .finally(() => {
      if (closing.get(profileDir) === done) closing.delete(profileDir)
    })
  closing.set(profileDir, done)
  return done
}

export async function closeAllHosts() {
  await Promise.all([...hosts.keys()].map((p) => closeHost(p)))
}

// 화면이 보이는 Chrome을 따로 띄우는 작업 (로그인, 미리보기, STG 기록). 다른 작업이 없을 때 공유 Chrome을 닫고 잡는다
export async function acquireExclusiveProfile(profileDir: string, label: string) {
  const release = acquireExclusive(profileDir, label)
  try {
    await closeHost(profileDir)
  } catch (error) {
    release()
    throw error
  }
  return release
}

export async function withExclusive<T>(profileDir: string, label: string, fn: () => Promise<T>) {
  const release = await acquireExclusiveProfile(profileDir, label)
  try {
    return await fn()
  } finally {
    release()
  }
}

// 테스트용: 지금 떠 있는 공유 Chrome 수
export function hostCount() {
  return hosts.size
}
