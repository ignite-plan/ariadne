// usage: pnpm video --manual bo [--id dealer-list,dealer-create] [--no-tts] [--headed] [--from 3] [--preview]
// --id가 없으면 manuals/<manual>/videos/*.yaml 시나리오를 모두 만든다
// --from: 이 장면(1부터)부터 녹화 / --preview: 브라우저를 띄워 실행만 해 본다 (파일 없음)
import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { defaultProfileDir, isSessionExpired, listVideos, renderVideo } from '../core/index.ts'
import { baseUrlOverride, loadEnv, MANUAL_OPTION, manualRef, withReloginHint } from './common.ts'

loadEnv()
const { values } = parseArgs({
  options: {
    ...MANUAL_OPTION,
    id: { type: 'string' },
    'no-tts': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    preview: { type: 'boolean', default: false },
    from: { type: 'string' },
  },
})
const ref = manualRef(values.manual)
const baseUrl = baseUrlOverride(ref.manual)
// tts.provider가 openai일 때만 쓴다
const openai = { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_TTS_MODEL }
const profileDir = defaultProfileDir(ref)
const ids = values.id?.split(',') ?? listVideos(ref)
if (!ids.length) throw new Error(`manuals/${ref.manual}/videos/에 시나리오가 없습니다`)

let failed = 0
for (const id of ids) {
  console.log(`▶ ${id}`)
  try {
    const result = await renderVideo({
      ...ref,
      id,
      baseUrl,
      profileDir,
      tts: values['no-tts'] ? false : undefined,
      openai,
      headed: values.headed || undefined,
      preview: values.preview,
      fromScene: values.from ? Number(values.from) - 1 : undefined,
      onProgress: ({ stage, message, step }) => console.log(`  ${stage} ${message}${step === undefined ? '' : ` 단계 ${step + 1}`}`),
    })
    // 같은 주소는 묶어서 한 줄로 (쿼리 문자열은 뺀다)
    const blocked = new Map<string, number>()
    for (const request of result.blockedRequests) {
      const [method, url] = request.split(' ')
      const key = `${method} ${url.split('?')[0]}`
      blocked.set(key, (blocked.get(key) ?? 0) + 1)
    }
    for (const [request, count] of blocked) console.log(`  ⚠ 쓰기 요청 차단${count > 1 ? ` ${count}건` : ''}: ${request}`)
    if (result.mp4) {
      console.log(`  ✓ ${relative(ref.root, result.mp4)} (${(result.durationMs / 1000).toFixed(1)}s, 자막 ${result.cues.length}개)`)
    } else console.log(`  ✓ 미리보기 끝 (${(result.durationMs / 1000).toFixed(1)}s)`)
  } catch (error) {
    failed++
    console.log(`  ✗ ${withReloginHint(error, ref, profileDir)}`)
    if (isSessionExpired(error)) break
  }
}
if (failed) process.exitCode = 1
