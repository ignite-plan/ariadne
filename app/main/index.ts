import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, Menu, net, protocol, shell } from 'electron'
import { ASSET_PROTOCOL } from '../shared/api.ts'
import { registerIpc } from './ipc.ts'
import { installErrorHooks, registerReportIpc } from './report-ipc.ts'
import { isMediaFile, mediaResponse } from './lib/asset.ts'
import { resolveInside } from './lib/sections.ts'
import { getSettings } from './settings.ts'
import { closeAllHosts } from './lib/browser-host.ts'

const here = fileURLToPath(new URL('.', import.meta.url))

// 테스트나 두 번째 프로필용으로 앱 데이터(설정, 토큰, BO 세션) 위치를 바꾼다
if (process.env.ARIADNE_USER_DATA) app.setPath('userData', process.env.ARIADNE_USER_DATA)
installErrorHooks()

// asar 안의 esbuild 바이너리는 실행할 수 없어 unpack된 경로를 알려 준다
if (app.isPackaged) {
  process.env.ESBUILD_BINARY_PATH = join(
    process.resourcesPath,
    'app.asar.unpacked/node_modules/@esbuild/darwin-arm64/bin/esbuild',
  )
}

protocol.registerSchemesAsPrivileged([
  { scheme: ASSET_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
])

let window: BrowserWindow | undefined
let openReport: () => void = () => {}

function createWindow() {
  window = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    title: 'Ariadne',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#f7f6f3',
    show: false,
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  window.once('ready-to-show', () => window?.show())
  window.on('closed', () => {
    window = undefined
  })
  // 외부 링크는 브라우저로
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'file://')) event.preventDefault()
  })
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(here, '../renderer/index.html'))
}

function buildMenu() {
  const isDev = !app.isPackaged
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: '보기',
        submenu: [
          { role: 'reload', visible: isDev },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: [
          { label: '문제 신고…', click: () => openReport() },
          { type: 'separator' },
          {
            label: '매뉴얼 리포 열기 (GitHub)',
            click: () => void shell.openExternal(getSettings().repoUrl),
          },
        ],
      },
    ]),
  )
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })

  app.whenReady().then(() => {
    // ariadne://ws/<리포 상대경로> → 작업 폴더 파일 (이미지, 캡처 결과)
    protocol.handle(ASSET_PROTOCOL, (request) => {
      const url = new URL(request.url)
      try {
        if (url.host !== 'ws') throw new Error('unknown host')
        const rel = decodeURIComponent(url.pathname.replace(/^\//, ''))
        const file = resolveInside(getSettings().workspaceDir, rel)
        // 가이드 영상·음성 미리보기
        if (isMediaFile(file)) return mediaResponse(file, request.headers.get('range'))
        return net.fetch(pathToFileURL(file).href)
      } catch {
        return new Response('not found', { status: 404 })
      }
    })
    registerIpc(() => window)
    openReport = registerReportIpc(() => window)
    buildMenu()
    createWindow()
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow()
    })
  })

  app.on('window-all-closed', () => app.quit())
  // 공유 STG Chrome(headless)을 남기지 않는다
  let hostsClosed = false
  app.on('before-quit', (event) => {
    if (hostsClosed) return
    event.preventDefault()
    hostsClosed = true
    void closeAllHosts().finally(() => app.quit())
  })
}
