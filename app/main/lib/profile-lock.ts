// STG 로그인 프로필은 한 번에 브라우저 하나만 열 수 있다. 로그인·캡처·영상·STG 기록·Claude 작업이 동시에 돌지 않게 한다
let holder: string | undefined

export function profileHolder() {
  return holder
}

// 잡으면 놓는 함수를 돌려준다. 이미 다른 작업이 잡고 있으면 그 작업 이름으로 거절한다
export function acquireProfile(label: string) {
  if (holder) throw new Error(`${holder} 중에는 할 수 없습니다. 끝난 뒤 다시 하세요`)
  holder = label
  let released = false
  return () => {
    if (released) return
    released = true
    holder = undefined
  }
}

export async function withProfile<T>(label: string, fn: () => Promise<T>) {
  const release = acquireProfile(label)
  try {
    return await fn()
  } finally {
    release()
  }
}
