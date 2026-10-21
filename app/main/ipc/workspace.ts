// 작업 폴더(매뉴얼 리포): 내려받기, 동기화, 바뀐 파일, 제출
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { shell } from 'electron'
import { describeChanges, expandRevertPaths } from '../lib/changes.ts'
import * as gitOps from '../lib/git.ts'
import { createPullRequest } from '../lib/github.ts'
import { clearAllReviews, clearReviewsForRepoPaths } from '../lib/review.ts'
import { resolveInside } from '../lib/sections.ts'
import { getSettings } from '../settings.ts'
import { currentUser, gitContext, handle, netFetch, recordAuthor, ref, requireToken, requireWorkspace, send, workspaceState } from './context.ts'

export function registerWorkspace() {
  handle('workspace:state', () => workspaceState())
  handle('workspace:clone', async () => {
    const { workspaceDir } = getSettings()
    if (gitOps.isRepo(workspaceDir)) return workspaceState()
    if (existsSync(workspaceDir) && readdirSync(workspaceDir).length) {
      throw new Error(`${workspaceDir} 폴더가 비어 있지 않습니다. 다른 폴더를 고르세요`)
    }
    await gitOps.clone(await gitContext((p) => send('clone-progress', p)))
    return workspaceState()
  })
  handle('workspace:sync', async () => {
    requireWorkspace()
    return gitOps.sync(await gitContext())
  })
  handle('workspace:changes', async () => {
    requireWorkspace()
    const r = ref()
    return describeChanges(r, await gitOps.changes(r.root))
  })
  handle('workspace:revert', async (paths) => {
    const root = requireWorkspace()
    // "매뉴얼 삭제" 묶음은 그 매뉴얼 파일 전부로 푼다
    const files = paths.some((p) => p.endsWith('/')) ? expandRevertPaths(paths, await gitOps.changes(root)) : paths
    await gitOps.revert(root, files)
    clearReviewsForRepoPaths(ref(), files)
  })
  handle('workspace:diff', async (path) => {
    const root = requireWorkspace()
    const file = resolveInside(root, path)
    return { before: await gitOps.headContent(root, path), after: existsSync(file) ? readFileSync(file, 'utf8') : null }
  })
  handle('workspace:submit', async (message) => {
    requireWorkspace()
    const settings = getSettings()
    const token = requireToken()
    const me = await currentUser()
    const result = await gitOps.submit(await gitContext(), {
      message: message.trim() || 'docs: 매뉴얼 수정',
      mode: settings.submitMode,
      login: me.login,
      createPullRequest: (input) => createPullRequest(netFetch, token, settings.repoUrl, input),
    })
    // 제출했으면 검토를 마친 것으로 본다
    clearAllReviews(ref())
    return result
  })
  // 내 PC에만 기록(커밋). 원격에 연결하지 않아 오프라인에서도 된다. 검토 표시는 그대로 둔다
  handle('workspace:record', async (message) => gitOps.record(requireWorkspace(), await recordAuthor(), message))
  handle('workspace:reveal', (relPath) => {
    const root = requireWorkspace()
    if (relPath) shell.showItemInFolder(resolveInside(root, relPath))
    else void shell.openPath(root)
  })
}
