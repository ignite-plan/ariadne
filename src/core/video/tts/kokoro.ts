// Kokoro-82M 로컬 TTS. 첫 실행 때 Hugging Face에서 모델(약 90MB)을 받아 modelDir에 둔다
import type { ProviderOptions, TtsConfig, TtsProvider } from './index.ts'

export const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
// dtype q8에서 읽는 파일. 앱은 이 파일들을 <modelDir>/<KOKORO_MODEL>/ 아래에 미리 받는다
export const KOKORO_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']

export async function kokoroProvider({ voice = 'af_heart', speed = 1 }: TtsConfig, { modelDir, localOnly }: ProviderOptions): Promise<TtsProvider> {
  const { env } = await import('@huggingface/transformers')
  env.cacheDir = modelDir
  if (localOnly) {
    env.allowRemoteModels = false
    env.localModelPath = modelDir
  }
  const { KokoroTTS } = await import('kokoro-js')
  let tts: Awaited<ReturnType<typeof KokoroTTS.from_pretrained>> | undefined
  return {
    key: `kokoro:${voice}:${speed}`,
    async synthesize(text, file) {
      // 캐시만으로 끝나면 모델을 읽지 않는다
      tts ??= await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: 'q8', device: 'cpu' })
      const audio = await tts.generate(text, { voice: voice as 'af_heart', speed })
      await audio.save(file)
    },
  }
}
