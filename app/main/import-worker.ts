// Word 가져오기는 CPU를 몇 초 쓴다. main 프로세스가 멈추지 않게 utilityProcess에서 돌린다
import { analyzeDocx, importDocx, type ImportOptions } from '../../src/core/import.ts'

type Request =
  | { op: 'analyze'; docx: string; pandoc: string }
  | { op: 'import'; options: Omit<ImportOptions, 'onProgress'> }

process.parentPort.once('message', async ({ data }: { data: Request }) => {
  try {
    const result =
      data.op === 'analyze'
        ? await analyzeDocx(data.docx, data.pandoc)
        : await importDocx({ ...data.options, onProgress: (progress) => process.parentPort.postMessage({ progress }) })
    process.parentPort.postMessage({ result })
  } catch (error) {
    process.parentPort.postMessage({ error: (error as Error).message })
  }
})
