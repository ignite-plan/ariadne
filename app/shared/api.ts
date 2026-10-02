// main ↔ renderer 계약. preload가 window.ariadne로 노출한다
import type { AffectedSection } from '../../src/core/affected.ts'
import type { CaptureReport } from '../../src/core/capture.ts'
import type { DocxAnalysis, ImportProgress } from '../../src/core/import.ts'
import type { Manual, SectionMeta, Viewport } from '../../src/core/manual.ts'
import type { VideoProgress, VideoResult } from '../../src/core/video/index.ts'
import type { RecordEvent } from '../../src/core/video/record.ts'
import type { Scene, Step, Target, VideoScenario } from '../../src/core/video/scenario.ts'

export type { AffectedSection, CaptureReport, DocxAnalysis, ImportProgress, SectionMeta, Viewport }
export type { Scene as VideoScene, Step as VideoStep, Target as VideoTarget, VideoProgress, VideoScenario }

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

// Claude Code stream-json을 화면용으로 바꾼 이벤트
export type ClaudeEvent =
  | { kind: 'init'; model?: string; mcp: { name: string; status: string }[] }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; id: string; name: string; label: string }
  | { kind: 'tool_result'; id: string; isError: boolean; text: string }
  | { kind: 'result'; ok: boolean; text: string; costUsd?: number; durationMs?: number; turns?: number; denials: string[] }

// manual-draft 스킬의 마지막 JSON 요약
export interface DraftSummary {
  // 만든(초안) 또는 고친(최신화) 화면
  sections: string[]
  // 최신화에서 바꿀 것이 없던 화면
  unchanged?: string[]
  images?: string[]
  todos?: number
  sources?: { title: string; url?: string; version?: string }[]
  notes?: string
  // video: 쓴 영상 시나리오와 장면 수
  video?: string
  scenes?: number
}

export interface DraftInput {
  // create: 새 메뉴 초안, refresh: 기존 화면 최신화, video: 가이드 영상 시나리오 초안
  mode?: 'create' | 'refresh' | 'video'
  // 메뉴 이름. 예: Menu Management
  menu: string
  // 최신화할 화면 (<chapter dir>/<file>)
  targets?: string[]
  // 기존 장에 넣거나, 새 장 이름과 위치(0부터)
  chapterDir?: string
  newChapterTitle?: string
  chapterIndex?: number
  // STG 경로 힌트. 예: /menu
  path?: string
  notes?: string
  // video: 채울 영상 시나리오 id (manuals/<m>/videos/<id>.yaml)
  video?: string
}

export type DraftEvent =
  | { kind: 'status'; text: string }
  | { kind: 'warning'; text: string }
  | { kind: 'claude'; event: ClaudeEvent }

export interface DraftResult {
  // 작업한 매뉴얼 id (요약의 화면 경로는 manuals/<manual>/ 기준)
  manual: string
  ok: boolean
  text: string
  summary?: DraftSummary
  costUsd?: number
  durationMs?: number
  denials: string[]
}

export interface DraftCheck {
  claude: { path: string; version: string } | null
  // 인증 방식과, apiKey일 때 키를 찾은 곳 (값은 담지 않는다)
  auth: { mode: 'apiKey' | 'login'; keySource: 'shell' | 'env' | null }
  atlassian: { name: string; connected: boolean }[]
  error?: string
}

export interface ReportInput {
  description: string
  // 오류 토스트의 [신고]로 열면 그 오류 문구
  error?: string
  includeLog: boolean
}

export interface ReportResult {
  // api: GitHub Issue를 만들었다, browser: 권한이 없어 브라우저의 새 Issue 화면을 열었다 (내용은 클립보드)
  via: 'api' | 'browser'
  url: string
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
  // 비어 있으면 로그인 셸과 흔한 설치 위치에서 찾는다
  claudePath: string
  // apiKey: ANTHROPIC_API_KEY 환경변수(로그인 셸 ~/.zshrc 포함), login: claude.ai 로그인
  claudeAuth: 'apiKey' | 'login'
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

export type EnvCheckId = 'token' | 'workspace' | 'pandoc' | 'chrome' | 'session' | 'claude' | 'atlassian' | 'ffmpeg' | 'voice'

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

// 가이드 영상 목록 한 줄. 경로는 작업 폴더 기준
export interface VideoInfo {
  id: string
  title: string
  section?: string
  mutates: boolean
  scenes: number
  // 만든 영상이 있으면
  output?: { mp4: string; vtt: string; updatedAt: number; size: number }
  // YAML 형식이 틀렸으면 그 내용
  error?: string
}

export interface VideoRunOptions {
  // 브라우저를 띄워 실행만 해 본다 (음성·녹화·파일 없음)
  preview?: boolean
  // 이 장면(0부터)부터
  fromScene?: number
  // false면 내레이션 없이 자막만
  tts?: boolean
}

// 실패해도 throw하지 않고 어느 장면·단계인지 돌려준다 (IPC는 Error의 필드를 전달하지 않는다)
export type VideoRunResult =
  | ({ ok: true } & VideoResult)
  | { ok: false; error: string; scene?: number | 'cleanup'; step?: number }

// STG에서 기록할 때 오는 이벤트. ready: 앞 단계 재생이 끝나 기록을 시작함
export type VideoRecordEvent = RecordEvent | { kind: 'ready' }

export interface VideoModelStatus {
  ready: boolean
  bytes: number
}

export interface VideoModelProgress {
  file: string
  index: number
  count: number
  loaded: number
  total?: number
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
  // 새 장을 넣을 위치 (0부터). 없으면 맨 뒤
  chapterIndex?: number
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
    // 마지막 제출(HEAD) 내용과 지금 내용. 새 파일이면 before가 null
    diff(path: string): Promise<{ before: string | null; after: string | null }>
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
    // 바뀐 장 폴더 [old, new]
    moveChapter(dir: string, toIndex: number): Promise<[string, string][]>
    moveSection(path: string, toIndex: number): Promise<string>
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
  video: {
    list(): Promise<VideoInfo[]>
    load(id: string): Promise<VideoScenario>
    save(scenario: VideoScenario): Promise<VideoScenario>
    create(input: { title: string; section?: string }): Promise<VideoScenario>
    remove(id: string): Promise<void>
    run(id: string, options?: VideoRunOptions): Promise<VideoRunResult>
    cancel(): Promise<void>
    // 한 문장 음성. path는 작업 폴더 기준 wav
    speak(text: string): Promise<{ path: string; ms: number }>
    model(): Promise<VideoModelStatus>
    downloadModel(): Promise<VideoModelStatus>
    // 고른 장면까지 재생한 뒤 기록을 시작한다. 단계는 'video-record' 이벤트로 온다
    record(id: string, scene: number): Promise<void>
    stopRecord(): Promise<void>
  }
  draft: {
    check(refresh?: boolean): Promise<DraftCheck>
    start(input: DraftInput): Promise<DraftResult>
    cancel(): Promise<void>
  }
  affected: {
    run(base: string, head: string): Promise<{ range: string; affected: AffectedSection[] }>
  }
  log: {
    write(level: 'info' | 'warn' | 'error', source: string, message: string): Promise<void>
    reveal(): Promise<void>
  }
  report: {
    preview(input: ReportInput): Promise<{ title: string; body: string }>
    submit(input: ReportInput): Promise<ReportResult>
  }
  app: {
    version(): Promise<string>
    checkUpdate(): Promise<UpdateInfo | null>
    openExternal(url: string): Promise<void>
  }
  on(event: 'capture-progress', listener: (progress: CaptureProgress) => void): () => void
  on(event: 'open-report', listener: () => void): () => void
  on(event: 'clone-progress', listener: (progress: { phase: string; loaded: number; total?: number }) => void): () => void
  on(event: 'import-progress', listener: (progress: ImportProgress) => void): () => void
  on(event: 'draft-event', listener: (event: DraftEvent) => void): () => void
  on(event: 'video-progress', listener: (progress: VideoProgress) => void): () => void
  on(event: 'video-model-progress', listener: (progress: VideoModelProgress) => void): () => void
  on(event: 'video-record', listener: (event: VideoRecordEvent) => void): () => void
}

// 리포 안 파일을 renderer에서 보여 줄 때 쓰는 custom protocol
export const ASSET_PROTOCOL = 'ariadne'
export function assetUrl(relPath: string, version?: number) {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/')
  return `${ASSET_PROTOCOL}://ws/${encoded}${version ? `?v=${version}` : ''}`
}
