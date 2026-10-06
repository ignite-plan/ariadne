// Claude에게 줄 작업 지시. 스킬 본문 + "이번 작업". Electron에 의존하지 않는다 (단위 테스트 대상)
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ManualRef } from '../../../src/core/manual.ts'
import type { DraftInput } from '../../shared/api.ts'

// 앱이 실행하는 모든 Claude 작업에 붙이는 작업 방식. 시간의 대부분이 Claude 출력과 턴 수라서 둘을 줄인다
export const APP_RULES = `## 작업 방식 (앱 실행 공통)
- 도구 호출 사이에 설명 문장을 쓰지 않는다. 사람에게 보여 줄 글은 마지막 응답 하나뿐이다
- 서로 상관없는 조회(Read, Grep, Glob, Confluence 검색·페이지 읽기)는 한 턴에 함께 부른다
- STG 누르기(stg_click)는 매뉴얼 화면(섹션) 하나에 15번 안쪽으로 끝낸다. 이미 본 화면·팝업은 다시 열지 않는다
- 확인이 끝나면 더 둘러보지 말고 바로 쓴다. 근거가 모자란 곳은 TODO로 남긴다`

// 스킬 본문 + 작업 방식 + 이번 작업
export function composePrompt(skill: string, task: string) {
  return `${skill}\n\n${APP_RULES}\n\n${task}`
}

export const SKILL_BY_MODE = {
  create: 'manual-draft',
  refresh: 'manual-refresh',
  video: 'manual-video-draft',
  'video-scene': 'manual-video-scene',
} as const

// 작업 폴더(리포)의 스킬을 우선 쓴다. 오래된 clone이면 앱에 묶인 것을 쓴다
export function skillText(root: string, mode: DraftInput['mode'], bundled: Record<string, string>) {
  return namedSkillText(root, SKILL_BY_MODE[mode ?? 'create'], bundled)
}

// bundledFirst: 앱 코드와 응답 형식이 묶인 스킬은 앱에 묶인 것을 쓴다 (오래된 clone의 스킬로 형식이 어긋나지 않게)
export function namedSkillText(root: string, name: string, bundled: Record<string, string>, { bundledFirst = false } = {}) {
  const file = join(root, '.claude/skills', name, 'SKILL.md')
  const raw = (bundledFirst && bundled[name]) || (existsSync(file) ? readFileSync(file, 'utf8') : bundled[name])
  if (!raw) throw new Error(`스킬을 찾지 못했습니다: ${name}`)
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

// 최신화 1단계: 기획서 요약을 마지막 응답 JSON으로 받는다 (파일은 앱이 쓴다). 지난 요약과 버전이 같으면 reused
// 반영 범위가 있을 때 공통으로 붙이는 줄
function scopeLines(scope: NonNullable<DraftInput['scope']>) {
  const lines = ['- 반영 범위 (이 범위의 변경만 반영한다. 범위 밖 변경은 반영하지 않는다):']
  if (scope.from || scope.to) lines.push(`  - 기간: ${scope.from ?? '처음'} ~ ${scope.to ?? '최신'} (기획서 문서 히스토리의 변경 날짜 기준)`)
  if (scope.to) {
    const [y, m] = scope.to.split('-')
    lines.push(`  - 근거 화면 기획서: \`[${y}${m}output]\` 또는 그보다 이전 output 중 가장 최근 것 (그 뒤 output은 보지 않는다)`)
  }
  if (scope.tickets?.length) lines.push(`  - Jira 티켓: ${scope.tickets.join(', ')} (이 티켓에 해당하는 변경만)`)
  return lines
}

export function specTaskText(ref: ManualRef, input: DraftInput, { previous = [] }: { previous?: { id: string; title: string; version: number }[] } = {}) {
  const lines = [
    '## 이번 작업',
    `- 매뉴얼 id: ${ref.manual}`,
    `- 메뉴: ${input.menu}`,
    '- 할 일: 최신 기획서를 읽어 화면별 요약을 마지막 응답의 JSON 블록으로 낸다 (파일은 쓰지 않는다)',
  ]
  lines.push('- 대상 화면 (screens의 키):')
  for (const target of input.targets ?? []) lines.push(`  - ${target} (manuals/${ref.manual}/${target})`)
  if (input.scope) {
    lines.push(...scopeLines(input.scope))
    if (input.scope.tickets?.length) lines.push('  - 티켓 내용은 Jira 읽기 도구(jira_get_issue)로 확인한다')
    lines.push('- 반영 범위가 있으므로 JSON에 `changes`(화면 → 이번에 반영할 변경, 티켓 번호 포함)를 꼭 넣는다. 반영할 변경이 없는 화면은 changes에서 뺀다. 재사용(reused)은 하지 않는다')
  } else {
    lines.push(
      previous.length
        ? `- 지난 요약의 근거 문서 (id와 버전이 모두 같으면 요약하지 말고 {"reused": true}):\n${previous.map((p) => `  - ${p.id} v${p.version} ${p.title}`).join('\n')}`
        : '- 지난 요약: 없음',
    )
  }
  if (input.notes) lines.push(`- 기획자 메모: ${input.notes}`)
  return lines.join('\n')
}

// brief: 최신화 화면 하나에 줄 기획서 요약 (앱이 미리 만든 것)
export function taskText(ref: ManualRef, input: DraftInput, options: { codeDir?: string; brief?: string } = {}) {
  const lines = ['## 이번 작업', `- 매뉴얼 id: ${ref.manual}`, `- 메뉴: ${input.menu}`]
  if (input.mode === 'video-scene') {
    const scene = input.scene ?? 0
    const start = input.insert ? scene + 1 : scene
    lines.push(`- 할 일: 가이드 영상 시나리오 \`${input.video}\`의 장면 하나를 채운다 (video_get → video_open_scene → STG 확인 → video_save_scene → video_check)`)
    lines.push(
      input.insert
        ? `- 대상: 장면 ${scene + 1} 다음에 새 장면 (장면 ${start + 1}). video_open_scene(scene: ${start}), video_check(fromScene: ${start})`
        : `- 대상: 장면 ${scene + 1}. video_open_scene(scene: ${scene}), video_check(fromScene: ${scene})`,
    )
    lines.push(`- 기획자 요청 (이 장면에서 보여 줄 것): ${input.notes?.trim() || '(없음 — 지금 장면의 내레이션을 따른다)'}`)
    lines.push(
      input.targets?.[0] ? `- 연결된 매뉴얼 화면: manuals/${ref.manual}/${input.targets[0]} (내레이션 문장의 근거)` : '- 연결된 매뉴얼 화면: 없음',
    )
    return lines.join('\n')
  }
  if (input.mode === 'video') {
    lines.push(`- 할 일: 가이드 영상 시나리오 \`${input.video}\`를 채운다 (video_get → STG 확인 → video_save → video_check)`)
    lines.push(
      input.targets?.[0]
        ? `- 연결된 매뉴얼 화면: manuals/${ref.manual}/${input.targets[0]} (내레이션 문장의 근거)`
        : '- 연결된 매뉴얼 화면: 없음 (STG 화면과 기획서로 내레이션을 쓴다)',
    )
    lines.push(`- STG 경로 힌트: ${input.path || '(없음 — 연결 화면의 front-matter routes에서 찾는다)'}`)
    if (input.notes) lines.push(`- 기획자 메모: ${input.notes}`)
    return lines.join('\n')
  }
  if (input.mode === 'refresh') {
    const targets = input.targets ?? []
    if (targets.length === 1) {
      lines.push('- 할 일: 아래 기존 화면 하나를 최신 기획서와 STG 화면에 맞춰 최신화한다 (다른 화면 파일은 고치지 않는다)')
      lines.push(`- 대상 화면: manuals/${ref.manual}/${targets[0]}`)
    } else {
      lines.push('- 할 일: 아래 기존 화면을 최신 기획서와 STG 화면에 맞춰 최신화한다')
      lines.push('- 대상 화면:')
      for (const target of targets) lines.push(`  - manuals/${ref.manual}/${target}`)
    }
    if (input.scope) {
      lines.push(...scopeLines(input.scope))
      lines.push('  - 기획서 요약의 "이번에 반영할 변경"에 있는 것만 고친다. 나머지 문장은 기획서·화면과 달라도 그대로 둔다')
      lines.push('  - STG에는 범위 뒤의 변경이 이미 배포돼 있을 수 있다. 화면이 반영할 변경과 다르거나 범위 밖 변경이 보이면 고치지 말고 `<!-- TODO: STG에 반영 범위 밖 변경 보임 - <무엇> -->`')
      lines.push('  - 캡처 이미지는 다시 찍지 않는다 (save_shot 금지). 화면 구성이 바뀌어 이미지가 맞지 않으면 그 이미지 아래에 `<!-- TODO: 이미지 갱신 필요 - <티켓> <무엇> -->`')
    }
  } else {
    const place = input.chapterDir
      ? `기존 장 \`${input.chapterDir}\`에 추가`
      : `새 장 "${input.newChapterTitle ?? input.menu}"을(를) chapterIndex ${input.chapterIndex ?? '맨 뒤'} 위치에 만든다`
    lines.push(`- 넣을 위치: ${place}`)
  }
  lines.push(`- STG 경로 힌트: ${input.path || '(없음 — front-matter routes나 Confluence 메뉴 LIST에서 찾는다)'}`)
  lines.push(
    options.codeDir
      ? `- dealerhub-web 코드: ${options.codeDir} (읽기만 가능. front-matter sources/i18nPrefix를 채울 때 쓴다)`
      : '- dealerhub-web 코드: 없음 (front-matter sources/i18nPrefix는 비워 둔다)',
  )
  if (input.notes) lines.push(`- 기획자 메모: ${input.notes}`)
  if (input.mode === 'refresh') {
    lines.push(
      '',
      '## 기획서 요약',
      options.brief?.trim()
        ? `${options.brief.trim()}\n\n(이번 작업에는 Confluence 도구가 없다. 위 요약에 없는 정책은 TODO로 남긴다)`
        : '(없음 — Confluence에서 직접 찾는다)',
    )
  }
  return lines.join('\n')
}
