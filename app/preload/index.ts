import { contextBridge, ipcRenderer } from 'electron'
import type { AriadneApi } from '../shared/api.ts'

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const api: AriadneApi = {
  settings: {
    get: invoke('settings:get'),
    update: invoke('settings:update'),
    pickDirectory: invoke('settings:pickDirectory'),
  },
  auth: {
    status: invoke('auth:status'),
    setToken: invoke('auth:setToken'),
    clearToken: invoke('auth:clearToken'),
  },
  env: { check: invoke('env:check') },
  workspace: {
    state: invoke('workspace:state'),
    clone: invoke('workspace:clone'),
    sync: invoke('workspace:sync'),
    changes: invoke('workspace:changes'),
    revert: invoke('workspace:revert'),
    submit: invoke('workspace:submit'),
    reveal: invoke('workspace:reveal'),
  },
  manual: {
    list: invoke('manual:list'),
    config: invoke('manual:config'),
    updateConfig: invoke('manual:updateConfig'),
    pickDocx: invoke('manual:pickDocx'),
    analyzeDocx: invoke('manual:analyzeDocx'),
    importDocx: invoke('manual:importDocx'),
    tree: invoke('manual:tree'),
    read: invoke('manual:read'),
    write: invoke('manual:write'),
    create: invoke('manual:create'),
    remove: invoke('manual:remove'),
    moveChapter: invoke('manual:moveChapter'),
    moveSection: invoke('manual:moveSection'),
    todos: invoke('manual:todos'),
    images: invoke('manual:images'),
    pickImageFile: invoke('manual:pickImageFile'),
    importImage: invoke('manual:importImage'),
    suggestImageId: invoke('manual:suggestImageId'),
  },
  preview: { render: invoke('preview:render') },
  build: { docx: invoke('build:docx'), open: invoke('build:open') },
  capture: {
    shots: invoke('capture:shots'),
    session: invoke('capture:session'),
    login: invoke('capture:login'),
    finishLogin: invoke('capture:finishLogin'),
    cancelLogin: invoke('capture:cancelLogin'),
    run: invoke('capture:run'),
    adopt: invoke('capture:adopt'),
  },
  draft: { check: invoke('draft:check'), start: invoke('draft:start'), cancel: invoke('draft:cancel') },
  affected: { run: invoke('affected:run') },
  app: {
    version: invoke('app:version'),
    checkUpdate: invoke('app:checkUpdate'),
    openExternal: invoke('app:openExternal'),
  },
  on(event: string, listener: (payload: unknown) => void) {
    const wrapped = (_: unknown, payload: unknown) => listener(payload)
    ipcRenderer.on(event, wrapped)
    return () => ipcRenderer.removeListener(event, wrapped)
  },
} as AriadneApi

contextBridge.exposeInMainWorld('ariadne', api)
