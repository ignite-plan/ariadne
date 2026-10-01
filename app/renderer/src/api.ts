import type { AriadneApi } from '../../shared/api.ts'

declare global {
  interface Window {
    ariadne: AriadneApi
  }
}

export const api = window.ariadne

// ipcRenderer.invoke 에러는 "Error invoking remote method 'x': Error: <message>" 형태다
export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}
