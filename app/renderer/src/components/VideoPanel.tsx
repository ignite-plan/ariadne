// 가이드 영상: 시나리오 목록, 미리보기 실행, 영상 만들기, 결과 재생
import { useCallback, useEffect, useRef, useState } from 'react'
import { isSessionExpired } from '../../../../src/core/stg-url.ts'
import { appendRecorded, sceneHasContent } from '../../../../src/core/video/edit.ts'
import {
  assetUrl,
  type ManualTree,
  type VideoInfo,
  type VideoModelProgress,
  type VideoModelStatus,
  type VideoProgress,
  type VideoRunResult,
  type VideoScenario,
} from '../../../shared/api.ts'
import { formatClock } from '../../../shared/format.ts'
import { api, errorMessage } from '../api.ts'
import { findSection } from '../manual-tree.ts'
import { useAutosave } from '../hooks.ts'
import { useClaudeDone, useTasks, type VideoTask } from '../tasks.tsx'
import { Icon } from './Icon.tsx'
import { Confirm } from './Modal.tsx'
import { Progress } from './Progress.tsx'
import { StgSession } from './StgSession.tsx'
import { useToast } from './Toast.tsx'
import { CreateVideoDialog, SceneDraftDialog } from './VideoDialogs.tsx'
import { VideoEditor } from './VideoEditor.tsx'

const STAGE: Record<VideoProgress['stage'], string> = {
  tts: '음성 만들기',
  prepare: '준비',
  record: '녹화',
  compose: '영상 합치기',
  cleanup: '테스트 데이터 정리',
}

type Failure = Extract<VideoRunResult, { ok: false }>
type Recording = { scene: number; ready: boolean; warnings: string[] }
type Dialog = { type: 'create' } | { type: 'delete' } | { type: 'mutates'; action: 'preview' | 'render' | 'record'; scene?: number }

// 연결된 화면 제목. 목차에 없으면 경로
const sectionsLabel = (tree: ManualTree | undefined, sections: string[] = []) =>
  sections.length ? sections.map((p) => findSection(tree, p)?.title ?? p).join(' → ') : '연결된 화면 없음'

const SAVE_FAILED = '시나리오를 저장하지 못했습니다. 빨간 안내를 확인하세요'

export function VideoPanel({ currentSection, initial, onClose }: { currentSection?: string; initial?: string; onClose: () => void }) {
  const toast = useToast()
  const tasks = useTasks()
  // 영상 만들기는 패널을 닫아도 계속된다 (tasks.tsx). 미리보기·기록은 화면이 보이는 Chrome이라 이 패널에서만 한다
  const rendering = tasks.video
  const claudeRunning = tasks.claude?.phase === 'running'
  // Claude 작업·영상 만들기 등이 STG 공유 Chrome을 쓰는 중이면 미리보기·기록(화면이 보이는 Chrome)은 못 한다
  const stgBusy = tasks.stgBusy.length > 0
  const session = tasks.session
  const [videos, setVideos] = useState<VideoInfo[]>()
  const [selected, setSelected] = useState<string>()
  const [scenario, setScenario] = useState<VideoScenario>()
  const scenarioRef = useRef<VideoScenario>(undefined)
  const [loadError, setLoadError] = useState('')
  const [tree, setTree] = useState<ManualTree>()
  const voice = useVoiceModel()
  const [running, setRunning] = useState<'preview' | 'render'>()
  const [progress, setProgress] = useState<VideoProgress>()
  const [failure, setFailure] = useState<Failure>()
  const [blocked, setBlocked] = useState<string[]>([])
  const [narration, setNarration] = useState(true)
  const [tab, setTab] = useState<'scenes' | 'video'>('scenes')
  const [dialog, setDialog] = useState<Dialog>()
  // 장면 하나를 Claude로 채울 때 요청을 묻는 창
  const [sceneAsk, setSceneAsk] = useState<number>()
  const [saveError, setSaveError] = useState('')

  const refresh = useCallback(async () => {
    const list = await api.video.list()
    setVideos(list)
    return list
  }, [])

  // 고칠 때마다 0.6초 뒤 저장한다. 실행·전환·닫기 전에는 바로 저장한다
  const autosave = useAutosave<VideoScenario>({
    save: (next) => api.video.save(next).then(() => undefined),
    onSaved: () => {
      setSaveError('')
      void refresh()
    },
    onError: (e) => setSaveError(errorMessage(e)),
  })
  const { flush, schedule } = autosave

  const show = useCallback((next: VideoScenario) => {
    scenarioRef.current = next
    setScenario(next)
  }, [])
  const change = useCallback(
    (next: VideoScenario) => {
      show(next)
      schedule(next)
    },
    [show, schedule],
  )

  const recorder = useVideoRecording({ scenarioRef, change, flush })
  const { recording } = recorder
  const locked = Boolean(running || recording)

  useEffect(() => {
    refresh().then(
      (list) =>
        setSelected(
          (s) =>
            s ??
            (initial && list.some((v) => v.id === initial) ? initial : undefined) ??
            list.find((v) => currentSection && v.sections.includes(currentSection))?.id ??
            list[0]?.id,
        ),
      (e) => setLoadError(errorMessage(e)),
    )
    void api.manual.tree().then(setTree)
    return api.on('video-progress', setProgress)
  }, [refresh, currentSection])

  useEffect(() => {
    setScenario(undefined)
    setFailure(undefined)
    setBlocked([])
    if (!selected) return
    api.video.load(selected).then(show, (e) => toast.error(e))
  }, [selected, show, toast])

  const info = videos?.find((v) => v.id === selected)
  // Claude가 이 시나리오를 고치는 중이면 편집을 막는다
  const claudeOnThis = claudeRunning && tasks.claude?.input.video !== undefined && tasks.claude.input.video === selected

  // Claude가 시나리오 파일을 고쳤다. 디스크에서 다시 읽는다 (패널을 숨겨 둔 동안 끝났어도)
  useClaudeDone((task) => {
    if (!task.input.video) return
    void refresh()
    if (task.input.video !== scenarioRef.current?.id) return
    void api.video.load(task.input.video).then(show)
  })

  const select = async (id: string) => {
    await flush()
    setSelected(id)
  }

  // 패널이 열린 채로 영상 완료 알림의 [보기]를 누르면 그 영상의 결과를 보여 준다 (처음 열 때는 위에서 고른다)
  useEffect(() => {
    if (!initial || !videos?.some((v) => v.id === initial)) return
    void select(initial).then(() => setTab('video'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.videoPanel])

  const close = async () => {
    await flush()
    onClose()
  }

  const record = async (scene: number, confirmed = false) => {
    if (!selected || !scenario) return
    if (!(await flush())) return toast.show('error', SAVE_FAILED)
    if (scenario.mutates && !confirmed) return setDialog({ type: 'mutates', action: 'record', scene })
    setDialog(undefined)
    setFailure(undefined)
    recorder.start(scene)
    try {
      await api.video.record(selected, scene)
    } catch (e) {
      recorder.stop()
      toast.error(e)
    }
  }

  const run = async (preview: boolean, fromScene?: number, confirmed = false) => {
    if (!selected || !scenario) return
    if (!(await flush())) return toast.show('error', SAVE_FAILED)
    if (scenario.mutates && !confirmed) return setDialog({ type: 'mutates', action: preview ? 'preview' : 'render', scene: fromScene })
    setDialog(undefined)
    if (preview) setRunning('preview')
    setProgress(undefined)
    setFailure(undefined)
    setBlocked([])
    try {
      // 영상 만들기는 tasks가 맡아 패널을 닫아도 이어진다 (끝나면 tasks가 알린다)
      const result = preview
        ? await api.video.run(selected, { preview, fromScene, tts: narration })
        : await tasks.runVideo(selected, scenario.title, { preview, fromScene, tts: narration })
      if (!result.ok) {
        setFailure(result)
        setTab('scenes')
        return
      }
      setBlocked(result.blockedRequests)
      if (preview) toast.show('success', `미리보기를 마쳤습니다 (${formatClock(result.durationMs)})`)
      else {
        await refresh()
        setTab('video')
      }
    } catch (e) {
      if (isSessionExpired(errorMessage(e))) toast.show('error', '로그인 세션이 만료되었습니다. 다시 로그인하세요')
      else toast.error(e)
    } finally {
      if (preview) {
        setRunning(undefined)
        // 세션이 만료됐으면 main이 로그인 표식을 지웠다
        void tasks.reloadSession()
      }
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

  const empty = Boolean(scenario && !scenario.scenes.some(sceneHasContent))
  const canRun = Boolean(scenario && session.exists && !running && !recording && !empty && !claudeOnThis)
  // 미리보기는 화면이 보이는 Chrome을 따로 띄운다 (다른 STG 작업이 없어야 한다)
  const canPreview = canRun && !stgBusy
  const canRender = canRun && !rendering
  const saveLabel = autosave.state === 'error' ? '저장 못 함' : autosave.state === 'saved' ? '저장됨' : '저장 중…'

  const openDraft = async () => {
    if (!scenario || !(await flush())) return
    tasks.openDraft({ mode: 'video', menu: scenario.title, video: scenario.id, targets: scenario.sections })
  }

  return (
    <div className="capture-panel">
      <header className="panel-header">
        <div>
          <h1>가이드 영상</h1>
          <p className="muted">STG 화면을 녹화하고 영어 자막과 내레이션을 넣어 사용법 영상을 만듭니다.</p>
        </div>
        <button className="icon-button" onClick={() => void close()} aria-label="닫기" disabled={locked}>
          <Icon name="x" />
        </button>
      </header>

      <div className="capture-body">
        <aside className="capture-side">
          <StgSession disabled={locked} />
          <VoiceModelRow voice={voice} />
          <VideoList videos={videos} loadError={loadError} selected={selected} disabled={locked} onSelect={(id) => void select(id)} />
          <button className="button block" onClick={() => setDialog({ type: 'create' })} disabled={locked}>
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
                    {sectionsLabel(tree, scenario.sections)} · {saveLabel}
                  </span>
                </div>
                <label className="video-check" title={voice.model?.ready ? '' : '음성 모델을 받아야 내레이션을 넣을 수 있습니다'}>
                  <input
                    type="checkbox"
                    checked={Boolean(narration && voice.model?.ready)}
                    disabled={!voice.model?.ready || Boolean(running)}
                    onChange={(e) => setNarration(e.target.checked)}
                  />
                  내레이션
                </label>
                <button
                  className="button ghost"
                  onClick={() => void openDraft()}
                  disabled={locked || claudeRunning || rendering?.id === selected}
                  title={claudeRunning ? 'Claude 작업이 끝난 뒤 할 수 있습니다' : '매뉴얼 본문과 STG 화면으로 Claude가 장면과 단계를 씁니다'}
                >
                  <Icon name="sparkle" /> Claude로 초안
                </button>
                <button
                  className="button"
                  onClick={() => void run(true)}
                  disabled={!canPreview}
                  title={stgBusy ? `${tasks.stgBusy.join(', ')} 중에는 미리보기를 할 수 없습니다` : '브라우저를 띄워 처음부터 실행해 봅니다 (녹화하지 않음)'}
                >
                  <Icon name="eye" /> {running === 'preview' ? '미리보기 중…' : '미리보기'}
                </button>
                <button
                  className="button primary"
                  onClick={() => void run(false)}
                  disabled={!canRender}
                  title={rendering ? `"${rendering.title}" 영상을 만드는 중입니다. 한 번에 하나씩 만듭니다` : 'Claude 작업 중에도 만들 수 있습니다'}
                >
                  <Icon name="video" /> {rendering?.id === selected ? '만드는 중…' : '영상 만들기'}
                </button>
                <button
                  className="icon-button"
                  onClick={() => setDialog({ type: 'delete' })}
                  disabled={Boolean(running || rendering?.id === selected || claudeOnThis)}
                  title="삭제"
                >
                  <Icon name="trash" />
                </button>
              </div>

              {saveError && <pre className="form-error video-error">{saveError}</pre>}
              {claudeOnThis && (
                <p className="notice">
                  Claude가 이 영상의 장면을 쓰는 중입니다. 끝날 때까지 편집할 수 없습니다. 위쪽 작업 표시를 누르면 진행 상황을 봅니다.
                </p>
              )}
              {stgBusy && !locked && (
                <p className="muted small-note">
                  {tasks.stgBusy.join(', ')} 중에는 미리보기와 STG에서 기록을 할 수 없습니다. 영상 만들기는 함께 할 수 있습니다.
                </p>
              )}
              {recording && <RecordingBar recording={recording} />}
              {empty && !recording && (
                <p className="notice">
                  장면이 모두 비어 있습니다. 장면의 [STG에서 기록]이나 위쪽 [Claude로 초안]으로 시작하거나, 내레이션을 쓰고 [+ 단계]로 조작을 넣으세요. 그
                  다음 미리보기와 영상 만들기를 할 수 있습니다.
                </p>
              )}
              {!session.exists && <p className="notice">STG 로그인 후 미리보기와 영상 만들기를 할 수 있습니다.</p>}
              {(running || rendering) && (
                <RunProgress progress={running ? progress : rendering?.progress} rendering={rendering} other={!running && rendering?.id !== selected} />
              )}
              <RunResult failure={failure} blocked={blocked} />

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
                  disabled={Boolean(running || claudeOnThis)}
                  voiceReady={voice.model?.ready}
                  failure={failure}
                  currentScene={running ? progress?.scene : rendering?.id === selected ? rendering?.progress?.scene : undefined}
                  onPreviewFrom={canPreview ? (i) => void run(true, i) : undefined}
                  recordingScene={recording?.scene}
                  onRecord={session.exists && !locked && !stgBusy && !claudeOnThis ? (i) => void record(i) : undefined}
                  onClaudeScene={!locked && !claudeRunning ? (i) => setSceneAsk(i) : undefined}
                />
              )}
              {tab === 'video' && <VideoPlayer info={info} />}
            </>
          )}
        </section>
      </div>

      {sceneAsk !== undefined && scenario && (
        <SceneDraftDialog
          scene={sceneAsk}
          say={scenario.scenes[sceneAsk]?.say}
          onClose={() => setSceneAsk(undefined)}
          onStart={async (notes, insert) => {
            setSceneAsk(undefined)
            if (!(await flush())) return toast.show('error', SAVE_FAILED)
            tasks.openDraft({
              mode: 'video-scene',
              menu: scenario.title,
              video: scenario.id,
              scene: sceneAsk,
              insert,
              notes,
              targets: scenario.sections,
            })
          }}
        />
      )}

      {dialog?.type === 'create' && (
        <CreateVideoDialog
          tree={tree}
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
        <Confirm
          title="영상 시나리오 삭제"
          message={
            <p>
              <b>{info.title}</b> 시나리오를 지웁니다. 제출하기 전에는 변경 탭에서 되돌릴 수 있습니다.
            </p>
          }
          confirmLabel="삭제"
          danger
          onCancel={() => setDialog(undefined)}
          onConfirm={() => void remove()}
        />
      )}
      {dialog?.type === 'mutates' && (
        <Confirm
          title="STG에 실제로 저장합니다"
          width={460}
          message={
            <>
              <p>이 시나리오는 STG에서 저장·삭제 버튼을 실제로 누릅니다. 테스트 데이터(이름에 Video Test)만 쓰는지 확인하세요.</p>
              <p className="muted">
                {dialog.action === 'record'
                  ? '기록하기 전에 앞 단계를 다시 실행하므로 저장이 한 번 더 일어날 수 있습니다. 기록 중에 만든 데이터는 STG에서 직접 지우세요.'
                  : '녹화가 끝나면 정리 단계가 만든 데이터를 지웁니다.'}
              </p>
            </>
          }
          confirmLabel="계속"
          onCancel={() => setDialog(undefined)}
          onConfirm={() =>
            void (dialog.action === 'record' ? record(dialog.scene ?? 0, true) : run(dialog.action === 'preview', dialog.scene, true))
          }
        />
      )}
    </div>
  )
}

// 내레이션 음성 모델. 처음 한 번 받는다
function useVoiceModel() {
  const toast = useToast()
  const [model, setModel] = useState<VideoModelStatus>()
  const [progress, setProgress] = useState<VideoModelProgress>()
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    void api.video.model().then(setModel)
    return api.on('video-model-progress', setProgress)
  }, [])

  const download = async () => {
    setDownloading(true)
    try {
      setModel(await api.video.downloadModel())
      toast.show('success', '음성 모델을 받았습니다')
    } catch (e) {
      toast.error(e)
    } finally {
      setDownloading(false)
      setProgress(undefined)
    }
  }
  return { model, progress, downloading, download }
}

// STG에서 기록: 기록한 단계·가릴 곳·새 장면을 지금 시나리오에 붙인다. 이벤트는 몰려 오므로 최신 시나리오·장면은 ref로 본다
function useVideoRecording({
  scenarioRef,
  change,
  flush,
}: {
  scenarioRef: { current: VideoScenario | undefined }
  change: (next: VideoScenario) => void
  flush: () => Promise<boolean>
}) {
  const toast = useToast()
  const [recording, setRecording] = useState<Recording>()
  const sceneRef = useRef<number>(undefined)

  useEffect(
    () =>
      api.on('video-record', (event) => {
        const s = scenarioRef.current
        const scene = sceneRef.current
        const warn = (message: string) => setRecording((r) => r && { ...r, warnings: [...r.warnings, message].slice(-4) })
        if (event.kind === 'ready') return setRecording((r) => r && { ...r, ready: true })
        if (event.kind === 'stop') {
          sceneRef.current = undefined
          setRecording(undefined)
          void flush()
          return toast.show('success', '기록을 마쳤습니다. 내레이션을 쓰고 미리보기로 확인하세요')
        }
        if (event.kind === 'warning') return warn(event.message)
        if (!s || scene === undefined) return
        if (event.kind === 'step') {
          const current = s.scenes[scene]
          change({ ...s, scenes: s.scenes.map((x, i) => (i === scene ? { ...current, steps: appendRecorded(current.steps, event.step) } : x)) })
          if (event.warning) warn(event.warning)
        } else if (event.kind === 'mask') {
          change({ ...s, mask: [...(s.mask ?? []), event.target] })
        } else if (event.kind === 'scene') {
          change({ ...s, scenes: [...s.scenes, { say: '', steps: [] }] })
          sceneRef.current = s.scenes.length
          setRecording((r) => r && { ...r, scene: s.scenes.length })
        }
      }),
    [scenarioRef, change, flush, toast],
  )

  return {
    recording,
    start: (scene: number) => {
      sceneRef.current = scene
      setRecording({ scene, ready: false, warnings: [] })
    },
    stop: () => {
      sceneRef.current = undefined
      setRecording(undefined)
    },
  }
}

function VoiceModelRow({ voice }: { voice: ReturnType<typeof useVoiceModel> }) {
  const { model, progress, downloading, download } = voice
  return (
    <div className={`session ${model?.ready ? 'ok' : ''}`}>
      <Icon name="speaker" />
      <div>
        <b>{model?.ready ? '음성 모델 준비됨' : '음성 모델 필요'}</b>
        <span className="muted">
          {model?.ready
            ? '내레이션을 이 Mac에서 만듭니다'
            : progress
              ? `받는 중 ${progress.index + 1}/${progress.count} · ${Math.round(progress.loaded / 1e6)}MB`
              : '내레이션용, 한 번만 받습니다 (약 90MB)'}
        </span>
      </div>
      {!model?.ready && (
        <button className="button small" onClick={download} disabled={downloading}>
          {downloading ? '받는 중…' : '받기'}
        </button>
      )}
    </div>
  )
}

function VideoList({
  videos,
  loadError,
  selected,
  disabled,
  onSelect,
}: {
  videos?: VideoInfo[]
  loadError: string
  selected?: string
  disabled: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div className="shot-list video-list">
      {loadError && <p className="form-error">{loadError}</p>}
      {!videos && !loadError && <p className="muted">영상 목록을 읽는 중…</p>}
      {videos && !videos.length && <p className="empty">아직 영상이 없습니다. [새 영상]으로 시작하세요.</p>}
      {videos?.map((v) => (
        <button
          key={v.id}
          className={`video-item ${v.id === selected ? 'active' : ''}`}
          onClick={() => onSelect(v.id)}
          disabled={disabled}
          title={v.error ?? (v.sections.join('\n') || v.id)}
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
  )
}

function RecordingBar({ recording }: { recording: Recording }) {
  return (
    <div className="recording-bar">
      <span className="rec-dot" />
      <div>
        <b>{recording.ready ? `STG 창에서 조작하면 장면 ${recording.scene + 1}에 단계가 붙습니다` : '앞 단계를 재생하는 중…'}</b>
        <span className="muted">Chrome 창 오른쪽 아래 막대에서 강조할 곳·가릴 곳·기다릴 글자를 고르거나 새 장면을 시작합니다.</span>
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
  )
}

// 미리보기(이 패널) 또는 영상 만들기(tasks) 진행. other: 다른 영상을 만드는 중
function RunProgress({ progress, rendering, other }: { progress?: VideoProgress; rendering?: VideoTask; other: boolean }) {
  return (
    <div className="video-progress">
      <Progress>
        <span className="ellipsis">
          {other && rendering ? `"${rendering.title}" · ` : ''}
          {progress ? `${STAGE[progress.stage]} · ${progress.message}` : '시작하는 중…'}
          {progress?.step !== undefined ? ` · 단계 ${progress.step + 1}` : ''}
        </span>
      </Progress>
      <button className="button small" onClick={() => void api.video.cancel()}>
        <Icon name="stop" /> 멈춤
      </button>
    </div>
  )
}

function RunResult({ failure, blocked }: { failure?: Failure; blocked: string[] }) {
  return (
    <>
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
    </>
  )
}

function VideoPlayer({ info }: { info: VideoInfo }) {
  if (!info.output) {
    return (
      <div className="empty-state small">
        <Icon name="video" size={28} />
        <p>아직 만든 영상이 없습니다. [영상 만들기]를 누르세요.</p>
      </div>
    )
  }
  const { output } = info
  return (
    <div className="video-player">
      <video key={output.updatedAt} controls src={assetUrl(output.mp4, output.updatedAt)} crossOrigin="anonymous">
        <track kind="subtitles" srcLang="en" label="English" src={assetUrl(output.vtt, output.updatedAt)} />
      </video>
      <div className="video-meta">
        <span className="muted">
          {new Date(output.updatedAt).toLocaleString()} · {(output.size / 1e6).toFixed(1)}MB
        </span>
        <button className="button small" onClick={() => void api.workspace.reveal(output.mp4)}>
          <Icon name="folder" /> Finder에서 보기
        </button>
      </div>
    </div>
  )
}
