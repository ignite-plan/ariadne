// ariadne:// 파일 응답 중 영상·음성용. <video>가 앞뒤로 옮겨 가며 보려면 Range(206) 응답이 필요하다
import { createReadStream, statSync } from 'node:fs'
import { extname } from 'node:path'
import { Readable } from 'node:stream'

const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.wav': 'audio/wav', '.vtt': 'text/vtt', '.srt': 'text/plain' }

export function isMediaFile(file: string) {
  return extname(file).toLowerCase() in TYPES
}

export function mediaResponse(file: string, range: string | null) {
  const size = statSync(file).size
  const headers: Record<string, string> = {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // <track>는 다른 origin(renderer)에서 읽으므로 CORS가 필요하다
    'Access-Control-Allow-Origin': '*',
  }
  const match = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) {
    headers['Content-Length'] = String(size)
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers })
  }
  // bytes=-500 은 끝에서 500바이트
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
  }
  headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  headers['Content-Length'] = String(end - start + 1)
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers })
}
