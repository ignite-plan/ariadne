// 원본 Word에서 본문과 이미지를 걷어내고, pandoc 스타일을 원본 서식에 맞춰 정의한 reference.docx를 만든다.
// 원본 본문은 대부분 직접 서식(Calibri 14pt)이라 스타일 정의로 옮겨 담는다.
// 스타일은 ID가 아니라 이름(Normal, heading 1, caption)으로 찾는다. ID는 Word 언어마다 다르다 (한글 Word: a, 11, af0)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 원본 본문은 Calibri 14pt와 굴림 12pt(Normal 기본값)가 섞여 있다. Normal을 Calibri 14pt로 통일한다
const NORMAL_RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="맑은 고딕" w:hAnsi="Calibri" w:cs="Calibri"/><w:kern w:val="0"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:eastAsia="ko-KR"/></w:rPr>'
// 장 제목도 장마다 14~22pt로 제각각이라 "1. Back-office Login" 기준 Calibri 20pt로 통일한다
const HEADING1_RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="맑은 고딕" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="000000" w:themeColor="text1"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// <w:name w:val="heading 1"/>을 가진 paragraph 스타일의 ID
export function styleIdByName(styles: string, name: string) {
  for (const [style] of styles.matchAll(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g)) {
    if (!/w:type="paragraph"/.test(style.slice(0, style.indexOf('>')))) continue
    const styleName = style.match(/<w:name w:val="([^"]*)"/)?.[1]
    if (styleName?.toLowerCase() === name.toLowerCase()) return style.match(/w:styleId="([^"]*)"/)?.[1]
  }
  return undefined
}

function setRunProps(styles: string, styleId: string, rPr: string) {
  const id = escapeRegExp(styleId)
  return styles.replace(
    new RegExp(`(<w:style [^>]*w:styleId="${id}"[^>]*>(?:(?!</w:style>)[\\s\\S])*?)<w:rPr>[\\s\\S]*?</w:rPr>`),
    `$1${rPr}`,
  )
}

function paragraphStyle(id: string, name: string, basedOn: string, pPr: string) {
  return `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${basedOn}"/><w:qFormat/><w:pPr>${pPr}</w:pPr></w:style>`
}

// styles.xml을 pandoc reference용으로 고친다
export function referenceStyles(styles: string) {
  const normal = styleIdByName(styles, 'Normal')
  const heading1 = styleIdByName(styles, 'heading 1')
  const caption = styleIdByName(styles, 'caption')
  if (!normal || !heading1) throw new Error('원본 Word에서 Normal/제목 1 스타일을 찾지 못했습니다')

  const pandocStyles = [
    paragraphStyle('BodyText', 'Body Text', normal, '<w:spacing w:before="60" w:after="60"/>'),
    paragraphStyle('FirstParagraph', 'First Paragraph', 'BodyText', ''),
    paragraphStyle('Compact', 'Compact', 'BodyText', '<w:spacing w:before="20" w:after="20"/>'),
    paragraphStyle('CaptionedFigure', 'Captioned Figure', normal, '<w:keepNext/><w:spacing w:before="120" w:after="0"/><w:jc w:val="center"/>'),
    paragraphStyle('Figure', 'Figure', normal, '<w:jc w:val="center"/>'),
    paragraphStyle('ImageCaption', 'Image Caption', caption ?? normal, ''),
    paragraphStyle('TOCHeading', 'TOC Heading', heading1, '<w:outlineLvl w:val="9"/>'),
  ].join('')

  let next = setRunProps(styles, normal, NORMAL_RPR)
  next = setRunProps(next, heading1, HEADING1_RPR)
  // 원본은 장마다 수동 페이지 나누기를 썼다. 제목 1에 pageBreakBefore로 옮긴다
  return next
    .replace(new RegExp(`(<w:style [^>]*w:styleId="${escapeRegExp(heading1)}"[\\s\\S]*?<w:pPr>)`), '$1<w:pageBreakBefore/>')
    .replace('</w:styles>', `${pandocStyles}</w:styles>`)
}

// 본문 구역은 머리글/바닥글(페이지 번호)을 가진 sectPr. 없으면 마지막 sectPr
export function emptyBody(documentXml: string) {
  const withFooter = documentXml.match(
    /<w:sectPr[^>]*>(?:(?!<\/w:sectPr>)[\s\S])*?<w:footerReference[\s\S]*?<\/w:sectPr>/,
  )?.[0]
  const sectPr = withFooter ?? [...documentXml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)].at(-1)?.[0] ?? ''
  return documentXml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${sectPr}</w:body>`)
}

export function makeReference(docx: string, output: string) {
  const work = mkdtempSync(join(tmpdir(), 'manual-ref-'))
  try {
    execFileSync('unzip', ['-q', docx, '-d', work])
    const docPath = join(work, 'word/document.xml')
    writeFileSync(docPath, emptyBody(readFileSync(docPath, 'utf8')))

    rmSync(join(work, 'word/media'), { recursive: true, force: true })
    const relsPath = join(work, 'word/_rels/document.xml.rels')
    writeFileSync(
      relsPath,
      readFileSync(relsPath, 'utf8').replace(/<Relationship [^>]*Target="media\/[^"]*"[^>]*\/>/g, ''),
    )

    const stylesPath = join(work, 'word/styles.xml')
    writeFileSync(stylesPath, referenceStyles(readFileSync(stylesPath, 'utf8')))

    rmSync(output, { force: true })
    execFileSync('zip', ['-q', '-r', '-X', output, ...readdirSync(work)], { cwd: work })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return output
}
