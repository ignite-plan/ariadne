// 가이드 영상: 시나리오, 만들기·미리보기, 음성, STG에서 기록
import { relative } from 'node:path'
import { loadManual } from '../../../src/core/manual.ts'
import { deleteVideo, loadVideo, saveVideo } from '../../../src/core/video/scenario.ts'
import type { VideoRunResult } from '../../shared/api.ts'
import { acquireExclusiveProfile, leaseEndpoint } from '../lib/browser-host.ts'
import { acquireShared } from '../lib/profile-lock.ts'
import { downloadModel, modelStatus } from '../lib/video-model.ts'
import { isRecording, startRecording, stopRecording } from '../lib/video-record.ts'
import { createVideo, videoInfos } from '../lib/videos.ts'
import { cancelVideo, runVideo, speak } from '../video.ts'
import {
  captureBaseUrl,
  handle,
  netFetch,
  ref,
  requireChrome,
  requireFfmpeg,
  requireStgSession,
  requireVoiceModel,
  send,
  videoModelDir,
} from './context.ts'

// 미리보기는 화면이 보이는 Chrome을 따로 띄운다(단독). 영상 만들기는 공유 Chrome에 탭을 열어 Claude 작업과 동시에 돈다
async function holdBrowser(session: string, preview: boolean) {
  if (preview) return { release: await acquireExclusiveProfile(session, '미리보기'), endpoint: undefined }
  const release = acquireShared(session, '영상 만들기')
  try {
    const endpoint = await leaseEndpoint(session)
    return {
      endpoint: endpoint.url,
      release: () => {
        endpoint.release()
        release()
      },
    }
  } catch (error) {
    release()
    throw error
  }
}

export function registerVideo() {
  handle('video:list', () => videoInfos(ref()))
  handle('video:load', (id) => loadVideo(ref(), id))
  handle('video:save', (scenario) => saveVideo(ref(), scenario))
  handle('video:create', (input) => createVideo(ref(), input))
  handle('video:remove', (id) => deleteVideo(ref(), id))
  handle('video:run', async (id, options = {}): Promise<VideoRunResult> => {
    if (isRecording()) throw new Error('STG 기록을 먼저 끝내세요')
    const r = ref()
    requireChrome()
    const session = requireStgSession(r)
    const narrate = !options.preview && options.tts !== false
    if (narrate) requireVoiceModel()
    // 앱은 사내 TLS 프록시 때문에 worker에서 외부 API를 부를 수 없어 Kokoro(로컬)만 쓴다
    const tts = narrate ? { ...loadManual(r).video?.tts, provider: 'kokoro' as const } : false
    // 잠금을 잡기 전에 확인한다 (잡은 뒤 실패하면 풀리지 않는다)
    const ffmpegPath = options.preview ? undefined : requireFfmpeg()
    const baseUrl = captureBaseUrl(r)
    const browser = await holdBrowser(session, Boolean(options.preview))
    const result = await runVideo(
      {
        ...r,
        id,
        baseUrl,
        profileDir: session,
        cdpEndpoint: browser.endpoint,
        tts,
        modelDir: videoModelDir(),
        localModel: true,
        ffmpegPath,
        preview: options.preview,
        fromScene: options.fromScene,
      },
      (progress) => send('video-progress', progress),
    ).finally(browser.release)
    if (!result.ok) return result
    const rel = (path?: string) => (path ? relative(r.root, path) : undefined)
    return { ...result, mp4: rel(result.mp4), srt: rel(result.srt), vtt: rel(result.vtt) }
  })
  handle('video:cancel', () => cancelVideo())
  handle('video:speak', async (text, speed) => {
    const r = ref()
    if (!text.trim()) throw new Error('문장을 입력하세요')
    requireVoiceModel()
    const base = loadManual(r).video?.tts
    const tts = { ...base, provider: 'kokoro' as const, speed: speed ?? base?.speed }
    const clip = await speak({ op: 'speak', root: r.root, text: text.trim(), tts, modelDir: videoModelDir() })
    return { path: relative(r.root, clip.file), ms: clip.ms }
  })
  handle('video:record', async (id, scene) => {
    const r = ref()
    requireChrome()
    const session = requireStgSession(r)
    const baseUrl = captureBaseUrl(r)
    // 기록이 끝날 때('stop')까지 프로필을 잡는다
    const release = await acquireExclusiveProfile(session, 'STG 기록')
    await startRecording({
      ...r,
      id,
      scene,
      baseUrl,
      profileDir: session,
      onEvent: (event) => {
        if (event.kind === 'stop') release()
        send('video-record', event)
      },
    }).catch((error) => {
      release()
      throw error
    })
  })
  handle('video:stopRecord', () => stopRecording())
  handle('video:model', () => modelStatus(videoModelDir()))
  handle('video:downloadModel', () =>
    downloadModel(videoModelDir(), (url) => netFetch(url), (progress) => send('video-model-progress', progress)),
  )
}
