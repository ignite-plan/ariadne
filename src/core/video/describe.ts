// 단계를 기획자가 읽는 문장으로. 앱 편집기와 오류 메시지가 같이 쓴다 (playwright를 import하지 않는다)
import type { Step, Target } from './scenario.ts'

const ROLE_NAMES: Record<string, string> = {
  button: '버튼',
  link: '링크',
  tab: '탭',
  menuitem: '메뉴',
  checkbox: '체크박스',
  radio: '라디오 버튼',
  combobox: '선택 상자',
  option: '선택 항목',
  row: '행',
  textbox: '입력칸',
  treeitem: '트리 항목',
  heading: '제목',
  dialog: '팝업',
  cell: '칸',
  form: '입력 영역',
  table: '표',
}

export function describeTarget(target: Target): string {
  let text: string
  if (target.role) {
    const kind = ROLE_NAMES[target.role] ?? target.role
    text = target.name ? `'${target.name}' ${kind}` : kind
  } else if (target.label) text = `'${target.label}' 입력칸`
  else if (target.placeholder) text = `'${target.placeholder}' 입력칸`
  else text = `'${target.text ?? ''}' 글자`
  if (target.nth) text = `${text} ${target.nth + 1}번째`
  if (target.within) text = `${describeTarget(target.within)} 안의 ${text}`
  return text
}

export function describeStep(step: Step): string {
  if ('open' in step) return `${step.open} 화면 열기`
  if ('waitFor' in step) return `${describeTarget(step.waitFor)} 표시 기다림`
  if ('click' in step) return `${describeTarget(step.click)} 클릭`
  if ('hover' in step) return `${describeTarget(step.hover)} 위에 마우스 올리기`
  if ('scroll' in step) return `${describeTarget(step.scroll)} 위치로 스크롤`
  if ('type' in step) return `${describeTarget(step.type.target)}에 "${step.type.text}" 입력`
  if ('choose' in step) return `${describeTarget(step.choose.target)}에서 '${step.choose.option}' 선택`
  if ('select' in step) return `${describeTarget(step.select.target)}에서 '${step.select.value}' 선택`
  if ('highlight' in step) return `${describeTarget(step.highlight.target)} 강조${step.highlight.ms ? ` (${step.highlight.ms / 1000}초)` : ''}`
  return `${step.pause / 1000}초 멈춤`
}
