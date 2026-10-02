import { utilityProcess } from 'electron'
import type { DocxAnalysis, ImportOptions, ImportProgress, ImportResult } from '../../src/core/import.ts'
import workerPath from './import-worker?modulePath'

function run<T>(request: unknown, onProgress?: (progress: ImportProgress) => void) {
  return new Promise<T>((resolve, reject) => {
    const child = utilityProcess.fork(workerPath, [], { serviceName: 'Ariadne Import' })
    let settled = false
    child.on('message', (message: { result?: T; error?: string; progress?: ImportProgress }) => {
      if (message.progress) return onProgress?.(message.progress)
      settled = true
      if (message.error) reject(new Error(message.error))
      else resolve(message.result as T)
      child.kill()
    })
    child.on('exit', (code) => {
      if (!settled) reject(new Error(`가져오기 프로세스가 비정상 종료했습니다 (code ${code})`))
    })
    child.postMessage(request)
  })
}

export const analyzeInWorker = (docx: string, pandoc: string) => run<DocxAnalysis>({ op: 'analyze', docx, pandoc })

export const importInWorker = (options: Omit<ImportOptions, 'onProgress'>, onProgress: (p: ImportProgress) => void) =>
  run<ImportResult>({ op: 'import', options }, onProgress)
