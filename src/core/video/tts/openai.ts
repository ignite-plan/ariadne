// OpenAI TTS. OPENAI_API_KEY가 있을 때만 쓴다 (ElevenLabs는 사내 webfilter로 막혀 있음)
import { writeFileSync } from 'node:fs'
import type { TtsConfig, TtsProvider } from './index.ts'

export function openaiProvider({ voice = 'alloy', speed = 1 }: TtsConfig): TtsProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('video.tts.provider가 openai이면 .env에 OPENAI_API_KEY가 필요합니다')
  const model = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts'
  return {
    key: `openai:${model}:${voice}:${speed}`,
    async synthesize(text, file) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice, speed, input: text, response_format: 'wav' }),
      })
      if (!res.ok) throw new Error(`OpenAI TTS 실패 ${res.status}: ${await res.text()}`)
      writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    },
  }
}
