// Ariadne MCP 서버 이름과 도구 호출을 기획자가 읽을 문장. mcp.ts(서버)와 claude.ts(작업 기록)가 같이 쓴다
export const MCP_NAME = 'ariadne'

type Input = Record<string, unknown>

const sceneNo = (value: unknown) => Number(value) + 1

const LABELS: Record<string, (input: Input) => string> = {
  manual_outline: () => '매뉴얼 목차 확인',
  create_section: (i) => `화면 만들기: ${i.title ?? ''}`,
  stg_open: (i) => `STG 화면 열기: ${i.path ?? ''}`,
  stg_click: (i) => `STG 누르기: ${i.name ?? ''}`,
  stg_fill: (i) => `STG 입력: ${i.label ?? ''}`,
  save_shot: (i) => `캡처 저장: ${i.id ?? ''}`,
  video_get: (i) => `영상 시나리오 읽기: ${i.id ?? ''}`,
  video_save: (i) => `영상 시나리오 저장: ${i.id ?? ''}`,
  video_open_scene: (i) => `영상 장면 ${sceneNo(i.scene)} 앞까지 재생: ${i.id ?? ''}`,
  video_save_scene: (i) => `영상 장면 저장: ${i.id ?? ''}`,
  video_check: (i) => `영상 시나리오 실행해 보기${i.fromScene === undefined ? '' : ` (장면 ${sceneNo(i.fromScene)}부터)`}`,
}

export const ARIADNE_TOOLS = Object.keys(LABELS)

export function ariadneToolLabel(tool: string, input: Input = {}) {
  return LABELS[tool]?.(input) ?? tool
}
