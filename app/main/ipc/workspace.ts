// 작업 폴더(매뉴얼 리포): 내려받기, 동기화, 바뀐 파일, 제출
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { shell } from 'electron'
import { describeChanges } from '../lib/changes.ts'
import * as gitOps from '../lib/git.ts'
import { createPullRequest } from '../lib/github.ts'
import { resolveInside } from '../lib/sections.ts'
import { getSettings } from '../settings.ts'
import { currentUser, gitContext, handle, netFetch, ref, requireToken, requireWorkspace, send, workspaceState } from './context.ts'

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
  handle('workspace:revert', (paths) => gitOps.revert(requireWorkspace(), paths))
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
    return gitOps.submit(await gitContext(), {
      message: message.trim() || 'docs: 매뉴얼 수정',
      mode: settings.submitMode,
      login: me.login,
      createPullRequest: (input) => createPullRequest(netFetch, token, settings.repoUrl, input),
    })
  })
  handle('workspace:reveal', (relPath) => {
    const root = requireWorkspace()
    if (relPath) shell.showItemInFolder(resolveInside(root, relPath))
    else void shell.openPath(root)
  })
}
