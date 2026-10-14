// 환경 점검 화면의 항목과 문구. 찾은 결과를 받아 판정만 한다. Electron에 의존하지 않는다 (단위 테스트 대상)
import type { AuthStatus, EnvCheck, WorkspaceState } from '../../shared/api.ts'
import { formatAge } from '../../shared/format.ts'

export interface EnvFacts {
  auth: AuthStatus
  workspace: WorkspaceState
  pandoc: { path: string; version: string } | null
  // 앱이 도구를 설치하는 폴더 (pandoc이 여기 있으면 '앱이 설치함')
  toolsDir: string
  chrome: string | null
  claude: { version: string; managed: boolean } | null
  // Claude Code 경로를 직접 지정했는지 (설정 또는 E2E의 가짜 claude). 그러면 앱 전용 설치를 권하지 않는다
  claudeOverride: boolean
  claudeVersion: string
  ffmpeg: { path: string; bundled: boolean } | null
  voice: { ready: boolean; bytes: number }
  session: { exists: boolean; savedAt?: number }
  now: number
}

export function envChecks(f: EnvFacts): EnvCheck[] {
  const { auth, workspace, pandoc, chrome, claude, ffmpeg, voice, session } = f
  const managed = claude?.managed
  return [
    {
      id: 'token',
      ok: Boolean(auth.user),
      required: true,
      label: 'GitHub 토큰',
      detail: auth.user ? `${auth.user.name ?? auth.user.login} (@${auth.user.login})` : (auth.error ?? '설정에서 GitHub 토큰을 입력하세요'),
    },
    {
      id: 'workspace',
      ok: workspace.cloned,
      required: true,
      label: '매뉴얼 리포',
      detail: workspace.cloned ? workspace.dir : '아직 내려받지 않았습니다',
    },
    {
      id: 'pandoc',
      ok: Boolean(pandoc),
      required: true,
      label: 'pandoc (미리보기, Word 만들기)',
      detail: pandoc
        ? `${pandoc.version} · ${pandoc.path.startsWith(f.toolsDir) ? '앱이 설치함' : pandoc.path}`
        : '설치되어 있지 않습니다. 앱이 받아 설치할 수 있습니다 (약 40MB)',
      install: pandoc ? undefined : 'pandoc',
    },
    {
      id: 'chrome',
      ok: Boolean(chrome),
      required: false,
      label: 'Google Chrome (화면 캡처)',
      detail: chrome ?? '설치되어 있지 않습니다. 캡처를 쓰지 않으면 없어도 됩니다',
      link: chrome ? undefined : { label: 'Chrome 받기', url: 'https://www.google.com/chrome/' },
    },
    {
      id: 'claude',
      ok: Boolean(managed || (claude && f.claudeOverride)),
      required: false,
      label: `Claude Code ${f.claudeVersion} (Claude로 초안·최신화·영상)`,
      detail: managed
        ? `${claude!.version} · 앱 전용`
        : claude
          ? `내 PC의 ${claude.version}을 쓰는 중입니다. 사람마다 같은 버전으로 돌리려면 앱 전용으로 설치하세요 (약 220MB)`
          : '없습니다. 앱 전용으로 설치할 수 있습니다 (약 220MB). Claude 기능을 쓰지 않으면 없어도 됩니다',
      install: managed || f.claudeOverride ? undefined : 'claude',
    },
    {
      id: 'ffmpeg',
      ok: Boolean(ffmpeg),
      required: false,
      label: 'ffmpeg (가이드 영상)',
      detail: ffmpeg ? (ffmpeg.bundled ? '앱에 들어 있음' : ffmpeg.path) : '찾지 못했습니다. 가이드 영상을 쓰지 않으면 없어도 됩니다',
    },
    {
      id: 'voice',
      ok: voice.ready,
      required: false,
      label: '음성 모델 (가이드 영상 내레이션)',
      detail: voice.ready
        ? `Kokoro · ${Math.round(voice.bytes / 1e6)}MB`
        : '가이드 영상 화면에서 처음 만들 때 받습니다 (약 90MB). 자막만 쓰면 없어도 됩니다',
    },
    {
      id: 'session',
      ok: session.exists,
      required: false,
      label: '로그인 세션 (화면 캡처·가이드 영상)',
      detail: session.exists
        ? `${formatAge(f.now - session.savedAt!)} 로그인. 만료되면 캡처·영상 화면에서 다시 로그인하세요`
        : '캡처하거나 영상을 만들 때 로그인합니다',
    },
  ]
}
