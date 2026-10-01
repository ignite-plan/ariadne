// 원본 Word에서 본문과 이미지를 걷어내고, pandoc 스타일을 원본 서식에 맞춰 정의한 reference.docx를 만든다.
// 원본 본문은 대부분 직접 서식(Calibri 14pt)이라 스타일 정의로 옮겨 담는다.
// usage: pnpm tsx src/make-reference.ts --docx ~/Desktop/Hyundai.docx --manual bo
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: { docx: { type: 'string' }, manual: { type: 'string', default: 'bo' } },
})
if (!values.docx) throw new Error('--docx is required')

const work = mkdtempSync(join(tmpdir(), 'manual-ref-'))
execFileSync('unzip', ['-q', resolve(values.docx), '-d', work])

const docPath = join(work, 'word/document.xml')
const doc = readFileSync(docPath, 'utf8')
// 본문 구역은 머리글/바닥글(페이지 번호)을 가진 sectPr. 문서 끝 sectPr은 표지 뒤 빈 구역이다
const sectPr = doc.match(/<w:sectPr[^>]*>(?:(?!<\/w:sectPr>)[\s\S])*?<w:footerReference[\s\S]*?<\/w:sectPr>/)![0]
writeFileSync(docPath, doc.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${sectPr}</w:body>`))

rmSync(join(work, 'word/media'), { recursive: true, force: true })
const relsPath = join(work, 'word/_rels/document.xml.rels')
writeFileSync(
  relsPath,
  readFileSync(relsPath, 'utf8').replace(/<Relationship [^>]*Target="media\/[^"]*"[^>]*\/>/g, ''),
)

const BODY_RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="맑은 고딕" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>'

function paragraphStyle(id: string, name: string, basedOn: string, pPr: string, rPr = '') {
  return `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${basedOn}"/><w:qFormat/><w:pPr>${pPr}</w:pPr>${rPr}</w:style>`
}

const pandocStyles = [
  paragraphStyle('BodyText', 'Body Text', 'a', '<w:spacing w:before="60" w:after="60"/>', BODY_RPR),
  paragraphStyle('FirstParagraph', 'First Paragraph', 'BodyText', ''),
  paragraphStyle('Compact', 'Compact', 'BodyText', '<w:spacing w:before="20" w:after="20"/>'),
  paragraphStyle('CaptionedFigure', 'Captioned Figure', 'a', '<w:keepNext/><w:spacing w:before="120" w:after="0"/><w:jc w:val="center"/>'),
  paragraphStyle('Figure', 'Figure', 'a', '<w:jc w:val="center"/>'),
  paragraphStyle('ImageCaption', 'Image Caption', 'af0', ''),
  paragraphStyle('TOCHeading', 'TOC Heading', '11', '<w:outlineLvl w:val="9"/>'),
].join('')

// 원본은 장마다 수동 페이지 나누기를 썼다. heading 1(styleId 11)에 pageBreakBefore로 옮긴다
const stylesPath = join(work, 'word/styles.xml')
writeFileSync(
  stylesPath,
  readFileSync(stylesPath, 'utf8')
    .replace(/(<w:style [^>]*w:styleId="11"[\s\S]*?<w:pPr>)/, '$1<w:pageBreakBefore/>')
    .replace('</w:styles>', `${pandocStyles}</w:styles>`),
)

const output = resolve('manuals', values.manual!, 'reference.docx')
rmSync(output, { force: true })
execFileSync('zip', ['-q', '-r', '-X', output, ...readdirSync(work)], { cwd: work })
rmSync(work, { recursive: true, force: true })
console.log(output)
