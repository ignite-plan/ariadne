// 가이드 영상: 시나리오 목록, 미리보기 실행, 영상 만들기, 결과 재생
import { useCallback, useEffect, useRef, useState } from 'react'
import { appendRecorded } from '../../../../src/core/video/edit.ts'
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
import { VideoEditor } from './VideoEditor.tsx'

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
  const [dialog, setDialog] = useState<
    { type: 'create' } | { type: 'delete' } | { type: 'mutates'; action: 'preview' | 'render' | 'record'; scene?: number }
  >()
  // STG에서 기록 중인 장면. 기록 이벤트는 몰려 오므로 최신 시나리오·장면은 ref로 본다
  const [recording, setRecording] = useState<{ scene: number; ready: boolean; warnings: string[] }>()
  const recordingRef = useRef<{ scene: number }>(undefined)
  const scenarioRef = useRef<VideoScenario>(undefined)
  const [tree, setTree] = useState<ManualTree>()
  // 고칠 때마다 0.6초 뒤 저장한다. 실행·전환·닫기 전에는 바로 저장한다
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [saveError, setSaveError] = useState('')
  const pending = useRef<VideoScenario>(undefined)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

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
    void api.manual.tree().then(setTree)
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
    api.video.load(selected).then((s) => {
      scenarioRef.current = s
      setScenario(s)
    }, (e) => toast.error(e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const info = videos?.find((v) => v.id === selected)

  const flush = async () => {
    clearTimeout(saveTimer.current)
    const next = pending.current
    if (!next) return saveState !== 'error'
    pending.current = undefined
    setSaveState('saving')
    try {
      await api.video.save(next)
      setSaveState('saved')
      setSaveError('')
      void refresh()
      return true
    } catch (e) {
      setSaveState('error')
      setSaveError(errorMessage(e))
      return false
    }
  }

  const change = (next: VideoScenario) => {
    scenarioRef.current = next
    setScenario(next)
    pending.current = next
    setSaveState('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flush(), 600)
  }

  const select = async (id: string) => {
    await flush()
    setSelected(id)
  }

  const close = async () => {
    await flush()
    onClose()
  }

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

  useEffect(
    () =>
      api.on('video-record', (event) => {
        const s = scenarioRef.current
        const rec = recordingRef.current
        const warn = (message: string) => setRecording((r) => r && { ...r, warnings: [...r.warnings, message].slice(-4) })
        if (event.kind === 'ready') return setRecording((r) => r && { ...r, ready: true })
        if (event.kind === 'stop') {
          recordingRef.current = undefined
          setRecording(undefined)
          void flush()
          return toast.show('success', '기록을 마쳤습니다. 내레이션을 쓰고 미리보기로 확인하세요')
        }
        if (event.kind === 'warning') return warn(event.message)
        if (!s || !rec) return
        if (event.kind === 'step') {
          const scene = s.scenes[rec.scene]
          change({ ...s, scenes: s.scenes.map((x, i) => (i === rec.scene ? { ...scene, steps: appendRecorded(scene.steps, event.step) } : x)) })
          if (event.warning) warn(event.warning)
        } else if (event.kind === 'mask') {
          change({ ...s, mask: [...(s.mask ?? []), event.target] })
        } else if (event.kind === 'scene') {
          change({ ...s, scenes: [...s.scenes, { say: '', steps: [] }] })
          recordingRef.current = { scene: s.scenes.length }
          setRecording((r) => r && { ...r, scene: s.scenes.length })
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const record = async (scene: number, confirmed = false) => {
    if (!selected || !scenario) return
    if (!(await flush())) return toast.show('error', '시나리오를 저장하지 못했습니다. 빨간 안내를 확인하세요')
    if (scenario.mutates && !confirmed) return setDialog({ type: 'mutates', action: 'record', scene })
    setDialog(undefined)
    setFailure(undefined)
    recordingRef.current = { scene }
    setRecording({ scene, ready: false, warnings: [] })
    try {
      await api.video.record(selected, scene)
    } catch (e) {
      recordingRef.current = undefined
      setRecording(undefined)
      toast.error(e)
    }
  }

  const run = async (preview: boolean, fromScene?: number, confirmed = false) => {
    if (!selected || !scenario) return
    if (!(await flush())) return toast.show('error', '시나리오를 저장하지 못했습니다. 빨간 안내를 확인하세요')
    if (scenario.mutates && !confirmed) return setDialog({ type: 'mutates', action: preview ? 'preview' : 'render', scene: fromScene })
    setDialog(undefined)
    setRunning(preview ? 'preview' : 'render')
    setProgress(undefined)
    setFailure(undefined)
    setBlocked([])
    try {
      const result = await api.video.run(selected, { preview, fromScene, tts: narration })
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
  const canRun = Boolean(scenario && session.exists && !running && !recording && scenario.scenes.length)

  return (
    <div className="capture-panel">
      <header className="panel-header">
        <div>
          <h1>가이드 영상</h1>
          <p className="muted">STG 화면을 녹화하고 영어 자막과 내레이션을 넣어 사용법 영상을 만듭니다.</p>
        </div>
        <button className="icon-button" onClick={() => void close()} aria-label="닫기" disabled={Boolean(running || recording)}>
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
                onClick={() => void select(v.id)}
                disabled={Boolean(running || recording)}
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

          <button className="button block" onClick={() => setDialog({ type: 'create' })} disabled={Boolean(running || recording)}>
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
                  <span className="muted ellipsis">
                    {scenario.section ?? '연결된 화면 없음'} · {saveState === 'saving' ? '저장 중…' : saveState === 'error' ? '저장 못 함' : '저장됨'}
                  </span>
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
                <button className="button" onClick={() => void run(true)} disabled={!canRun} title="브라우저를 띄워 처음부터 실행해 봅니다 (녹화하지 않음)">
                  <Icon name="eye" /> {running === 'preview' ? '미리보기 중…' : '미리보기'}
                </button>
                <button className="button primary" onClick={() => void run(false)} disabled={!canRun}>
                  <Icon name="video" /> {running === 'render' ? '만드는 중…' : '영상 만들기'}
                </button>
                <button className="icon-button" onClick={() => setDialog({ type: 'delete' })} disabled={Boolean(running)} title="삭제">
                  <Icon name="trash" />
                </button>
              </div>

              {saveError && <pre className="form-error video-error">{saveError}</pre>}
              {recording && (
                <div className="recording-bar">
                  <span className="rec-dot" />
                  <div>
                    <b>
                      {recording.ready ? `STG 창에서 조작하면 장면 ${recording.scene + 1}에 단계가 붙습니다` : '앞 단계를 재생하는 중…'}
                    </b>
                    <span className="muted">
                      Chrome 창 오른쪽 아래 막대에서 강조할 곳·가릴 곳·기다릴 글자를 고르거나 새 장면을 시작합니다.
                    </span>
                    {recording.warnings.map((w, i) => (
                      <span key={i} className="rec-warning">
                        {w}
                      </span>
                    ))}
                  </div>
                  <button className="button small" onClick={() => void api.video.stopRecord()}>
                    <Icon name="stop" /> 기록 끝
                  </button>
                </div>
              )}
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
                <VideoEditor
                  scenario={scenario}
                  onChange={change}
                  tree={tree}
                  disabled={Boolean(running)}
                  voiceReady={model?.ready}
                  failure={failure}
                  currentScene={running ? progress?.scene : undefined}
                  onPreviewFrom={(i) => void run(true, i)}
                  recordingScene={recording?.scene}
                  onRecord={session.exists && !running && !recording ? (i) => void record(i) : undefined}
                />
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
          <p className="muted">
            {dialog.action === 'record'
              ? '기록하기 전에 앞 단계를 다시 실행하므로 저장이 한 번 더 일어날 수 있습니다. 기록 중에 만든 데이터는 STG에서 직접 지우세요.'
              : '녹화가 끝나면 정리 단계가 만든 데이터를 지웁니다.'}
          </p>
          <div className="actions">
            <button className="button" onClick={() => setDialog(undefined)}>
              취소
            </button>
            <button
              className="button primary"
              onClick={() =>
                void (dialog.action === 'record' ? record(dialog.scene ?? 0, true) : run(dialog.action === 'preview', dialog.scene, true))
              }
            >
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
