// main ↔ renderer 계약. preload가 window.ariadne로 노출한다
import type { AffectedSection } from '../../src/core/affected.ts'
import type { CaptureReport } from '../../src/core/capture.ts'
import type { DocxAnalysis, ImportProgress } from '../../src/core/import.ts'
import type { ManualSettings, SectionMeta, Viewport } from '../../src/core/manual.ts'
import type { StgSessionInfo } from '../../src/core/session.ts'
import type { VideoProgress, VideoResult } from '../../src/core/video/index.ts'
import type { RecordEvent } from '../../src/core/video/record.ts'
import type { Scene, Step, Target, VideoScenario } from '../../src/core/video/scenario.ts'

export type { AffectedSection, CaptureReport, DocxAnalysis, ImportProgress, SectionMeta, Viewport }
export type { Scene as VideoScene, Step as VideoStep, Target as VideoTarget, VideoProgress, VideoScenario }

// manual.yaml에서 chapters를 뺀 매뉴얼 설정
export type ManualConfig = ManualSettings

export type SessionInfo = StgSessionInfo

export interface ManualInfo {
  id: string
  title: string
  version: string
  // 화면·이미지 수 (매뉴얼 목록, 삭제 확인)
  sections: number
  images: number
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
  // key: 도구 입력을 줄인 것 (같은 조회 반복을 알아보려고)
  | { kind: 'tool'; id: string; name: string; label: string; key?: string }
  | { kind: 'tool_result'; id: string; isError: boolean; text: string }
  | { kind: 'result'; ok: boolean; text: string; costUsd?: number; durationMs?: number; turns?: number; denials: string[] }

// manual-draft 스킬의 마지막 JSON 요약
export interface DraftSummary {
  // 만든(초안) 또는 고친(최신화) 화면
  sections: string[]
  // 최신화에서 바꿀 것이 없던 화면
  unchanged?: string[]
  // 최신화: 근거 기획서가 지난번 이후 바뀌지 않아 건너뛴 화면
  skipped?: string[]
  images?: string[]
  todos?: number
  sources?: { title: string; url?: string; version?: string }[]
  notes?: string
  // video: 쓴 영상 시나리오와 장면 수
  video?: string
  scenes?: number
}

export interface DraftInput {
  // create: 새 메뉴 초안, refresh: 기존 화면 최신화, shots: 기존 화면 이미지의 캡처 정의만 (본문·이미지는 그대로),
  // video: 가이드 영상 시나리오 초안, video-scene: 영상 장면 하나
  mode?: 'create' | 'refresh' | 'shots' | 'video' | 'video-scene'
  // 메뉴 이름. 예: Menu Management
  menu: string
  // 최신화(캡처 정의)할 화면 (<chapter dir>/<file>)
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
  // video-scene: 대상 장면(0부터)과, 그 장면을 채울지(false) 그 다음에 새 장면을 넣을지(true). 요청은 notes
  scene?: number
  insert?: boolean
  // 최신화: 기획서 버전이 같아도 다시 확인한다 (기본은 건너뜀)
  force?: boolean
  // 최신화: 반영 범위. 없으면 최신 기획서 전체
  scope?: RefreshScope
}

// 최신화 반영 범위: 기간(YYYY-MM)과 Jira 티켓. 둘 중 하나만 있어도 된다
export interface RefreshScope {
  from?: string
  to?: string
  tickets?: string[]
}

// 최신화는 화면마다 따로 돈다. target이 있으면 그 화면의 이벤트
export type ScreenStatus = 'waiting' | 'running' | 'done' | 'unchanged' | 'skipped' | 'failed' | 'cancelled'

export type DraftEvent =
  | { kind: 'status'; text: string; target?: string }
  | { kind: 'warning'; text: string; target?: string }
  | { kind: 'claude'; event: ClaudeEvent; target?: string }
  // 최신화: 기획서 요약 단계와 화면별 진행
  | { kind: 'phase'; phase: 'spec' | 'screens' | 'done'; text: string }
  | { kind: 'screen'; target: string; status: ScreenStatus; text?: string }
  // 기획자에게 묻기 (예: 기획서 요약 실패 → 요약 없이 계속할지). answered는 답을 받은 뒤
  | { kind: 'ask'; id: string; text: string }
  | { kind: 'answered'; id: string; proceed: boolean }

export interface ScreenResult {
  target: string
  status: ScreenStatus
  // 실패 이유, 건너뛴 이유
  text?: string
  todos?: number
  durationMs?: number
}

export interface DraftResult {
  // 작업한 매뉴얼 id (요약의 화면 경로는 manuals/<manual>/ 기준)
  manual: string
  // 최신화: 화면별 결과
  screens?: ScreenResult[]
  ok: boolean
  text: string
  summary?: DraftSummary
  costUsd?: number
  durationMs?: number
  denials: string[]
}

// claude.ai 로그인 상태 (claude auth status). method: claude.ai / api_key 등, account: 이메일 등 (있으면)
export interface ClaudeLoginStatus {
  loggedIn: boolean
  method?: string
  account?: string
  error?: string
}

export interface DraftCheck {
  // managed: 앱 전용으로 설치한 고정 버전. installable: 내 PC의 claude를 쓰는 중이고 경로를 직접 지정하지 않았다 (앱 전용 설치를 권한다)
  claude: { path: string; version: string; managed?: boolean; installable?: boolean } | null
  // 인증 방식과, apiKey일 때 키를 찾은 곳 (값은 담지 않는다)
  auth: { mode: 'apiKey' | 'login'; keySource: 'shell' | 'env' | null; login?: ClaudeLoginStatus }
  // detail: 연결 실패 이유
  atlassian: { name: string; connected: boolean; detail?: string }[]
  // claude mcp list 자체가 실패했을 때
  error?: string
  // Atlassian 연결을 마지막으로 확인한 때 (기억한 결과면 그때)
  atlassianCheckedAt?: number
  // 이 작업은 기획서를 안 써서 확인하지 않았다
  atlassianSkipped?: boolean
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
  // auto: 키가 있으면 apiKey, 없으면 claude.ai 로그인 (기본)
  claudeAuth: 'auto' | 'apiKey' | 'login'
  // 앱의 Claude 작업 모델 (--model). 기본 claude-sonnet-5-5[1m], 비우면 ~/.zshrc의 ANTHROPIC_MODEL
  claudeModel: string
  // 앱 Claude 작업의 생각량. 낮을수록 빠르고 싸다
  claudeEffort: ClaudeEffort
  // 오래 걸리는 작업이 끝나면 macOS 알림. background: 다른 앱을 보고 있을 때만
  notifyOnDone: 'background' | 'always' | 'off'
}

export type ClaudeEffort = 'low' | 'medium' | 'high'

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

export type EnvCheckId = 'token' | 'workspace' | 'pandoc' | 'chrome' | 'session' | 'claude' | 'ffmpeg' | 'voice'

export interface EnvCheck {
  id: EnvCheckId
  ok: boolean
  // 필수가 아니면 실패해도 앱을 쓸 수 있다 (예: 캡처 세션)
  required: boolean
  label: string
  detail: string
  link?: { label: string; url: string }
  // 앱이 대신 설치할 수 있는 도구
  install?: 'pandoc' | 'claude'
}

export interface InstallProgress {
  tool: 'pandoc' | 'claude'
  phase: 'release' | 'download' | 'extract'
  loaded?: number
  total?: number
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
  // Claude가 바꾼 곳을 아직 검토하지 않았다
  review?: boolean
}

export interface ReviewBase {
  // Claude가 고치기 직전 본문 (front-matter 제외)
  before: string
  at: number
}

// 전체·장 미리보기 (Word와 같은 내용: TODO 등 주석은 뺀다). issues: Word에 표기가 글자로 찍히는 곳
export type PreviewScope = 'section' | 'chapter' | 'all'
export interface PreviewChapter {
  dir: string
  no: number
  title: string
  sections: { path: string; title: string; html: string; issues: string[] }[]
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
  // manual-removed: 지운 매뉴얼 하나(그 아래 파일 전부)를 한 줄로 묶은 것. path는 manuals/<id>/
  kind: 'section' | 'image' | 'manual' | 'manual-removed' | 'other'
}

export interface SyncState {
  status: 'synced' | 'behind' | 'ahead' | 'diverged' | 'offline'
  // 로컬에 저장만 하고 제출하지 않은 변경 수 (기록만 한 것 포함)
  changes: number
  // "내 PC에 기록"만 하고 아직 제출하지 않은 기록 수
  recorded?: number
  message: string
  // 고친 것이 있는데도 다른 사람의 변경을 받아 작업 폴더에 합쳤다 (열린 화면을 다시 읽어야 한다)
  applied?: boolean
  // 같은 곳을 다른 사람도 고쳐 받아 오지 못한 파일 (제출할 때 합쳐 보고, 안 되면 PR)
  conflicts?: string[]
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

// 가져온 YAML 파일. 같은 id가 있으면 exists, 새로 넣을 때는 freeId로 저장한다
export interface VideoImport {
  id: string
  exists: boolean
  freeId: string
  scenario: VideoScenario
}

// 가이드 영상 목록 한 줄. 경로는 작업 폴더 기준
export interface VideoInfo {
  id: string
  title: string
  // 연결된 매뉴얼 화면, 영상에 나오는 순서
  sections: string[]
  mutates: boolean
  scenes: number
  // 만든 영상이 있으면
  // poster: 썸네일 (예전에 만든 영상은 없다)
  output?: { mp4: string; vtt: string; poster?: string; updatedAt: number; size: number }
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
  // 앱 안에서 받을 dmg (없으면 릴리스 페이지에서 직접 받는다)
  asset?: { url: string; name: string; size: number }
}

// 앱 안 업데이트 진행: 받기 → 준비(dmg에서 꺼내 확인) → ready(다시 시작하면 바뀜)
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'download'; loaded?: number; total?: number }
  | { phase: 'prepare' }
  | { phase: 'ready'; version: string }
  | { phase: 'error'; message: string }

export interface BuildResult {
  docx: string
  warnings: string
  // Word에 Markdown 표기(**, {.mark} 등)가 글자로 그대로 나오는 화면
  issues: { section: string; issues: string[] }[]
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
    // pandoc 또는 앱 전용 Claude Code를 받아 앱 폴더에 설치한다 (진행은 install-progress)
    install(tool: 'pandoc' | 'claude'): Promise<{ path: string; version: string }>
  }
  workspace: {
    state(): Promise<WorkspaceState>
    clone(): Promise<WorkspaceState>
    sync(): Promise<SyncState>
    changes(): Promise<FileChange[]>
    revert(paths: string[]): Promise<void>
    submit(message: string): Promise<SubmitResult>
    // 제출하지 않고 내 PC에만 기록(커밋)한다. 원격에 연결하지 않는다
    record(message: string): Promise<{ commit: string; recorded: number }>
    reveal(relPath?: string): Promise<void>
    // 마지막으로 제출된 상태의 내용과 지금 내용. 새 파일이면 before가 null
    diff(path: string): Promise<{ before: string | null; after: string | null }>
  }
  manual: {
    list(): Promise<ManualInfo[]>
    // 매뉴얼 하나를 통째로 지운다 (manuals/<id>/). 지금 열린 매뉴얼과 마지막 하나는 안 된다
    deleteManual(id: string): Promise<void>
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
    // word: Word와 같은 내용으로 (TODO 등 주석을 뺀다)
    render(path: string, body: string, options?: { word?: boolean }): Promise<string>
    // 매뉴얼 전체(또는 chapterDir 장)를 Word 순서대로
    manual(chapterDir?: string): Promise<PreviewChapter[]>
  }
  // Claude 변경 검토: 최신화가 고치기 직전 본문. 검토 완료·제출·되돌리기 때 지운다
  review: {
    get(path: string): Promise<ReviewBase | null>
    clear(path: string): Promise<void>
  }
  build: {
    docx(chapters?: number[]): Promise<BuildResult>
    open(path: string): Promise<void>
  }
  capture: {
    shots(): Promise<ShotInfo[]>
    session(): Promise<SessionInfo>
    login(): Promise<void>
    // STG를 화면 없이 열어 세션이 살아 있는지 확인한다. 만료됐으면 로그인 표식을 지운다
    checkSession(): Promise<SessionInfo & { valid: boolean }>
    // 지금 STG 로그인 프로필을 쓰는 작업 이름 (Claude 작업, 영상 만들기 등)
    tasks(): Promise<string[]>
    finishLogin(): Promise<void>
    cancelLogin(): Promise<void>
    run(ids: string[]): Promise<CaptureReport>
    adopt(ids: string[]): Promise<void>
  }
  video: {
    list(): Promise<VideoInfo[]>
    load(id: string): Promise<VideoScenario>
    save(scenario: VideoScenario): Promise<VideoScenario>
    create(input: { title: string; sections?: string[] }): Promise<VideoScenario>
    // YAML 파일을 골라 읽고 형식을 검사한다 (저장은 save로). 고르지 않으면 null
    importYaml(): Promise<VideoImport | null>
    // 시나리오를 고른 곳에 YAML 파일로 저장한다. 저장한 경로 (취소하면 null)
    exportYaml(id: string): Promise<string | null>
    remove(id: string): Promise<void>
    run(id: string, options?: VideoRunOptions): Promise<VideoRunResult>
    cancel(): Promise<void>
    // 한 문장 음성. path는 작업 폴더 기준 wav. speed가 없으면 manual.yaml video.tts.speed
    speak(text: string, speed?: number): Promise<{ path: string; ms: number }>
    model(): Promise<VideoModelStatus>
    downloadModel(): Promise<VideoModelStatus>
    // 고른 장면까지 재생한 뒤 기록을 시작한다. 단계는 'video-record' 이벤트로 온다
    record(id: string, scene: number): Promise<void>
    stopRecord(): Promise<void>
  }
  // claude.ai 로그인을 앱 안에서 (설정 → 고급, Claude 점검 화면). status가 null이면 Claude Code가 없다
  claudeLogin: {
    status(): Promise<ClaudeLoginStatus | null>
    // 브라우저 로그인을 시작하고 끝날 때까지 기다린다. 주소는 'claude-login-url' 이벤트로 온다
    start(): Promise<ClaudeLoginStatus>
    // 브라우저가 앱으로 돌아오지 못하고 코드를 보여 줄 때 붙여 넣은 코드
    sendCode(code: string): Promise<void>
    cancel(): Promise<void>
    logout(): Promise<ClaudeLoginStatus | null>
  }
  draft: {
    // confluence: 이 작업이 기획서를 쓰는지 (안 쓰면 Atlassian을 확인하지 않는다)
    check(options?: { refresh?: boolean; confluence?: boolean }): Promise<DraftCheck>
    start(input: DraftInput): Promise<DraftResult>
    cancel(): Promise<void>
    // ask 이벤트에 답한다 (proceed: 계속 / 중지)
    decide(id: string, proceed: boolean): Promise<void>
    // 진행 로그를 고른 곳에 파일로 저장한다. 저장한 경로 (취소하면 null)
    saveLog(fileName: string, text: string): Promise<string | null>
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
    // 새 버전을 받아 꺼내 둔다 (진행은 update-state). 끝나면 ready
    downloadUpdate(): Promise<UpdateState>
    // 앱을 끝내고 새 버전으로 바꿔 끼운 뒤 다시 연다. 돌고 있는 작업이 있으면 거절
    installUpdate(): Promise<void>
    updateState(): Promise<UpdateState>
    openExternal(url: string): Promise<void>
    testNotification(): Promise<void>
  }
  // main → renderer 이벤트. 해제 함수를 돌려준다
  on<E extends AriadneEvent>(event: E, listener: (payload: AriadneEvents[E]) => void): () => void
}

// main → renderer 이벤트와 내용
export interface AriadneEvents {
  'capture-progress': CaptureProgress
  'open-report': void
  'clone-progress': { phase: string; loaded: number; total?: number }
  'import-progress': ImportProgress
  'draft-event': DraftEvent
  // 지금 STG 로그인 프로필을 쓰는 작업 이름이 바뀔 때
  'stg-tasks': string[]
  'video-progress': VideoProgress
  'update-state': UpdateState
  'install-progress': InstallProgress
  'video-model-progress': VideoModelProgress
  'video-record': VideoRecordEvent
  'claude-login-url': string
}
export type AriadneEvent = keyof AriadneEvents

// renderer → main 요청. 채널 이름은 '<namespace>:<method>'이고 AriadneApi에서 만든다 (preload와 main이 손으로 맞추지 않는다)
export type AriadneMethods = Omit<AriadneApi, 'on'>
export type Namespace = keyof AriadneMethods
export type Channel = { [N in Namespace]: `${N}:${keyof AriadneMethods[N] & string}` }[Namespace]
export type ChannelMethod<C extends Channel> = C extends `${infer N extends Namespace}:${infer M}`
  ? M extends keyof AriadneMethods[N]
    ? AriadneMethods[N][M]
    : never
  : never
// main 핸들러. Promise가 아닌 값을 돌려줘도 된다
export type ChannelHandler<C extends Channel> = ChannelMethod<C> extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => R | Promise<R>
  : never

// preload가 이 목록으로 window.ariadne를 만든다. 빠진 메서드가 있으면 아래 검사에서 컴파일 오류
export const API_METHODS = {
  settings: ['get', 'update', 'pickDirectory'],
  auth: ['status', 'setToken', 'clearToken'],
  env: ['check', 'install'],
  workspace: ['state', 'clone', 'sync', 'changes', 'revert', 'submit', 'record', 'reveal', 'diff'],
  manual: [
    'list',
    'deleteManual',
    'config',
    'updateConfig',
    'pickDocx',
    'analyzeDocx',
    'importDocx',
    'tree',
    'read',
    'write',
    'create',
    'remove',
    'moveChapter',
    'moveSection',
    'todos',
    'images',
    'pickImageFile',
    'importImage',
    'suggestImageId',
  ],
  preview: ['render', 'manual'],
  review: ['get', 'clear'],
  build: ['docx', 'open'],
  capture: ['shots', 'session', 'login', 'checkSession', 'tasks', 'finishLogin', 'cancelLogin', 'run', 'adopt'],
  video: ['list', 'load', 'save', 'create', 'importYaml', 'exportYaml', 'remove', 'run', 'cancel', 'speak', 'model', 'downloadModel', 'record', 'stopRecord'],
  claudeLogin: ['status', 'start', 'sendCode', 'cancel', 'logout'],
  draft: ['check', 'start', 'cancel', 'decide', 'saveLog'],
  affected: ['run'],
  log: ['write', 'reveal'],
  report: ['preview', 'submit'],
  app: ['version', 'checkUpdate', 'downloadUpdate', 'installUpdate', 'updateState', 'openExternal', 'testNotification'],
} as const satisfies { [N in Namespace]: readonly (keyof AriadneMethods[N])[] }

type MissingMethods = { [N in Namespace]: `${N}:${Exclude<keyof AriadneMethods[N] & string, (typeof API_METHODS)[N][number]>}` }[Namespace]
// 빠진 메서드가 있으면 그 채널 이름이 오류에 나온다
const _allMethodsListed: [MissingMethods] extends [never] ? true : MissingMethods = true
void _allMethodsListed

export const channelOf = <N extends Namespace>(namespace: N, method: keyof AriadneMethods[N] & string) => `${namespace}:${method}` as Channel

// 리포 안 파일을 renderer에서 보여 줄 때 쓰는 custom protocol
export const ASSET_PROTOCOL = 'ariadne'
export function assetUrl(relPath: string, version?: number) {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/')
  return `${ASSET_PROTOCOL}://ws/${encoded}${version ? `?v=${version}` : ''}`
}
