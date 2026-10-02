// Kokoro-82M 로컬 TTS. 첫 실행 때 Hugging Face에서 모델(약 90MB)을 받아 modelDir에 둔다
import type { TtsConfig, TtsProvider } from './index.ts'

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'

export async function kokoroProvider({ voice = 'af_heart', speed = 1 }: TtsConfig, modelDir: string): Promise<TtsProvider> {
  const { env } = await import('@huggingface/transformers')
  env.cacheDir = modelDir
  const { KokoroTTS } = await import('kokoro-js')
  let tts: Awaited<ReturnType<typeof KokoroTTS.from_pretrained>> | undefined
  return {
    key: `kokoro:${voice}:${speed}`,
    async synthesize(text, file) {
      // 캐시만으로 끝나면 모델을 읽지 않는다
      tts ??= await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' })
      const audio = await tts.generate(text, { voice: voice as 'af_heart', speed })
      await audio.save(file)
    },
  }
}
