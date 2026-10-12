import { useEffect, useState } from 'react'
import type { AffectedSection, AuthStatus, ManualConfig, ManualInfo, Settings, UpdateInfo } from '../../../shared/api.ts'
import { CODE_PRESETS, VIEWPORTS, viewportKey, type ViewportKey } from '../../../shared/presets.ts'
import { api } from '../api.ts'
import { useAsyncAction, useEnvChecks } from '../hooks.ts'
import { EnvList } from './EnvList.tsx'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { openReport } from './ReportDialog.tsx'
import { useToast } from './Toast.tsx'
import { UpdateAction } from './UpdateAction.tsx'

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
  onSettings,
  onOpenSection,
  onReset,
  onClose,
}: {
  onSettings: (settings: Settings) => void
  onOpenSection: (path: string) => void
  onReset: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('general')
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
          {tab === 'general' && <GeneralPane settings={settings} manuals={manuals} update={update} />}
          {tab === 'manual' && <ManualPane />}
          {tab === 'account' && <AccountPane onReset={onReset} />}
          {tab === 'env' && <EnvPane />}
          {tab === 'advanced' && <AdvancedPane settings={settings} update={update} onReset={onReset} />}
          {tab === 'affected' && <AffectedPane settings={settings} onOpenSection={onOpenSection} onGoAdvanced={() => setTab('advanced')} />}
          {tab === 'about' && <AboutPane />}
        </div>
      </div>
    </Modal>
  )
}

type Update = (patch: Partial<Settings>) => Promise<void>

function GeneralPane({ settings, manuals, update }: { settings: Settings; manuals: ManualInfo[]; update: Update }) {
  const toast = useToast()
  return (
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
      <label className="field">
        <span>작업이 끝나면 알림 (Claude 초안·최신화, 영상 만들기, 캡처, 가져오기, 제출)</span>
        <div className="inline-input">
          <select
            value={settings.notifyOnDone ?? 'background'}
            onChange={(e) => update({ notifyOnDone: e.target.value as Settings['notifyOnDone'] })}
          >
            <option value="background">다른 앱을 보고 있을 때만</option>
            <option value="always">항상</option>
            <option value="off">끄기</option>
          </select>
          <button
            className="button small"
            onClick={() =>
              api.app.testNotification().then(
                () => toast.show('info', '알림이 안 보이면 시스템 설정 → 알림 → Ariadne에서 허용하세요'),
                (e) => toast.error(e),
              )
            }
          >
            알림 시험
          </button>
        </div>
        <em className="hint">5초 넘게 걸린 작업만 알립니다. 알림을 누르면 Ariadne로 돌아옵니다</em>
      </label>
    </>
  )
}

function AdvancedPane({ settings, update, onReset }: { settings: Settings; update: Update; onReset: () => void }) {
  return (
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
      <label className="field">
        <span>Claude 인증 (Claude로 초안 만들기·최신화)</span>
        <select
          value={settings.claudeAuth}
          onChange={(e) => update({ claudeAuth: e.target.value as Settings['claudeAuth'] })}
        >
          <option value="auto">자동 — 키가 있으면 API 키, 없으면 claude.ai 로그인</option>
          <option value="apiKey">ANTHROPIC_API_KEY 환경변수 (~/.zshrc)</option>
          <option value="login">claude.ai 로그인</option>
        </select>
        <em className="hint">
          {settings.claudeAuth === 'auto'
            ? '~/.zshrc나 앱 환경에 ANTHROPIC_API_KEY가 있으면 그것을, 없으면 Claude Code의 claude.ai 로그인을 씁니다'
            : settings.claudeAuth === 'apiKey'
            ? '로그인 셸(~/.zshrc)의 ANTHROPIC_API_KEY를 씁니다. 키를 바꾼 뒤 앱을 다시 열 필요는 없습니다'
            : '키 환경변수를 넘기지 않고 Claude Code의 claude.ai 로그인으로 실행합니다. 터미널에서 claude → /login이 되어 있어야 합니다'}
        </em>
      </label>
      <label className="field">
        <span>Claude 생각량 (Claude로 초안·최신화·영상)</span>
        <select value={settings.claudeEffort} onChange={(e) => update({ claudeEffort: e.target.value as Settings['claudeEffort'] })}>
          <option value="low">낮음 — 가장 빠름</option>
          <option value="medium">보통 — 권장</option>
          <option value="high">높음 — 느리지만 꼼꼼함</option>
        </select>
        <em className="hint">작업 시간의 대부분이 Claude가 생각하고 쓰는 시간입니다. 결과가 엉성하면 높음으로 바꿔 보세요</em>
      </label>
      <TextSetting
        label="Claude 모델 (Claude로 초안·최신화·영상, 비우면 ~/.zshrc의 ANTHROPIC_MODEL)"
        value={settings.claudeModel}
        placeholder="claude-sonnet-5[1m]"
        onSave={(claudeModel) => update({ claudeModel: claudeModel.trim() })}
      />
      <TextSetting
        label="Claude Code CLI 경로 (비우면 자동으로 찾음)"
        value={settings.claudePath}
        placeholder="~/.local/bin/claude"
        onSave={(claudePath) => update({ claudePath })}
      />
      <DirSetting
        label="dealerhub-web 경로 (개발자용, 변경 영향 분석)"
        value={settings.dealerhubWebDir}
        onPick={(dealerhubWebDir) => update({ dealerhubWebDir })}
      />
    </>
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
  const { run, busy } = useAsyncAction({ onError: 'toast' })

  useEffect(() => {
    void api.auth.status().then(setAuth)
  }, [])

  const replace = () =>
    run(async () => {
      setAuth(await api.auth.setToken(token))
      setToken('')
      toast.show('success', '토큰을 바꿨습니다')
    })

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
  const { checks, run } = useEnvChecks()
  return (
    <>
      <EnvList checks={checks} onChanged={() => void run()} />
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
  const { run: runAction, busy, error } = useAsyncAction()
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

  const run = () => runAction(async () => setResult(await api.affected.run(base.trim(), head.trim())))

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
        <p>
          새 버전 {update.latest}이 있습니다. <UpdateAction update={update} />
        </p>
      )}
      <div className="about-actions">
        <button className="button small" onClick={() => openReport()}>
          <Icon name="alert" size={14} /> 문제 신고
        </button>
        <button className="button small" onClick={() => api.log.reveal()}>
          <Icon name="folder" size={14} /> 로그 폴더 열기
        </button>
      </div>
      <p className="hint">문제 신고는 GitHub 매뉴얼 리포에 Issue로 올라갑니다. 토큰·API 키·내 컴퓨터 경로는 가려서 보냅니다.</p>
    </div>
  )
}
