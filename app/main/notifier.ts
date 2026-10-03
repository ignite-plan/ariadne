// 작업이 끝나면 macOS 알림. 누르면 앱 창을 앞으로. 앱을 보고 있지 않으면 Dock 아이콘도 튕긴다
import { app, BrowserWindow, Notification } from 'electron'
import { describeTask, shouldNotify, type TaskNotice } from './lib/notify.ts'
import { getSettings } from './settings.ts'

// 참조가 없으면 알림이 정리돼 클릭이 동작하지 않는다. 닫히거나 눌릴 때까지 들고 있는다
const alive = new Set<Notification>()

function show(notice: TaskNotice, getWindow: () => BrowserWindow | undefined) {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title: notice.title, body: notice.body })
  alive.add(notification)
  const release = () => alive.delete(notification)
  notification.on('click', () => {
    release()
    const window = getWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    app.focus({ steal: true })
  })
  notification.on('close', release)
  notification.show()
}

export function notifyTask(
  getWindow: () => BrowserWindow | undefined,
  channel: string,
  args: unknown[],
  outcome: { result?: unknown; error?: unknown },
  durationMs: number,
) {
  try {
    const notice = describeTask(channel, args, outcome.result, outcome.error)
    if (!notice) return
    const focused = Boolean(BrowserWindow.getFocusedWindow())
    if (!shouldNotify({ mode: getSettings().notifyOnDone ?? 'background', focused, durationMs })) return
    show(notice, getWindow)
    if (!focused) app.dock?.bounce(notice.ok ? 'informational' : 'critical')
  } catch {
    // 알림 실패로 작업 결과를 망치지 않는다
  }
}

// 설정 화면의 [알림 시험]. 처음 누르면 macOS가 알림 허용을 묻는다
export function testNotification(getWindow: () => BrowserWindow | undefined) {
  if (!Notification.isSupported()) throw new Error('이 Mac에서는 알림을 쓸 수 없습니다')
  show({ ok: true, title: 'Ariadne 알림 시험', body: '작업이 끝나면 이렇게 알려 드립니다' }, getWindow)
}
