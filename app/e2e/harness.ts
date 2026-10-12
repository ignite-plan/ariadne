// E2E 공통: 가짜 BO 서버, 앱 데이터 폴더(로그인 표식·음성 모델 자리), 앱 띄우기, 단계 실행
import { mkdirSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { _electron as electron, type Page } from 'playwright'
import { SESSION_MARK } from '../../src/core/session.ts'
import { KOKORO_FILES, KOKORO_MODEL } from '../../src/core/video/tts/model.ts'

// 가짜 BO. 캡처 주소는 실제 BO처럼 /ca/admin 아래
export async function startFakeBo(handler: http.RequestListener) {
  const server = http.createServer(handler)
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/ca/admin`,
    close: () => server.close(),
  }
}

// 앱 데이터 폴더(ARIADNE_USER_DATA): 설정과, BO 로그인을 마친 상태(실제 MFA 대신 로그인 표식만)
export function prepareUserData(userData: string, { settings, manual = 'bo', baseUrl }: { settings: object; manual?: string; baseUrl: string }) {
  mkdirSync(join(userData, 'profiles', manual), { recursive: true })
  writeFileSync(join(userData, 'settings.json'), JSON.stringify(settings))
  writeFileSync(join(userData, 'profiles', manual, SESSION_MARK), JSON.stringify({ baseUrl }))
}

// 음성 모델 자리만 채운다 (모델을 읽지 않는 단계용)
export function fakeVoiceModel(dir: string) {
  for (const file of KOKORO_FILES) {
    const path = join(dir, KOKORO_MODEL, file)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '{}')
  }
}

// 빌드된 앱(out/)을, appPath가 있으면 패키징된 앱(asar, unpack된 esbuild)을 띄운다
export function launchApp({ appPath, env }: { appPath?: string; env: Record<string, string> }) {
  return electron.launch({
    ...(appPath ? { executablePath: join(resolve(appPath), 'Contents/MacOS/Ariadne'), args: [] } : { args: [resolve('out/main/index.js')] }),
    env: { ...(process.env as Record<string, string>), ...env },
  })
}

// 단계 이름과 걸린 시간을 찍는다. 실패하면 shotsDir에 그때 화면을 남긴다
export function stepper({ page, shotsDir }: { page?: Page; shotsDir?: string } = {}) {
  return async (name: string, fn: () => Promise<void>) => {
    const started = Date.now()
    try {
      await fn()
      console.log(`✓ ${name} (${Date.now() - started}ms)`)
    } catch (error) {
      console.log(`✗ ${name}`)
      if (page && shotsDir) await page.screenshot({ path: join(shotsDir, `fail-${name.replace(/\W+/g, '-')}.png`) })
      throw error
    }
  }
}
