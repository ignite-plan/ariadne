// Claude에게 줄 작업 지시. 스킬 본문 + "이번 작업". Electron에 의존하지 않는다 (단위 테스트 대상)
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ManualRef } from '../../../src/core/manual.ts'
import type { DraftInput } from '../../shared/api.ts'

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

export function namedSkillText(root: string, name: string, bundled: Record<string, string>) {
  const file = join(root, '.claude/skills', name, 'SKILL.md')
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : bundled[name]
  if (!raw) throw new Error(`스킬을 찾지 못했습니다: ${name}`)
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

// 최신화 1단계: 기획서 요약 파일을 만든다 (지난 요약과 버전이 같으면 쓰지 않는다)
export function specTaskText(
  ref: ManualRef,
  input: DraftInput,
  { digestFile, previous = [] }: { digestFile: string; previous?: { id: string; title: string; version: number }[] },
) {
  const lines = ['## 이번 작업', `- 매뉴얼 id: ${ref.manual}`, `- 메뉴: ${input.menu}`, '- 할 일: 최신 기획서를 읽어 아래 화면별 요약 JSON을 쓴다']
  lines.push(`- 요약 파일: ${digestFile}`)
  lines.push('- 대상 화면 (screens의 키):')
  for (const target of input.targets ?? []) lines.push(`  - ${target} (manuals/${ref.manual}/${target})`)
  lines.push(
    previous.length
      ? `- 지난 요약의 근거 문서 (id와 버전이 모두 같으면 쓰지 말고 reused):\n${previous.map((p) => `  - ${p.id} v${p.version} ${p.title}`).join('\n')}`
      : '- 지난 요약: 없음',
  )
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
    lines.push('', '## 기획서 요약', options.brief?.trim() || '(없음 — Confluence에서 직접 찾는다)')
  }
  return lines.join('\n')
}
