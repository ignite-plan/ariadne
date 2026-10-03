// STG 로그인 프로필 잠금 (프로필별). 프로필은 한 번에 Chrome 하나만 열 수 있다
// - 공유: 공유 Chrome(headless, browser-host.ts)의 탭을 쓰는 작업. Claude 작업·영상 만들기·캡처·세션 확인은 서로 동시에 돈다
// - 단독: 화면이 보이는 Chrome을 따로 띄우는 작업 (로그인, 미리보기, STG 기록). 다른 작업이 없을 때만 한다
interface Holders {
  exclusive?: string
  shared: Map<number, string>
}

const locks = new Map<string, Holders>()
let seq = 0
const listeners = new Set<() => void>()

function holdersOf(profile: string) {
  let h = locks.get(profile)
  if (!h) locks.set(profile, (h = { shared: new Map() }))
  return h
}

const changed = () => listeners.forEach((fn) => fn())

// 지금 프로필을 쓰는 작업 이름 (단독이 있으면 그것 하나)
export function profileHolders(profile: string): string[] {
  const h = locks.get(profile)
  if (!h) return []
  return h.exclusive ? [h.exclusive] : [...new Set(h.shared.values())]
}

export function isExclusiveHeld(profile: string) {
  return Boolean(locks.get(profile)?.exclusive)
}

// 잠금이 바뀔 때마다 부른다 (renderer에 지금 도는 작업을 알린다)
export function onLockChange(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function busy(names: string[]) {
  return new Error(`${names.join(', ')} 중에는 할 수 없습니다. 끝난 뒤 다시 하세요`)
}

function releaser(fn: () => void) {
  let released = false
  return () => {
    if (released) return
    released = true
    fn()
    changed()
  }
}

// 잡으면 놓는 함수를 돌려준다. 단독 작업이 잡고 있으면 그 작업 이름으로 거절한다
export function acquireShared(profile: string, label: string) {
  const h = holdersOf(profile)
  if (h.exclusive) throw busy([h.exclusive])
  const id = ++seq
  h.shared.set(id, label)
  changed()
  return releaser(() => h.shared.delete(id))
}

// 다른 작업이 하나라도 있으면 그 작업 이름들로 거절한다
export function acquireExclusive(profile: string, label: string) {
  const h = holdersOf(profile)
  const names = profileHolders(profile)
  if (names.length) throw busy(names)
  h.exclusive = label
  changed()
  return releaser(() => {
    if (h.exclusive === label) h.exclusive = undefined
  })
}

export async function withShared<T>(profile: string, label: string, fn: () => Promise<T>) {
  const release = acquireShared(profile, label)
  try {
    return await fn()
  } finally {
    release()
  }
}
