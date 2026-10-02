import { useEffect, useState } from 'react'
import type { AffectedSection, AuthStatus, EnvCheck, ManualConfig, ManualInfo, Settings, UpdateInfo } from '../../../shared/api.ts'
import { CODE_PRESETS, VIEWPORTS, viewportKey, type ViewportKey } from '../../../shared/presets.ts'
import { api, errorMessage } from '../api.ts'
import { EnvList } from './EnvList.tsx'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'

type Tab = 'general' | 'manual' | 'account' | 'env' | 'advanced' | 'affected' | 'about'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: '일반' },
  { id: 'manual', label: '매뉴얼' },
  { id: 'account', label: '계정' },
  { id: 'env', label: '환경 점검' },
  { id: 'advanced', label: '고급' },
  { id: 'affected', label: '변경 영향' },
  { id: 'about', label: '정보' },
]

export function SettingsDialog({
  initialTab = 'general',
  onSettings,
  onOpenSection,
  onReset,
  onClose,
}: {
  initialTab?: Tab
  onSettings: (settings: Settings) => void
  onOpenSection: (path: string) => void
  onReset: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [settings, setSettings] = useState<Settings>()
  const [manuals, setManuals] = useState<ManualInfo[]>([])

  useEffect(() => {
    void api.settings.get().then(setSettings)
    void api.manual.list().then(setManuals, () => setManuals([]))
  }, [])

  const update = async (patch: Partial<Settings>) => {
    try {
      const next = await api.settings.update(patch)
      setSettings(next)
      onSettings(next)
    } catch (e) {
      toast.error(e)
    }
  }

  if (!settings) return null

  return (
    <Modal title="설정" onClose={onClose} width={760}>
      <div className="settings">
        <nav className="settings-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="settings-pane">
          {tab === 'general' && (
            <>
              <label className="field">
                <span>매뉴얼</span>
                <select value={settings.manual} onChange={(e) => update({ manual: e.target.value })}>
                  {(manuals.length ? manuals : [{ id: settings.manual, title: settings.manual, version: '' }]).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.id})
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="radio-cards">
                <legend>제출 방식</legend>
                <label className={settings.submitMode === 'push' ? 'active' : ''}>
                  <input type="radio" checked={settings.submitMode === 'push'} onChange={() => update({ submitMode: 'push' })} />
                  <div>
                    <b>바로 반영</b>
                    <span>main에 바로 올립니다. 충돌이 나면 자동으로 PR을 만듭니다</span>
                  </div>
                </label>
                <label className={settings.submitMode === 'pr' ? 'active' : ''}>
                  <input type="radio" checked={settings.submitMode === 'pr'} onChange={() => update({ submitMode: 'pr' })} />
                  <div>
                    <b>검토 후 반영 (PR)</b>
                    <span>브랜치와 PR을 만들고 개발자가 merge합니다</span>
                  </div>
                </label>
              </fieldset>
            </>
          )}
          {tab === 'manual' && <ManualPane />}
          {tab === 'account' && <AccountPane onReset={onReset} />}
          {tab === 'env' && <EnvPane />}
          {tab === 'advanced' && (
            <>
              <TextSetting label="매뉴얼 리포 (GitHub)" value={settings.repoUrl} onSave={(repoUrl) => update({ repoUrl })} />
              <TextSetting label="브랜치" value={settings.branch} onSave={(branch) => update({ branch })} />
              <div className="field">
                <span>작업 폴더</span>
                <div className="path-row">
                  <code className="path">{settings.workspaceDir}</code>
                  <button className="button small" onClick={() => api.workspace.reveal()}>
                    Finder
                  </button>
                  <button
                    className="button small"
                    onClick={async () => {
                      const dir = await api.settings.pickDirectory('작업 폴더 (빈 폴더 또는 기존 리포)')
                      if (dir) {
                        await update({ workspaceDir: dir })
                        onReset()
                      }
                    }}
                  >
                    바꾸기
                  </button>
                </div>
              </div>
              <TextSetting
                label="pandoc 경로 (비우면 자동으로 찾음)"
                value={settings.pandocPath}
                placeholder="/opt/homebrew/bin/pandoc"
                onSave={(pandocPath) => update({ pandocPath })}
              />
              <DirSetting
                label="dealerhub-web 경로 (개발자용, 변경 영향 분석)"
                value={settings.dealerhubWebDir}
                onPick={(dealerhubWebDir) => update({ dealerhubWebDir })}
              />
            </>
          )}
          {tab === 'affected' && <AffectedPane settings={settings} onOpenSection={onOpenSection} onGoAdvanced={() => setTab('advanced')} />}
          {tab === 'about' && <AboutPane />}
        </div>
      </div>
    </Modal>
  )
}

function TextSetting({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string
  value: string
  placeholder?: string
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className="field">
      <span>{label}</span>
      <div className="inline-input">
        <input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
        <button className="button small" disabled={draft === value} onClick={() => onSave(draft.trim())}>
          저장
        </button>
      </div>
    </label>
  )
}

function DirSetting({ label, value, onPick }: { label: string; value: string; onPick: (dir: string) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="path-row">
        <code className="path">{value || '지정 안 함'}</code>
        <button
          className="button small"
          onClick={async () => {
            const dir = await api.settings.pickDirectory(label)
            if (dir) onPick(dir)
          }}
        >
          고르기
        </button>
        {value && (
          <button className="button small" onClick={() => onPick('')}>
            지우기
          </button>
        )}
      </div>
    </div>
  )
}

// 지금 매뉴얼의 manual.yaml 설정. 바꾸면 변경 탭에 manual.yaml이 나오고 제출로 공유된다
function ManualPane() {
  const toast = useToast()
  const [config, setConfig] = useState<ManualConfig>()

  useEffect(() => {
    void api.manual.config().then(setConfig)
  }, [])

  const save = async (patch: Partial<ManualConfig>) => {
    try {
      setConfig(await api.manual.updateConfig(patch))
      toast.show('success', '매뉴얼 설정을 저장했습니다. 제출하면 다른 사람에게도 반영됩니다')
    } catch (e) {
      toast.error(e)
    }
  }

  if (!config) return <p className="muted">불러오는 중…</p>
  const capture = config.capture ?? {}
  const vp = viewportKey(capture.viewport)

  return (
    <>
      <p className="hint first">이 매뉴얼의 공용 설정(manual.yaml)입니다. 바꾸면 제출해야 다른 사람에게 반영됩니다.</p>
      <TextSetting label="매뉴얼 제목" value={config.title} onSave={(title) => save({ title })} />
      <TextSetting label="버전" value={config.version} onSave={(version) => save({ version })} />
      <TextSetting
        label="Word 파일 이름 ({version}은 버전으로 바뀜)"
        value={config.output ?? ''}
        placeholder={`${config.title}_v{version}`}
        onSave={(output) => save({ output })}
      />
      <TextSetting
        label="캡처 주소 (STG)"
        value={capture.baseUrl ?? ''}
        placeholder="https://stg-…"
        onSave={(baseUrl) => save({ capture: { ...capture, baseUrl: baseUrl || undefined } })}
      />
      <div className="field">
        <span>캡처 화면 크기</span>
        <div className="segmented small">
          {(Object.keys(VIEWPORTS) as ViewportKey[]).map((k) => (
            <button
              key={k}
              className={vp === k ? 'active' : ''}
              onClick={() =>
                save({ capture: { ...capture, viewport: { width: VIEWPORTS[k].width, height: VIEWPORTS[k].height } } })
              }
            >
              {VIEWPORTS[k].label}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>화면(코드) 연결 · 변경 영향 분석에 씁니다</span>
        <select
          value={config.code?.app ?? ''}
          onChange={(e) => save({ code: e.target.value ? { ...config.code, app: e.target.value } : undefined })}
        >
          {CODE_PRESETS.map((p) => (
            <option key={p.app} value={p.app}>
              {p.label}
            </option>
          ))}
          <option value="">연결 안 함</option>
        </select>
      </label>
    </>
  )
}

function AccountPane({ onReset }: { onReset: () => void }) {
  const toast = useToast()
  const [auth, setAuth] = useState<AuthStatus>()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.auth.status().then(setAuth)
  }, [])

  const replace = async () => {
    setBusy(true)
    try {
      setAuth(await api.auth.setToken(token))
      setToken('')
      toast.show('success', '토큰을 바꿨습니다')
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {auth?.user && (
        <div className="account">
          <img src={auth.user.avatarUrl} alt="" />
          <div>
            <b>{auth.user.name ?? auth.user.login}</b>
            <span className="muted">@{auth.user.login}</span>
          </div>
        </div>
      )}
      {auth?.error && <p className="form-error">{auth.error}</p>}
      <label className="field">
        <span>새 토큰으로 바꾸기</span>
        <div className="inline-input">
          <input type="password" value={token} placeholder="github_pat_…" onChange={(e) => setToken(e.target.value)} />
          <button className="button small primary" disabled={!token || busy} onClick={replace}>
            바꾸기
          </button>
        </div>
      </label>
      <button
        className="button danger small"
        onClick={async () => {
          await api.auth.clearToken()
          onReset()
        }}
      >
        로그아웃 (토큰 지우기)
      </button>
    </>
  )
}

function EnvPane() {
  const [checks, setChecks] = useState<EnvCheck[]>()
  const run = async () => {
    setChecks(undefined)
    setChecks(await api.env.check())
  }
  useEffect(() => {
    void run()
  }, [])
  return (
    <>
      <EnvList checks={checks} />
      <button className="button small" onClick={run}>
        <Icon name="sync" size={14} /> 다시 점검
      </button>
    </>
  )
}

function AffectedPane({
  settings,
  onOpenSection,
  onGoAdvanced,
}: {
  settings: Settings
  onOpenSection: (path: string) => void
  onGoAdvanced: () => void
}) {
  const [base, setBase] = useState('')
  const [head, setHead] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ range: string; affected: AffectedSection[] }>()

  if (!settings.dealerhubWebDir) {
    return (
      <div className="empty-state small">
        <p>dealerhub-web 두 릴리즈 사이 변경이 어떤 매뉴얼 화면에 영향을 주는지 찾습니다.</p>
        <button className="button small" onClick={onGoAdvanced}>
          dealerhub-web 경로 지정하기
        </button>
      </div>
    )
  }

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      setResult(await api.affected.run(base.trim(), head.trim()))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="affected-form">
        <label className="field">
          <span>이전 릴리즈 (base)</span>
          <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="origin/release/2609-regular" />
        </label>
        <label className="field">
          <span>이번 릴리즈 (head)</span>
          <input value={head} onChange={(e) => setHead(e.target.value)} placeholder="HEAD" />
        </label>
        <button className="button primary" disabled={!base || busy} onClick={run}>
          {busy ? '분석 중…' : '분석'}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {result && (
        <div className="affected-result">
          <p className="muted">
            {result.range} · 영향 화면 {result.affected.length}개
          </p>
          {result.affected.map((a) => (
            <article key={a.section} className="affected-item">
              <button className="link" onClick={() => onOpenSection(a.section)}>
                {a.title ?? a.section}
              </button>
              {a.files.length > 0 && (
                <details>
                  <summary>코드 {a.files.length}개</summary>
                  <ul>
                    {a.files.map((f) => (
                      <li key={f}>
                        <code>{f}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {a.keys.length > 0 && (
                <details>
                  <summary>라벨(en.json) {a.keys.length}개</summary>
                  <ul>
                    {a.keys.map((k) => (
                      <li key={k}>
                        <code>{k}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function AboutPane() {
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateInfo | null | undefined>()
  useEffect(() => {
    void api.app.version().then(setVersion)
    void api.app.checkUpdate().then(setUpdate)
  }, [])
  return (
    <div className="about">
      <div className="brand large">
        <span className="brand-mark" />
        Ariadne
      </div>
      <p className="muted">버전 {version}</p>
      <p>미궁(BO) 속에서 길을 잃지 않게 건네는 실. Dealers 사용자 매뉴얼 편집기입니다.</p>
      {update === undefined && <p className="muted">새 버전 확인 중…</p>}
      {update === null && <p className="muted">최신 버전입니다.</p>}
      {update && (
        <button className="button primary small" onClick={() => api.app.openExternal(update.url)}>
          새 버전 {update.latest} 받기 <Icon name="external" size={13} />
        </button>
      )}
    </div>
  )
}
