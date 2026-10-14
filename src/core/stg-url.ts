// STG 주소와 세션 만료 판정. CLI·main·renderer가 같이 쓴다 (node·playwright에 의존하지 않는다)

// 세션 만료 오류 메시지의 앞부분. worker·IPC를 지나면 Error 클래스가 사라져 메시지로 알아본다
export const SESSION_EXPIRED = '세션 만료'

export function sessionExpiredError(url: string) {
  return new Error(`${SESSION_EXPIRED}: 로그인 페이지로 이동했습니다 (${url}). 다시 로그인하세요`)
}

export function isSessionExpired(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return message.includes(SESSION_EXPIRED)
}

export const withSlash = (baseUrl: string) => (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)

// baseUrl 기준 경로(/menu, menu)의 전체 주소
export const stgUrl = (baseUrl: string, path: string) => new URL(path.replace(/^\//, ''), withSlash(baseUrl)).href

// 세션이 끝나면 다른 origin의 로그인·로그아웃 페이지(MPASS, stg-admin logout.html)로 넘어간다
export function isOnStg(url: string, baseUrl: string) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

interface StgPage {
  url(): string
  goto(url: string): Promise<unknown>
}

export function assertOnStg(page: Pick<StgPage, 'url'>, baseUrl: string) {
  if (!isOnStg(page.url(), baseUrl)) throw sessionExpiredError(page.url())
}

// baseUrl 기준 경로로 간다. 로그인 페이지로 튕기면 세션 만료 오류
export async function gotoStg(page: StgPage, baseUrl: string, path: string) {
  await page.goto(stgUrl(baseUrl, path))
  assertOnStg(page, baseUrl)
}
