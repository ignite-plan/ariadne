// 가이드 영상: 시나리오 목록, 미리보기 실행, 영상 만들기, 결과 재생
import { useCallback, useEffect, useState } from 'react'
import { describeStep } from '../../../../src/core/video/describe.ts'
import {
  assetUrl,
  type ManualTree,
  type SessionInfo,
  type VideoInfo,
  type VideoModelProgress,
  type VideoModelStatus,
  type VideoProgress,
  type VideoRunResult,
  type VideoScenario,
} from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { StgSession } from './StgSession.tsx'
import { useToast } from './Toast.tsx'

const STAGE: Record<VideoProgress['stage'], string> = {
  tts: '음성 만들기',
  prepare: '준비',
  record: '녹화',
  compose: '영상 합치기',
  cleanup: '테스트 데이터 정리',
}

type Failure = Extract<VideoRunResult, { ok: false }>

function seconds(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function VideoPanel({ currentSection, onClose }: { currentSection?: string; onClose: () => void }) {
  const toast = useToast()
  const [videos, setVideos] = useState<VideoInfo[]>()
  const [selected, setSelected] = useState<string>()
  const [scenario, setScenario] = useState<VideoScenario>()
  const [loadError, setLoadError] = useState('')
  const [session, setSession] = useState<SessionInfo>({ exists: false })
  const [model, setModel] = useState<VideoModelStatus>()
  const [modelProgress, setModelProgress] = useState<VideoModelProgress>()
  const [downloading, setDownloading] = useState(false)
  const [running, setRunning] = useState<'preview' | 'render'>()
  const [progress, setProgress] = useState<VideoProgress>()
  const [failure, setFailure] = useState<Failure>()
  const [blocked, setBlocked] = useState<string[]>([])
  const [narration, setNarration] = useState(true)
  const [tab, setTab] = useState<'scenes' | 'video'>('scenes')
  const [dialog, setDialog] = useState<{ type: 'create' } | { type: 'delete' } | { type: 'mutates'; preview: boolean }>()

  const refresh = useCallback(async () => {
    const list = await api.video.list()
    setVideos(list)
    return list
  }, [])

  useEffect(() => {
    refresh().then(
      (list) => setSelected((s) => s ?? list.find((v) => currentSection && v.section === currentSection)?.id ?? list[0]?.id),
      (e) => setLoadError(errorMessage(e)),
    )
    void api.video.model().then(setModel)
    const offProgress = api.on('video-progress', setProgress)
    const offModel = api.on('video-model-progress', setModelProgress)
    return () => {
      offProgress()
      offModel()
    }
  }, [refresh, currentSection])

  useEffect(() => {
    setScenario(undefined)
    setFailure(undefined)
    setBlocked([])
    if (!selected) return
    api.video.load(selected).then(setScenario, (e) => toast.error(e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const info = videos?.find((v) => v.id === selected)

  const downloadModel = async () => {
    setDownloading(true)
    try {
      setModel(await api.video.downloadModel())
      toast.show('success', '음성 모델을 받았습니다')
    } catch (e) {
      toast.error(e)
    } finally {
      setDownloading(false)
      setModelProgress(undefined)
    }
  }

  const run = async (preview: boolean, confirmed = false) => {
    if (!selected || !scenario) return
    if (scenario.mutates && !confirmed) return setDialog({ type: 'mutates', preview })
    setDialog(undefined)
    setRunning(preview ? 'preview' : 'render')
    setProgress(undefined)
    setFailure(undefined)
    setBlocked([])
    try {
      const result = await api.video.run(selected, { preview, tts: narration })
      if (!result.ok) {
        setFailure(result)
        setTab('scenes')
        return
      }
      setBlocked(result.blockedRequests)
      if (preview) toast.show('success', `미리보기를 마쳤습니다 (${seconds(result.durationMs)})`)
      else {
        await refresh()
        setTab('video')
        toast.show('success', `영상을 만들었습니다 (${seconds(result.durationMs)})`)
      }
    } catch (e) {
      const message = errorMessage(e)
      if (message.includes('세션 만료')) toast.show('error', '로그인 세션이 만료되었습니다. 다시 로그인하세요')
      else toast.error(e)
    } finally {
      setRunning(undefined)
    }
  }

  const remove = async () => {
    if (!selected) return
    try {
      await api.video.remove(selected)
      setDialog(undefined)
      const list = await refresh()
      setSelected(list[0]?.id)
    } catch (e) {
      toast.error(e)
    }
  }

  const narrate = narration && model?.ready
  const canRun = Boolean(scenario && session.exists && !running && scenario.scenes.length)

  return (
    <div className="capture-panel">
      <header className="panel-header">
        <div>
          <h1>가이드 영상</h1>
          <p className="muted">STG 화면을 녹화하고 영어 자막과 내레이션을 넣어 사용법 영상을 만듭니다.</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="닫기" disabled={Boolean(running)}>
          <Icon name="x" />
        </button>
      </header>

      <div className="capture-body">
        <aside className="capture-side">
          <StgSession disabled={Boolean(running)} onChange={setSession} />

          <div className={`session ${model?.ready ? 'ok' : ''}`}>
            <Icon name="speaker" />
            <div>
              <b>{model?.ready ? '음성 모델 준비됨' : '음성 모델 필요'}</b>
              <span className="muted">
                {model?.ready
                  ? '내레이션을 이 Mac에서 만듭니다'
                  : modelProgress
                    ? `받는 중 ${modelProgress.index + 1}/${modelProgress.count} · ${Math.round(modelProgress.loaded / 1e6)}MB`
                    : '내레이션용, 한 번만 받습니다 (약 90MB)'}
              </span>
            </div>
            {!model?.ready && (
              <button className="button small" onClick={downloadModel} disabled={downloading}>
                {downloading ? '받는 중…' : '받기'}
              </button>
            )}
          </div>

          <div className="shot-list video-list">
            {loadError && <p className="form-error">{loadError}</p>}
            {!videos && !loadError && <p className="muted">영상 목록을 읽는 중…</p>}
            {videos && !videos.length && <p className="empty">아직 영상이 없습니다. [새 영상]으로 시작하세요.</p>}
            {videos?.map((v) => (
              <button
                key={v.id}
                className={`video-item ${v.id === selected ? 'active' : ''}`}
                onClick={() => setSelected(v.id)}
                disabled={Boolean(running)}
                title={v.error ?? v.section ?? v.id}
              >
                <span className="ellipsis">
                  <b>{v.title}</b>
                  <span className="muted">
                    {v.error ? '형식 오류' : `장면 ${v.scenes}`}
                    {v.output ? ' · 영상 있음' : ''}
                  </span>
                </span>
                {v.mutates && <span className="tag accent">STG 저장</span>}
                {v.error && <span className="tag danger">오류</span>}
              </button>
            ))}
          </div>

          <button className="button block" onClick={() => setDialog({ type: 'create' })} disabled={Boolean(running)}>
            <Icon name="plus" /> 새 영상
          </button>
        </aside>

        <section className="capture-results video-main">
          {!info && (
            <div className="empty-state">
              <Icon name="video" size={32} />
              <p>왼쪽에서 영상을 고르거나 [새 영상]을 누르세요.</p>
            </div>
          )}
          {info?.error && <pre className="form-error video-error">{info.error}</pre>}
          {info && scenario && (
            <>
              <div className="video-toolbar">
                <div className="video-title">
                  <h2>{scenario.title}</h2>
                  <span className="muted ellipsis">{scenario.section ?? '연결된 화면 없음'}</span>
                </div>
                <label className="video-check" title={model?.ready ? '' : '음성 모델을 받아야 내레이션을 넣을 수 있습니다'}>
                  <input
                    type="checkbox"
                    checked={Boolean(narrate)}
                    disabled={!model?.ready || Boolean(running)}
                    onChange={(e) => setNarration(e.target.checked)}
                  />
                  내레이션
                </label>
                <button className="button" onClick={() => void run(true)} disabled={!canRun}>
                  <Icon name="eye" /> {running === 'preview' ? '미리보기 중…' : '미리보기'}
                </button>
                <button className="button primary" onClick={() => void run(false)} disabled={!canRun}>
                  <Icon name="video" /> {running === 'render' ? '만드는 중…' : '영상 만들기'}
                </button>
                <button className="icon-button" onClick={() => setDialog({ type: 'delete' })} disabled={Boolean(running)} title="삭제">
                  <Icon name="trash" />
                </button>
              </div>

              {!session.exists && <p className="notice">STG 로그인 후 미리보기와 영상 만들기를 할 수 있습니다.</p>}
              {running && (
                <div className="video-progress">
                  <div className="progress">
                    <div className="progress-bar" data-indeterminate="true" />
                    <span className="ellipsis">
                      {progress ? `${STAGE[progress.stage]} · ${progress.message}` : '시작하는 중…'}
                      {progress?.step !== undefined ? ` · 단계 ${progress.step + 1}` : ''}
                    </span>
                  </div>
                  <button className="button small" onClick={() => void api.video.cancel()}>
                    <Icon name="stop" /> 멈춤
                  </button>
                </div>
              )}
              {failure && (
                <div className="form-error">
                  <b>{failure.scene === undefined ? '실패' : failure.scene === 'cleanup' ? '정리 단계에서 실패' : `장면 ${failure.scene + 1}에서 실패`}</b>
                  <p>{failure.error}</p>
                </div>
              )}
              {blocked.length > 0 && (
                <div className="notice">
                  <b>데이터를 바꾸는 요청 {blocked.length}개를 막았습니다.</b> 저장 과정을 보여 줘야 하면 'STG에 실제 저장 허용'을 켜세요.
                  <ul>
                    {blocked.slice(0, 5).map((r) => (
                      <li key={r} className="ellipsis">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="segmented small">
                <button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}>
                  장면 {scenario.scenes.length}
                </button>
                <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>
                  영상
                </button>
              </div>

              {tab === 'scenes' && (
                <ol className="scene-list">
                  {scenario.intro && (
                    <li className="scene intro">
                      <div className="scene-head">
                        <b>시작 카드</b>
                      </div>
                      <p className="scene-say">{scenario.intro}</p>
                    </li>
                  )}
                  {scenario.scenes.map((scene, i) => (
                    <li key={i} className={`scene ${failure?.scene === i ? 'failed' : ''} ${progress?.scene === i && running ? 'current' : ''}`}>
                      <div className="scene-head">
                        <b>장면 {i + 1}</b>
                      </div>
                      <p className="scene-say">{scene.say || <span className="muted">내레이션 없음</span>}</p>
                      <ul className="steps">
                        {scene.steps.map((step, j) => (
                          <li key={j} className={failure?.scene === i && failure.step === j ? 'failed' : ''}>
                            {describeStep(step)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}

              {tab === 'video' &&
                (info.output ? (
                  <div className="video-player">
                    <video key={info.output.updatedAt} controls src={assetUrl(info.output.mp4, info.output.updatedAt)} crossOrigin="anonymous">
                      <track kind="subtitles" srcLang="en" label="English" src={assetUrl(info.output.vtt, info.output.updatedAt)} />
                    </video>
                    <div className="video-meta">
                      <span className="muted">
                        {new Date(info.output.updatedAt).toLocaleString()} · {(info.output.size / 1e6).toFixed(1)}MB
                      </span>
                      <button className="button small" onClick={() => void api.workspace.reveal(info.output!.mp4)}>
                        <Icon name="folder" /> Finder에서 보기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state small">
                    <Icon name="video" size={28} />
                    <p>아직 만든 영상이 없습니다. [영상 만들기]를 누르세요.</p>
                  </div>
                ))}
            </>
          )}
        </section>
      </div>

      {dialog?.type === 'create' && (
        <CreateVideoDialog
          currentSection={currentSection}
          onClose={() => setDialog(undefined)}
          onCreated={async (created) => {
            setDialog(undefined)
            await refresh()
            setSelected(created.id)
          }}
        />
      )}
      {dialog?.type === 'delete' && info && (
        <Modal title="영상 시나리오 삭제" onClose={() => setDialog(undefined)} width={420}>
          <p>
            <b>{info.title}</b> 시나리오를 지웁니다. 제출하기 전에는 변경 탭에서 되돌릴 수 있습니다.
          </p>
          <div className="actions">
            <button className="button" onClick={() => setDialog(undefined)}>
              취소
            </button>
            <button className="button danger" onClick={() => void remove()}>
              삭제
            </button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'mutates' && (
        <Modal title="STG에 실제로 저장합니다" onClose={() => setDialog(undefined)} width={460}>
          <p>이 시나리오는 STG에서 저장·삭제 버튼을 실제로 누릅니다. 테스트 데이터(이름에 Video Test)만 쓰는지 확인하세요.</p>
          <p className="muted">녹화가 끝나면 정리 단계가 만든 데이터를 지웁니다.</p>
          <div className="actions">
            <button className="button" onClick={() => setDialog(undefined)}>
              취소
            </button>
            <button className="button primary" onClick={() => void run(dialog.preview, true)}>
              계속
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateVideoDialog({
  currentSection,
  onClose,
  onCreated,
}: {
  currentSection?: string
  onClose: () => void
  onCreated: (scenario: VideoScenario) => void
}) {
  const [tree, setTree] = useState<ManualTree>()
  const [section, setSection] = useState(currentSection ?? '')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.manual.tree().then((t) => {
      setTree(t)
      const current = t.chapters.flatMap((c) => c.sections).find((s) => s.path === currentSection)
      if (current) setTitle((v) => v || current.title)
    })
  }, [currentSection])

  const create = async () => {
    setSaving(true)
    setError('')
    try {
      onCreated(await api.video.create({ title, section: section || undefined }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="새 영상" onClose={onClose} width={480}>
      <label className="field">
        <span>연결할 화면</span>
        <select
          value={section}
          onChange={(e) => {
            setSection(e.target.value)
            const found = tree?.chapters.flatMap((c) => c.sections).find((s) => s.path === e.target.value)
            if (found) setTitle(found.title)
          }}
        >
          <option value="">(없음)</option>
          {tree?.chapters.map((c) => (
            <optgroup key={c.dir} label={`${c.no}. ${c.title}`}>
              {c.sections.map((s) => (
                <option key={s.path} value={s.path}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        <span>영상 제목 (영어, 시작 카드에 나옵니다)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dealer List View" autoFocus />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="actions">
        <button className="button" onClick={onClose}>
          취소
        </button>
        <button className="button primary" onClick={() => void create()} disabled={!title.trim() || saving}>
          만들기
        </button>
      </div>
    </Modal>
  )
}
