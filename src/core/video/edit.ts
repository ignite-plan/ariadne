// 기록한 단계를 시나리오에 붙이는 규칙. 앱 renderer도 쓰므로 playwright를 import하지 않는다
import type { Step } from './scenario.ts'

// 기록한 단계를 붙인다. 선택 상자 클릭 + 항목 클릭은 '선택'으로, 같은 칸에 다시 입력하면 마지막 값으로 합친다
export function appendRecorded(steps: Step[], step: Step): Step[] {
  const last = steps.at(-1)
  if (last && 'click' in last && last.click.role === 'combobox' && 'click' in step && step.click.role === 'option' && step.click.name) {
    return [...steps.slice(0, -1), { choose: { target: last.click, option: step.click.name } }]
  }
  if (last && 'type' in last && 'type' in step && JSON.stringify(last.type.target) === JSON.stringify(step.type.target)) {
    return [...steps.slice(0, -1), step]
  }
  return [...steps, step]
}
