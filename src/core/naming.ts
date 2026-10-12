// 파일·id 이름 규칙. CLI와 앱(main, renderer)이 같이 쓴다 (renderer도 쓰므로 node 모듈에 의존하지 않는다)

// 매뉴얼·이미지·캡처·영상 id
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
export const ID_RULE = '영문 소문자, 숫자, -만 쓸 수 있습니다'

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// base가 이미 쓰이고 있으면 base-2, base-3 …
export function uniqueName(base: string, taken: (name: string) => boolean) {
  let name = base
  for (let n = 2; taken(name); n++) name = `${base}-${n}`
  return name
}

export function isPngBytes(bytes: Uint8Array) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
}
