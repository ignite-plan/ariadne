// Claude에게 줄 작업 지시. 스킬 본문 + "이번 작업". Electron에 의존하지 않는다 (단위 테스트 대상)
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ManualRef } from '../../../src/core/manual.ts'
import type { DraftInput } from '../../shared/api.ts'

export const SKILL_BY_MODE = { create: 'manual-draft', refresh: 'manual-refresh' } as const

// 작업 폴더(리포)의 스킬을 우선 쓴다. 오래된 clone이면 앱에 묶인 것을 쓴다
export function skillText(root: string, mode: DraftInput['mode'], bundled: Record<string, string>) {
  const name = SKILL_BY_MODE[mode ?? 'create']
  const file = join(root, '.claude/skills', name, 'SKILL.md')
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : bundled[name]
  if (!raw) throw new Error(`스킬을 찾지 못했습니다: ${name}`)
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

export function taskText(ref: ManualRef, input: DraftInput, options: { codeDir?: string } = {}) {
  const lines = ['## 이번 작업', `- 매뉴얼 id: ${ref.manual}`, `- 메뉴: ${input.menu}`]
  if (input.mode === 'refresh') {
    lines.push('- 할 일: 아래 기존 화면을 최신 기획서와 STG 화면에 맞춰 최신화한다')
    lines.push('- 대상 화면:')
    for (const target of input.targets ?? []) lines.push(`  - manuals/${ref.manual}/${target}`)
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
  return lines.join('\n')
}
