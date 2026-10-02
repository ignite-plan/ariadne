// 가이드 영상 목록·새로 만들기. 파일은 manuals/<m>/videos/<id>.yaml, 결과는 dist/videos/<id>.mp4
import { existsSync, statSync } from 'node:fs'
import { relative } from 'node:path'
import type { ManualRef } from '../../../src/core/manual.ts'
import { videoOutputs } from '../../../src/core/video/index.ts'
import { listVideos, loadVideo, saveVideo, type VideoScenario } from '../../../src/core/video/scenario.ts'
import type { VideoInfo } from '../../shared/api.ts'
import { slugify } from './sections.ts'

export function videoOutput(ref: ManualRef, id: string): VideoInfo['output'] {
  const { mp4, vtt } = videoOutputs(ref, id)
  if (!existsSync(mp4)) return undefined
  const stat = statSync(mp4)
  return { mp4: relative(ref.root, mp4), vtt: relative(ref.root, vtt), updatedAt: stat.mtimeMs, size: stat.size }
}

export function videoInfos(ref: ManualRef): VideoInfo[] {
  return listVideos(ref).map((id) => {
    try {
      const v = loadVideo(ref, id)
      return { id, title: v.title, section: v.section, mutates: Boolean(v.mutates), scenes: v.scenes.length, output: videoOutput(ref, id) }
    } catch (error) {
      return { id, title: id, mutates: false, scenes: 0, error: (error as Error).message }
    }
  })
}

// 제목으로 id를 만든다. 이미 있으면 -2, -3 …
export function newVideoId(ref: ManualRef, title: string) {
  const base = slugify(title) || 'video'
  const taken = new Set(listVideos(ref))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

export function createVideo(ref: ManualRef, { title, section }: { title: string; section?: string }): VideoScenario {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('영상 제목을 입력하세요')
  return saveVideo(ref, {
    id: newVideoId(ref, trimmed),
    title: trimmed,
    ...(section ? { section } : {}),
    maskPersonal: true,
    scenes: [{ say: '', steps: [] }],
  })
}
