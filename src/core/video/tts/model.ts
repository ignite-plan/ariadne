// Kokoro 모델 파일 목록. 앱 main이 TTS 코드를 불러오지 않고 모델을 받거나 확인할 때 쓴다
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
// dtype q8에서 읽는 파일. <modelDir>/<KOKORO_MODEL>/<file>에 둔다 (transformers.js 캐시 구조)
export const KOKORO_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']

export function kokoroFileUrl(file: string) {
  return `https://huggingface.co/${KOKORO_MODEL}/resolve/main/${file}`
}

export function kokoroReady(modelDir: string) {
  return KOKORO_FILES.every((file) => existsSync(join(modelDir, KOKORO_MODEL, file)))
}
