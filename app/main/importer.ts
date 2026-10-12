import type { DocxAnalysis, ImportOptions, ImportProgress, ImportResult } from '../../src/core/import.ts'
import workerPath from './import-worker?modulePath'
import { forkWorker } from './worker.ts'

async function run<T>(request: unknown, onProgress?: (progress: ImportProgress) => void) {
  const { done } = forkWorker<T>(workerPath, 'Ariadne Import', request, {
    onProgress: (progress) => onProgress?.(progress as ImportProgress),
    crashed: (code) => `가져오기 프로세스가 비정상 종료했습니다 (code ${code})`,
  })
  const message = await done
  if ('error' in message) throw new Error(message.error)
  return message.result
}

export const analyzeInWorker = (docx: string, pandoc: string) => run<DocxAnalysis>({ op: 'analyze', docx, pandoc })

export const importInWorker = (options: Omit<ImportOptions, 'onProgress'>, onProgress: (p: ImportProgress) => void) =>
  run<ImportResult>({ op: 'import', options }, onProgress)
