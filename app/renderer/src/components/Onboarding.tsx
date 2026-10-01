import { useEffect, useState } from 'react'
import type { AuthStatus, EnvCheck, Settings, WorkspaceState } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { EnvList } from './EnvList.tsx'
import { Icon } from './Icon.tsx'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

type Step = 'token' | 'workspace' | 'env'

export function Onboarding({
  initial,
  onDone,
}: {
  initial: { settings: Settings; auth: AuthStatus; workspace: WorkspaceState }
  onDone: () => void
}) {
  const [settings, setSettings] = useState(initial.settings)
  const [auth, setAuth] = useState(initial.auth)
  const [workspace, setWorkspace] = useState(initial.workspace)
  const [step, setStep] = useState<Step>(!initial.auth.hasToken || initial.auth.error ? 'token' : 'workspace')

  return (
    <div className="onboarding">
      <aside className="onboarding-side">
        <div className="brand">
          <span className="brand-mark" />
          Ariadne
        </div>
        <p className="onboarding-lead">
          Dealers 사용자 매뉴얼을 고치고, 화면을 캡처하고, Word로 만드는 앱입니다. 처음 한 번만 설정하면 됩니다.
        </p>
        <ol className="steps">
          <li className={step === 'token' ? 'active' : auth.user ? 'done' : ''}>GitHub 연결</li>
          <li className={step === 'workspace' ? 'active' : workspace.cloned ? 'done' : ''}>매뉴얼 내려받기</li>
          <li className={step === 'env' ? 'active' : ''}>환경 점검</li>
        </ol>
      </aside>
      <main className="onboarding-main">
        {step === 'token' && (
          <TokenStep
            settings={settings}
            onSettings={setSettings}
            onDone={(next) => {
              setAuth(next)
              setStep(workspace.cloned ? 'env' : 'workspace')
            }}
          />
        )}
        {step === 'workspace' && (
          <WorkspaceStep
            settings={settings}
            onSettings={setSettings}
            onBack={() => setStep('token')}
            onDone={(next) => {
              setWorkspace(next)
              setStep('env')
            }}
          />
        )}
        {step === 'env' && <EnvStep onDone={onDone} />}
      </main>
    </div>
  )
}

function TokenStep({
  settings,
  onSettings,
  onDone,
}: {
  settings: Settings
  onSettings: (s: Settings) => void
  onDone: (auth: AuthStatus) => void
}) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [repoUrl, setRepoUrl] = useState(settings.repoUrl)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      if (repoUrl !== settings.repoUrl) onSettings(await api.settings.update({ repoUrl }))
      onDone(await api.auth.setToken(token))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="onboarding-card">
      <h1>GitHub 연결</h1>
      <p>
        매뉴얼은 GitHub에 있습니다. 내 GitHub 계정으로 만든 <b>토큰</b>을 넣으면 앱이 대신 내려받고 올립니다.
      </p>
      <ol className="howto">
        <li>
          <button className="link" onClick={() => api.app.openExternal(TOKEN_URL)}>
            토큰 만들기 페이지 열기 <Icon name="external" size={13} />
          </button>
        </li>
        <li>
          <b>Resource owner</b>: <code>{safeOwner(repoUrl)}</code>, <b>Repository access</b>: Only select repositories →{' '}
          <code>{safeRepo(repoUrl)}</code>
        </li>
        <li>
          <b>Permissions</b>: <code>Contents</code> Read and write, <code>Pull requests</code> Read and write
        </li>
        <li>
          <b>Generate token</b>을 누르고 <code>github_pat_</code>로 시작하는 값을 복사해 아래에 붙여 넣습니다
        </li>
      </ol>
      <label className="field">
        <span>토큰</span>
        <input
          type="password"
          value={token}
          placeholder="github_pat_…"
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && token && !busy && submit()}
          autoFocus
        />
      </label>
      <details className="advanced">
        <summary>리포 주소 바꾸기</summary>
        <label className="field">
          <span>매뉴얼 리포</span>
          <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
        </label>
      </details>
      {error && <p className="form-error">{error}</p>}
      <div className="actions">
        <button className="button primary" disabled={!token || busy} onClick={submit}>
          {busy ? '확인 중…' : '연결'}
        </button>
      </div>
      <p className="hint">
        토큰은 macOS 키체인으로 암호화해 이 Mac에만 저장합니다. 만료되면 설정에서 다시 넣으세요. 조직이 fine-grained
        토큰을 막아 두었으면 classic 토큰(<code>repo</code> 권한)도 됩니다.
      </p>
    </section>
  )
}

function safeOwner(url: string) {
  return url.match(/github\.com\/([^/]+)/)?.[1] ?? '?'
}
function safeRepo(url: string) {
  return url.match(/github\.com\/[^/]+\/([^/.]+)/)?.[1] ?? '?'
}

function WorkspaceStep({
  settings,
  onSettings,
  onBack,
  onDone,
}: {
  settings: Settings
  onSettings: (s: Settings) => void
  onBack: () => void
  onDone: (ws: WorkspaceState) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ phase: string; loaded: number; total?: number }>()

  useEffect(() => api.on('clone-progress', setProgress), [])

  const pick = async () => {
    const dir = await api.settings.pickDirectory('매뉴얼을 둘 폴더 (빈 폴더 또는 기존 리포)')
    if (dir) onSettings(await api.settings.update({ workspaceDir: dir }))
  }

  const clone = async () => {
    setBusy(true)
    setError('')
    try {
      onDone(await api.workspace.clone())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      setProgress(undefined)
    }
  }

  const percent = progress?.total ? Math.round((progress.loaded / progress.total) * 100) : undefined

  return (
    <section className="onboarding-card">
      <h1>매뉴얼 내려받기</h1>
      <p>매뉴얼 원본(문서, 이미지)을 이 Mac의 폴더로 내려받습니다. 약 40MB입니다.</p>
      <div className="path-row">
        <Icon name="folder" />
        <code className="path">{settings.workspaceDir}</code>
        <button className="button small" onClick={pick} disabled={busy}>
          폴더 바꾸기
        </button>
      </div>
      <p className="hint">이미 내려받은 리포 폴더를 고르면 그 폴더를 그대로 씁니다.</p>
      {busy && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${percent ?? 15}%` }} data-indeterminate={percent === undefined} />
          <span>
            {progress?.phase ?? '연결 중'} {percent !== undefined ? `${percent}%` : ''}
          </span>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="actions">
        <button className="button" onClick={onBack} disabled={busy}>
          이전
        </button>
        <button className="button primary" onClick={clone} disabled={busy}>
          {busy ? '내려받는 중…' : '내려받기'}
        </button>
      </div>
    </section>
  )
}

function EnvStep({ onDone }: { onDone: () => void }) {
  const [checks, setChecks] = useState<EnvCheck[]>()
  const run = async () => {
    setChecks(undefined)
    setChecks(await api.env.check())
  }
  useEffect(() => {
    void run()
  }, [])
  const blocking = checks?.filter((c) => c.required && !c.ok) ?? []

  return (
    <section className="onboarding-card">
      <h1>환경 점검</h1>
      <p>미리보기와 Word 만들기에는 pandoc이, 화면 캡처에는 Chrome이 필요합니다.</p>
      <EnvList checks={checks} />
      <div className="actions">
        <button className="button" onClick={run}>
          <Icon name="sync" /> 다시 점검
        </button>
        <button className="button primary" onClick={onDone} disabled={!checks}>
          {blocking.length ? '일단 시작하기' : '시작하기'}
        </button>
      </div>
      {blocking.length > 0 && (
        <p className="hint">
          {blocking.map((c) => c.label).join(', ')} 없이도 문서 편집은 됩니다. 설치 후 설정 → 환경 점검에서 다시 확인하세요.
        </p>
      )}
    </section>
  )
}
