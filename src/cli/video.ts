// usage: pnpm video --manual bo [--id dealer-list,dealer-create] [--no-tts] [--headed] [--from 3] [--preview]
// --id가 없으면 manuals/<manual>/videos/*.yaml 시나리오를 모두 만든다
// --from: 이 장면(1부터)부터 녹화 / --preview: 브라우저를 띄워 실행만 해 본다 (파일 없음)
import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { defaultProfileDir, listVideos, renderVideo } from '../core/index.ts'

try {
  process.loadEnvFile()
} catch {
  // .env 없이 manual.yaml capture.baseUrl만 써도 된다
}
const { values } = parseArgs({
  options: {
    manual: { type: 'string', default: 'bo' },
    id: { type: 'string' },
    'no-tts': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    preview: { type: 'boolean', default: false },
    from: { type: 'string' },
  },
})
// .env BO_BASE_URL은 bo 매뉴얼의 주소를 덮어쓴다 (capture와 같음)
const baseUrl = values.manual === 'bo' ? process.env.BO_BASE_URL : undefined
const ref = { root: process.cwd(), manual: values.manual! }
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
    const message = error instanceof Error ? error.message : String(error)
    const relogin = message.includes(profileDir) || message.includes('세션 만료')
    console.log(`  ✗ ${relogin ? `${message}: pnpm login --manual ${ref.manual}` : message}`)
    if (message.includes('세션 만료')) break
  }
}
if (failed) process.exitCode = 1
