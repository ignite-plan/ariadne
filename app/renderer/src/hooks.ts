// 여러 화면이 같이 쓰는 hook
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EnvCheck } from '../../shared/api.ts'
import { api, errorMessage } from './api.ts'
import { useToast } from './components/Toast.tsx'

// active인 동안 1초마다 다시 그린다 (경과 시간 표시)
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

// 비동기 작업의 busy·오류. onError 'inline'이면 error에 담고(폼 아래 표시), 'toast'면 토스트로 알린다.
// run은 성공하면 결과를, 실패하면 undefined를 돌려준다
export function useAsyncAction({ onError = 'inline' }: { onError?: 'inline' | 'toast' } = {}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true)
      setError('')
      try {
        return await fn()
      } catch (e) {
        if (onError === 'toast') toast.error(e)
        else setError(errorMessage(e))
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [onError, toast],
  )
  return { run, busy, error, setError }
}

// 환경 점검 목록 (설정 화면, 첫 실행)
export function useEnvChecks() {
  const [checks, setChecks] = useState<EnvCheck[]>()
  const run = useCallback(async () => {
    setChecks(undefined)
    setChecks(await api.env.check())
  }, [])
  useEffect(() => {
    void run()
  }, [run])
  return { checks, run }
}

// 입력이 멈추면 delay 뒤 저장한다. 실행·전환·닫기 전에는 flush로 바로 저장한다.
// save·onSaved·onError는 늘 최신 것을 쓴다 (콜백이 바뀌어도 schedule·flush는 같은 함수)
export function useAutosave<T>({
  save,
  delay = 600,
  onSaved,
  onError,
}: {
  save: (value: T) => Promise<void>
  delay?: number
  onSaved?: () => void
  onError?: (error: unknown) => void
}) {
  const [state, setState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved')
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const failed = useRef(false)
  const latest = useRef({ save, onSaved, onError })
  latest.current = { save, onSaved, onError }

  // 대기 중인 값을 바로 쓴다. 쓸 것이 없으면 지난 저장이 실패했는지로 답한다
  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const job = pending.current
    if (!job) return !failed.current
    pending.current = null
    setState('saving')
    try {
      await latest.current.save(job.value)
      failed.current = false
      setState(pending.current ? 'pending' : 'saved')
      latest.current.onSaved?.()
      return true
    } catch (e) {
      pending.current ??= job
      failed.current = true
      setState('error')
      latest.current.onError?.(e)
      return false
    }
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      setState('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
    [delay, flush],
  )

  // 대기 중인 저장을 버린다 (되돌리기·삭제로 파일이 바뀔 때)
  const discard = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = null
    failed.current = false
    setState('saved')
  }, [])

  return { state, schedule, flush, discard }
}
