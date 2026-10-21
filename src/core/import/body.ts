// 장 소개·절 본문을 매뉴얼 Markdown으로 정리하고, 본문의 이미지를 images/에 저장한다
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repairImportArtifacts } from '../markup-repair.ts'
import { mergeCaptionParagraphs, unwrapImageTables } from './captions.ts'
import { slugify, uniqueName } from '../naming.ts'
import { isPng, writeImage, type Drawing } from './docx.ts'

export interface BodyWriterOptions {
  imagesDir: string
  // pandoc이 꺼낸 이미지 순서(#index)대로 Word 그림 정보
  drawings: (Drawing | undefined)[]
  warnings: string[]
  // Word의 캡션 스타일 문단 글자. 이미지 바로 다음의 캡션 문단을 이미지 캡션으로 옮긴다
  captions?: string[]
  onImage?: () => void
}

// 이미지 이름은 caption slug(없으면 <절>-img-N). 이미 쓴 이름이나 images/에 있는 파일과 겹치면 -2, -3 …
export function createBodyWriter({ imagesDir, drawings, warnings, captions = [], onImage }: BodyWriterOptions) {
  const used = new Set<string>()
  const saveImage = (alt: string, src: string, index: string, pandocSize: string | undefined, base: string) => {
    const png = isPng(src)
    const ext = png ? 'png' : src.split('.').pop()!.toLowerCase()
    const name = uniqueName(base, (n) => used.has(n) || existsSync(join(imagesDir, `${n}.${ext}`)))
    used.add(name)
    const dest = join(imagesDir, `${name}.${ext}`)
    const size = png ? writeImage(src, dest, drawings[Number(index)], pandocSize) : (copyFileSync(src, dest), pandocSize ?? '')
    if (!png) warnings.push(`PNG가 아닌 이미지(${ext})는 그대로 넣었습니다: images/${name}.${ext}`)
    onImage?.()
    return `![${alt}](images/${name}.${ext})${size}`
  }

  return (body: string[], sectionSlug: string) => {
    let unnamed = 0
    const prepared = body
      .map((l) => l.replace(/^(> ?)+/, ''))
      .map((l) => l.replace(/\[\]\{#[^}]*\}/g, ''))
      // Word의 빈 굵게가 남긴 `**\**`, 닫는 별표가 이스케이프된 굵게 (Word에 ** 가 글자로 찍힌다)
      .map(repairImportArtifacts)
      // Word 노란 형광펜은 본문에 [글자]{.mark}로 남긴다 (Word 빌드에서 다시 형광펜이 된다).
      // 제목 줄, 이미지 캡션 안, 이미지만 감싼·빈 형광펜은 뺀다
      .map((l) => {
        let prev
        do {
          prev = l
          l = l.replace(/(!\[[^\]]*?)\[([^\]]*)\]\{\.mark\}/g, '$1$2')
        } while (l !== prev)
        return l
      })
      .map((l) => l.replace(/\[(!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?)\]\{\.mark\}/g, '$1'))
      .map((l) => l.replace(/\[(\s*)\]\{\.mark\}/g, '$1'))
      .map((l) => (/^#/.test(l) ? l.replace(/\[([^\]]*)\]\{\.mark\}/g, '$1') : l))
    // 이미지만 든 칸 하나짜리 표는 풀고(표 캡션 → 이미지 캡션), 이미지 아래 따로 달린 Word 캡션 문단도 이미지 캡션으로
    // (이미지 이름도 캡션으로 짓는다)
    return mergeCaptionParagraphs(unwrapImageTables(prepared).lines, captions)
      .lines.map((l) =>
        l.replace(/!\[([^\]]*)\]\(([^)#]+)#(\d+)\)(\{[^}]*\})?/g, (_, alt: string, src: string, index: string, pandocSize?: string) => {
          // Word가 자동 생성한 한글 대체 텍스트는 caption이 아니다
          const caption = /[가-힣]/.test(alt) ? '' : alt
          const base = caption ? slugify(caption) || `${sectionSlug}-img` : `${sectionSlug}-img-${++unnamed}`
          return saveImage(caption, src, index, pandocSize, base)
        }),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
}
