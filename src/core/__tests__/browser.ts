// 브라우저 테스트 공통: 설치된 Chrome·ffmpeg 확인, 가짜 STG 서버
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { markSession } from '../session.ts'

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
})()

// describe의 skip 값: 없으면 건너뛸 이유
export function skipWithout({ ffmpeg = false } = {}) {
  return (!existsSync(CHROME) && 'Chrome 없음') || (ffmpeg && !hasFfmpeg && 'ffmpeg 없음') || false
}

// 가짜 STG(BO). basePath 아래가 캡처 주소이고, 로그인을 마친 표식(profileDir)도 남긴다.
// handler의 port는 다른 origin(localhost)으로 보내는 로그인 페이지를 흉내 낼 때 쓴다
export async function startFakeStg(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, port: number) => void,
  { basePath, profileDir }: { basePath: string; profileDir: string },
) {
  let port = 0
  const server = http.createServer((req, res) => handler(req, res, port))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}${basePath}`
  markSession(profileDir, baseUrl)
  return { baseUrl, close: () => new Promise<void>((done) => server.close(() => done())) }
}
