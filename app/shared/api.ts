// main ↔ renderer 계약. preload가 window.ariadne로 노출한다
import type { AffectedSection } from '../../src/core/affected.ts'
import type { CaptureReport } from '../../src/core/capture.ts'
import type { DocxAnalysis, ImportProgress } from '../../src/core/import.ts'
import type { Manual, SectionMeta, Viewport } from '../../src/core/manual.ts'

export type { AffectedSection, CaptureReport, DocxAnalysis, ImportProgress, SectionMeta, Viewport }

// manual.yaml에서 chapters를 뺀 매뉴얼 설정
export type ManualConfig = Omit<Manual, 'chapters'>

export interface ManualInfo {
  id: string
  title: string
  version: string
}

export interface ImportInput {
  docx: string
  // 새 매뉴얼 id (manuals/<id>)
  id: string
  title: string
  version: string
  output: string
  capture: { baseUrl: string; viewport: Viewport }
  code?: { app: string }
  keepSource: boolean
}

export interface Settings {
  // 매뉴얼 리포 (clone/push 대상)
  repoUrl: string
  branch: string
  // 로컬 clone 위치
  workspaceDir: string
  manual: string
  // 비어 있으면 /opt/homebrew/bin, /usr/local/bin에서 찾는다
  pandocPath: string
  // 개발자용. dealerhub-web 로컬 경로, 비어 있으면 변경 영향 메뉴를 숨긴다
  dealerhubWebDir: string
  // push: main에 바로 반영, pr: 브랜치 + PR
  submitMode: 'push' | 'pr'
}

export interface GithubUser {
  login: string
  name: string | null
  id: number
  avatarUrl: string
}

export interface AuthStatus {
  hasToken: boolean
  user?: GithubUser
  error?: string
}

export type EnvCheckId = 'token' | 'workspace' | 'pandoc' | 'chrome' | 'session'

export interface EnvCheck {
  id: EnvCheckId
  ok: boolean
  // 필수가 아니면 실패해도 앱을 쓸 수 있다 (예: 캡처 세션)
  required: boolean
  label: string
  detail: string
  link?: { label: string; url: string }
}

export interface WorkspaceState {
  dir: string
  cloned: boolean
}

export interface SectionNode {
  path: string
  title: string
  todos: number
  modified: boolean
}

export interface ChapterNode {
  no: number
  dir: string
  title: string
  sections: SectionNode[]
}

export interface ManualTree {
  manual: string
  title: string
  version: string
  chapters: ChapterNode[]
}

export interface SectionDoc {
  path: string
  meta: SectionMeta
  body: string
}

export interface Todo {
  path: string
  sectionTitle: string
  line: number
  text: string
}

export interface ImageInfo {
  id: string
  bytes: number
  mtime: number
}

export type ChangeStatus = 'added' | 'modified' | 'deleted'

export interface FileChange {
  path: string
  status: ChangeStatus
  // manuals/<m>/ 아래 섹션이면 제목, 이미지면 이미지 id
  label: string
  kind: 'section' | 'image' | 'manual' | 'other'
}

export interface SyncState {
  status: 'synced' | 'behind' | 'ahead' | 'diverged' | 'offline'
  // 로컬에 저장만 하고 제출하지 않은 변경 수
  changes: number
  message: string
}

export interface SubmitResult {
  mode: 'push' | 'pr'
  commit: string
  url?: string
  // 다른 사람 변경과 충돌해 PR로 돌렸다
  conflict?: boolean
}

export interface ShotInfo {
  id: string
  path: string
  manual: boolean
  exists: boolean
  sections: string[]
}

export interface CaptureProgress {
  id: string
  index: number
  total: number
}

export interface SessionInfo {
  exists: boolean
  savedAt?: number
}

export interface UpdateInfo {
  current: string
  latest: string
  url: string
}

export interface BuildResult {
  docx: string
  warnings: string
}

export interface NewSectionInput {
  title: string
  // 기존 장에 추가. 없으면 newChapterTitle로 새 장을 만든다
  chapterDir?: string
  newChapterTitle?: string
}

export interface ImportImageInput {
  id: string
  // 파일 경로 또는 붙여넣기/드롭한 이미지 바이트
  sourcePath?: string
  data?: Uint8Array
}

export interface AriadneApi {
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
    pickDirectory(title: string): Promise<string | null>
  }
  auth: {
    status(): Promise<AuthStatus>
    setToken(token: string): Promise<AuthStatus>
    clearToken(): Promise<void>
  }
  env: {
    check(): Promise<EnvCheck[]>
  }
  workspace: {
    state(): Promise<WorkspaceState>
    clone(): Promise<WorkspaceState>
    sync(): Promise<SyncState>
    changes(): Promise<FileChange[]>
    revert(paths: string[]): Promise<void>
    submit(message: string): Promise<SubmitResult>
    reveal(relPath?: string): Promise<void>
  }
  manual: {
    list(): Promise<ManualInfo[]>
    config(): Promise<ManualConfig>
    updateConfig(patch: Partial<ManualConfig>): Promise<ManualConfig>
    pickDocx(): Promise<string | null>
    analyzeDocx(path: string): Promise<DocxAnalysis>
    importDocx(input: ImportInput): Promise<string>
    tree(): Promise<ManualTree>
    read(path: string): Promise<SectionDoc>
    write(path: string, body: string, meta?: SectionMeta): Promise<void>
    create(input: NewSectionInput): Promise<string>
    remove(path: string): Promise<void>
    todos(): Promise<Todo[]>
    images(): Promise<ImageInfo[]>
    pickImageFile(): Promise<string | null>
    importImage(input: ImportImageInput): Promise<string>
    suggestImageId(caption: string): Promise<string>
  }
  preview: {
    render(path: string, body: string): Promise<string>
  }
  build: {
    docx(chapters?: number[]): Promise<BuildResult>
    open(path: string): Promise<void>
  }
  capture: {
    shots(): Promise<ShotInfo[]>
    session(): Promise<SessionInfo>
    login(): Promise<void>
    finishLogin(): Promise<void>
    cancelLogin(): Promise<void>
    run(ids: string[]): Promise<CaptureReport>
    adopt(ids: string[]): Promise<void>
  }
  affected: {
    run(base: string, head: string): Promise<{ range: string; affected: AffectedSection[] }>
  }
  app: {
    version(): Promise<string>
    checkUpdate(): Promise<UpdateInfo | null>
    openExternal(url: string): Promise<void>
  }
  on(event: 'capture-progress', listener: (progress: CaptureProgress) => void): () => void
  on(event: 'clone-progress', listener: (progress: { phase: string; loaded: number; total?: number }) => void): () => void
  on(event: 'import-progress', listener: (progress: ImportProgress) => void): () => void
}

// 리포 안 파일을 renderer에서 보여 줄 때 쓰는 custom protocol
export const ASSET_PROTOCOL = 'ariadne'
export function assetUrl(relPath: string, version?: number) {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/')
  return `${ASSET_PROTOCOL}://ws/${encoded}${version ? `?v=${version}` : ''}`
}
