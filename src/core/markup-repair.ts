// Word에 Markdown 표기가 글자로 찍히게 만드는 깨진 표기를 바로잡는다 (글자 내용은 바꾸지 않는다).
// - Word 가져오기가 남긴 빈 굵게(`**\**`), 닫는 별표가 이스케이프된 굵게(`**radio buttons.\**`)
// - 예전 형광펜 버튼이 굵게를 쪼갠 곳(`**[Domain**: …]{.mark}`, `*[*Menu Path**: …`), 목록 기호를 감싼 곳(`[  - text]{.mark}`),
//   줄 끝 줄바꿈 표시까지 감싼 곳(`[text\]{.mark}`)

// Word 가져오기 결과 한 줄
export function repairImportArtifacts(line: string) {
  return line.replace(/\*\*\\\*\*/g, '').replace(/(\*\*(?:\\.|[^*\n])*?[^\\\s*])\\\*\*/g, '$1**')
}

// 형광펜 표기 한 줄
export function repairMarkSpans(line: string) {
  return (
    line
      // 형광펜 안에 들어간 들여쓰기·목록 기호를 밖으로
      .replace(/^(\s*)\[(\s*)((?:[-*+]|\d+[.)])\s+)/, '$1$2$3[')
      // 줄 끝 줄바꿈 표시(\)가 형광펜 안에 들어가 닫는 괄호를 이스케이프한 곳
      .replace(/\\\]\{\.mark\}$/, ']{.mark}\\')
      // 굵게 여는 별표 사이·뒤에 들어간 형광펜 여는 괄호를 굵게 앞으로
      .replace(/\*\[\*(?=[^*\n]+?\*\*)/g, '[**')
      .replace(/\*\*\[(?=[^\]*\n]+?\*\*)/g, '[**')
  )
}

export function repairMarkup(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => repairMarkSpans(repairImportArtifacts(line)))
    .join('\n')
}
