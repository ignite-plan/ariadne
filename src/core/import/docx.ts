// Word(docx) 읽기: pandoc 변환, 그림의 자르기·크기 정보, 이미지 저장
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { PNG } from 'pngjs'
import { isPngBytes } from '../naming.ts'

export interface Drawing {
  crop: { l: number; t: number; r: number; b: number }
  widthIn: number
  ratio: number
  // 그림이 쓰는 Word 안 이미지 파일 이름 (media/image3.png → image3.png). 도형·텍스트 상자처럼 그림이 아니면 없음
  media?: string
}

// pandoc이 꺼낸 이미지(본문 순서)마다 Word 그림 정보를 찾는다. 순서가 아니라 이미지 파일 이름으로 짝을 맞춘다:
// Word에는 도형·텍스트 상자도 그림 요소로 들어 있어 순서로 맞추면 그 뒤 이미지들이 한 칸씩 밀린다.
// 같은 이미지 파일을 여러 번 쓰면 문서 순서대로 하나씩 쓴다
export function matchDrawings(imageSrcs: string[], drawings: Drawing[]) {
  const queues = new Map<string, Drawing[]>()
  for (const d of drawings) if (d.media) queues.set(d.media, [...(queues.get(d.media) ?? []), d])
  const last = new Map<string, Drawing>()
  return imageSrcs.map((src) => {
    const name = basename(src)
    const next = queues.get(name)?.shift() ?? last.get(name)
    if (next) last.set(name, next)
    return next
  })
}

const EMU_PER_INCH = 914400

export function runPandoc(pandoc: string, args: string[]) {
  return new Promise<void>((done, fail) => {
    const child = spawn(pandoc, args)
    let err = ''
    child.stderr.setEncoding('utf8').on('data', (d) => (err += d))
    child.on('error', (e) => fail(new Error(`pandoc 실행 실패 (${pandoc}): ${e.message}`)))
    child.on('close', (code) => (code === 0 ? done() : fail(new Error(`pandoc 변환 실패: ${err}`))))
  })
}

// pandoc은 Word의 자르기(srcRect)와 비율 변경을 버린다. 문서 순서대로 drawing 정보를 읽어 이미지에 다시 적용한다
export function readDrawings(docx: string): Drawing[] {
  const documentXml = execFileSync('unzip', ['-p', docx, 'word/document.xml'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  // r:embed="rId5" → media/image3.png
  const relsXml = execFileSync('unzip', ['-p', docx, 'word/_rels/document.xml.rels'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const targets = new Map([...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [tag.match(/\bId="([^"]+)"/)?.[1], tag.match(/\bTarget="([^"]+)"/)?.[1]]))
  return [...documentXml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>/g)].map(([xml]) => {
    const embed = xml.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1]
    const target = embed ? targets.get(embed) : undefined
    const extent = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)
    const cx = Number(extent?.[1] ?? 0)
    const cy = Number(extent?.[2] ?? 0)
    const rect = xml.match(/<a:srcRect([^>]*)\/>/)?.[1] ?? ''
    const edge = (k: string) => Math.max(0, Number(rect.match(new RegExp(`\\b${k}="(-?\\d+)"`))?.[1] ?? 0)) / 100000
    return {
      crop: { l: edge('l'), t: edge('t'), r: edge('r'), b: edge('b') },
      widthIn: cx / EMU_PER_INCH,
      ratio: cx ? cy / cx : 0,
      ...(target ? { media: basename(target) } : {}),
    }
  })
}

// 자르기를 반영해 저장하고, 원본 표시 비율과 다르면(늘이기) 높이를 함께 돌려준다
export function writeImage(src: string, dest: string, drawing: Drawing | undefined, pandocSize: string | undefined) {
  if (!drawing || !drawing.widthIn) {
    copyFileSync(src, dest)
    return pandocSize ?? ''
  }
  const { crop, widthIn, ratio } = drawing
  const png = PNG.sync.read(readFileSync(src))
  const x = Math.round(png.width * crop.l)
  const y = Math.round(png.height * crop.t)
  const width = Math.round(png.width * (1 - crop.l - crop.r))
  const height = Math.round(png.height * (1 - crop.t - crop.b))
  if (width === png.width && height === png.height) copyFileSync(src, dest)
  else {
    const out = new PNG({ width, height })
    PNG.bitblt(png, out, x, y, width, height, 0, 0)
    writeFileSync(dest, PNG.sync.write(out))
  }
  const stretched = Math.abs(height / width - ratio) / ratio > 0.03
  const size = `width=${widthIn.toFixed(2)}in`
  return stretched ? `{${size} height=${(widthIn * ratio).toFixed(2)}in}` : `{${size}}`
}

// PNG가 아닌 이미지(EMF, JPEG 등)는 자르기를 적용하지 못한다. 확장자를 지키고 그대로 복사한다
export function isPng(path: string) {
  return isPngBytes(readFileSync(path).subarray(0, 4))
}
