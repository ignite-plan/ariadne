import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, type AriadneApi, type AriadneMethods } from '../shared/api.ts'

// API_METHODS의 메서드마다 '<namespace>:<method>' 채널을 부르는 함수를 만든다 (main의 handle과 같은 이름)
const methods = Object.fromEntries(
  Object.entries(API_METHODS).map(([namespace, names]) => [
    namespace,
    Object.fromEntries(names.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(`${namespace}:${name}`, ...args)])),
  ]),
) as unknown as AriadneMethods

const api: AriadneApi = {
  ...methods,
  on(event, listener) {
    const wrapped = (_: unknown, payload: unknown) => listener(payload as never)
    ipcRenderer.on(event, wrapped)
    return () => ipcRenderer.removeListener(event, wrapped)
  },
}

contextBridge.exposeInMainWorld('ariadne', api)
