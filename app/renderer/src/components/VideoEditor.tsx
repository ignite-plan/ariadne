// 가이드 영상 장면 편집기. 기본 정보, 장면(내레이션 + 단계), 정리 단계, 가릴 곳을 고친다.
// 바뀔 때마다 onChange로 넘기고 저장은 VideoPanel이 한다
import { useEffect, useState } from 'react'
import { describeStep, describeTarget } from '../../../../src/core/video/describe.ts'
import { SPEED_CHOICES } from '../../../../src/core/video/edit.ts'
import { assetUrl, type ManualTree, type VideoScenario, type VideoScene, type VideoStep, type VideoTarget } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { Icon } from './Icon.tsx'
import { SectionsSelect } from './SectionSelect.tsx'
import { useToast } from './Toast.tsx'
import { MaskDialog, StepDialog } from './VideoStepDialog.tsx'

export interface EditorFailure {
  scene?: number | 'cleanup'
  step?: number
}

type Where = number | 'cleanup'

function move<T>(list: T[], index: number, delta: number) {
  const next = [...list]
  const to = index + delta
  if (to < 0 || to >= next.length) return next
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

function replace<T>(list: T[], index: number, value: T) {
  return list.map((v, i) => (i === index ? value : v))
}

// 음성 듣기: 한 문장을 시나리오의 내레이션 속도로 만들어 재생한다
function useSpeak(speed?: number) {
  const toast = useToast()
  const [speaking, setSpeaking] = useState<string>()
  const speak = async (text: string) => {
    if (!text.trim()) return
    setSpeaking(text)
    try {
      const clip = await api.video.speak(text, speed)
      const audio = new Audio(assetUrl(clip.path))
      await audio.play()
      await new Promise((resolve) => audio.addEventListener('ended', resolve, { once: true }))
    } catch (e) {
      toast.error(e)
    } finally {
      setSpeaking(undefined)
    }
  }
  return { speaking, speak }
}

export function VideoEditor({
  scenario,
  onChange,
  tree,
  disabled,
  voiceReady,
  failure,
  currentScene,
  recordingScene,
  onPreviewFrom,
  onRecord,
  onClaudeScene,
}: {
  scenario: VideoScenario
  onChange: (next: VideoScenario) => void
  tree?: ManualTree
  disabled?: boolean
  voiceReady?: boolean
  failure?: EditorFailure
  currentScene?: number
  // STG에서 기록 중인 장면
  recordingScene?: number
  // 없으면 [여기부터 미리보기]를 끈다 (다른 STG 작업 중)
  onPreviewFrom?: (scene: number) => void
  onRecord?: (scene: number) => void
  // 이 장면을 Claude로 채운다 (요청을 묻는 창은 VideoPanel이 연다)
  onClaudeScene?: (scene: number) => void
}) {
  const { speaking, speak } = useSpeak(scenario.speed)
  const [editing, setEditing] = useState<{ where: Where; index?: number; step?: VideoStep }>()
  const [maskEditing, setMaskEditing] = useState<{ index?: number; target?: VideoTarget }>()

  // 기록 중인 장면과 새로 붙은 단계가 보이게 한다
  const recordedSteps = recordingScene === undefined ? 0 : (scenario.scenes[recordingScene]?.steps.length ?? 0)
  useEffect(() => {
    if (recordingScene === undefined) return
    document.querySelector('.scene.recording')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [recordingScene, recordedSteps])

  const set = (patch: Partial<VideoScenario>) => onChange({ ...scenario, ...patch })
  const setScene = (index: number, patch: Partial<VideoScene>) => set({ scenes: replace(scenario.scenes, index, { ...scenario.scenes[index], ...patch }) })
  const stepsOf = (where: Where) => (where === 'cleanup' ? (scenario.cleanup ?? []) : scenario.scenes[where].steps)
  const setSteps = (where: Where, steps: VideoStep[]) => (where === 'cleanup' ? set({ cleanup: steps.length ? steps : undefined }) : setScene(where, { steps }))
  const setMask = (mask: VideoTarget[]) => set({ mask: mask.length ? mask : undefined })

  const saveStep = (step: VideoStep) => {
    if (!editing) return
    const steps = stepsOf(editing.where)
    setSteps(editing.where, editing.index === undefined ? [...steps, step] : replace(steps, editing.index, step))
    setEditing(undefined)
  }

  const speakButton = (text: string | undefined) => {
    const active = speaking !== undefined && speaking === text
    return (
      <button
        className="icon-button small"
        title={voiceReady ? '음성 듣기' : '음성 모델을 받아야 들을 수 있습니다'}
        disabled={!voiceReady || !text?.trim() || Boolean(speaking)}
        onClick={() => void speak(text ?? '')}
      >
        <Icon name={active ? 'sync' : 'speaker'} className={active ? 'spin' : ''} />
      </button>
    )
  }

  const stepList = (where: Where) => {
    const steps = stepsOf(where)
    return (
      <ul className="video-steps">
        {steps.map((step, j) => (
          <ItemRow
            key={j}
            text={describeStep(step)}
            failed={failure?.scene === where && failure.step === j}
            disabled={disabled}
            onEdit={() => setEditing({ where, index: j, step })}
            onUp={j > 0 ? () => setSteps(where, move(steps, j, -1)) : null}
            onDown={j < steps.length - 1 ? () => setSteps(where, move(steps, j, 1)) : null}
            onRemove={() => setSteps(where, steps.filter((_, k) => k !== j))}
            removeTitle="단계 삭제"
          />
        ))}
        {!steps.length && <li className="empty-step muted">단계가 없습니다</li>}
      </ul>
    )
  }

  return (
    <div className="video-editor">
      <section className="scene intro">
        <div className="editor-grid top">
          <label className="field">
            <span>영상 제목 (영어, 시작 카드)</span>
            <input value={scenario.title} disabled={disabled} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <div className="field">
            <span>연결할 화면 (여러 개면 이 순서로 보여 줍니다)</span>
            <SectionsSelect
              tree={tree}
              value={scenario.sections ?? []}
              disabled={disabled}
              onChange={(paths) => set({ sections: paths.length ? paths : undefined })}
            />
          </div>
        </div>
        <label className="field">
          <span>시작 카드 내레이션 (선택)</span>
          <div className="say-row">
            <textarea
              rows={2}
              value={scenario.intro ?? ''}
              disabled={disabled}
              placeholder="This video shows how to …"
              onChange={(e) => set({ intro: e.target.value || undefined })}
            />
            {speakButton(scenario.intro)}
          </div>
        </label>
        <StyleFields scenario={scenario} disabled={disabled} set={set} />
        <div className="editor-checks">
          <label>
            <input type="checkbox" checked={Boolean(scenario.maskPersonal)} disabled={disabled} onChange={(e) => set({ maskPersonal: e.target.checked || undefined })} />
            이메일·전화번호 가리기
          </label>
          <label>
            <input type="checkbox" checked={Boolean(scenario.maskSystem)} disabled={disabled} onChange={(e) => set({ maskSystem: e.target.checked || undefined })} />
            시스템 이름·법인/대리점 가리기
          </label>
          <label>
            <input type="checkbox" checked={Boolean(scenario.mutates)} disabled={disabled} onChange={(e) => set({ mutates: e.target.checked || undefined })} />
            STG에 실제 저장 허용
          </label>
        </div>
        {scenario.mutates && (
          <p className="notice">
            저장·삭제 버튼을 실제로 누릅니다. 입력값에 <code>Video Test {'{stamp}'}</code>처럼 테스트 데이터임을 알 수 있는 이름을 쓰고, 아래 정리 단계에서 만든 데이터를
            지우세요. <code>{'{stamp}'}</code>는 실행 시각으로 바뀝니다.
          </p>
        )}
      </section>

      <ol className="scene-list">
        {scenario.scenes.map((scene, i) => (
          <li
            key={i}
            className={`scene ${failure?.scene === i ? 'failed' : ''} ${currentScene === i ? 'current' : ''} ${recordingScene === i ? 'recording' : ''}`}
          >
            <div className="scene-head">
              <b>장면 {i + 1}</b>
              <span className="spacer" />
              <button
                className="button small ghost"
                disabled={disabled || !onPreviewFrom}
                onClick={() => onPreviewFrom?.(i)}
                title={onPreviewFrom ? '앞 장면은 빠르게 재생하고 이 장면부터 화면을 띄워 봅니다' : '다른 STG 작업이 끝난 뒤 미리보기를 할 수 있습니다'}
              >
                <Icon name="play" /> 여기부터 미리보기
              </button>
              {onClaudeScene && (
                <button className="button small ghost" disabled={disabled} onClick={() => onClaudeScene(i)} title="보여 줄 내용을 적으면 Claude가 STG를 보고 이 장면만 채웁니다">
                  <Icon name="sparkle" /> Claude로 이 장면
                </button>
              )}
              {onRecord && (
                <button className="button small ghost" disabled={disabled} onClick={() => onRecord(i)} title="STG에서 직접 조작해 이 장면에 단계를 붙입니다">
                  <Icon name="record" /> STG에서 기록
                </button>
              )}
              <button className="icon-button small" title="위로" disabled={disabled || i === 0} onClick={() => set({ scenes: move(scenario.scenes, i, -1) })}>
                <Icon name="up" />
              </button>
              <button
                className="icon-button small"
                title="아래로"
                disabled={disabled || i === scenario.scenes.length - 1}
                onClick={() => set({ scenes: move(scenario.scenes, i, 1) })}
              >
                <Icon name="down" />
              </button>
              <button
                className="icon-button small"
                title="장면 삭제"
                disabled={disabled || scenario.scenes.length === 1}
                onClick={() => set({ scenes: scenario.scenes.filter((_, k) => k !== i) })}
              >
                <Icon name="trash" />
              </button>
            </div>
            <div className="say-row">
              <textarea
                rows={2}
                value={scene.say ?? ''}
                disabled={disabled}
                placeholder="내레이션 (영어). 자막으로도 나옵니다"
                onChange={(e) => setScene(i, { say: e.target.value })}
              />
              {speakButton(scene.say)}
            </div>
            {scene.caption !== undefined ? (
              <div className="say-row">
                <input value={scene.caption} disabled={disabled} placeholder="화면 자막 (짧게)" onChange={(e) => setScene(i, { caption: e.target.value })} />
                <button className="icon-button small" title="화면 자막 따로 쓰지 않기" disabled={disabled} onClick={() => setScene(i, { caption: undefined })}>
                  <Icon name="x" />
                </button>
              </div>
            ) : (
              <button className="link small" disabled={disabled} onClick={() => setScene(i, { caption: scene.say ?? '' })}>
                화면 자막을 따로 쓰기
              </button>
            )}
            {stepList(i)}
            <button className="button small" disabled={disabled} onClick={() => setEditing({ where: i })}>
              <Icon name="plus" /> 단계
            </button>
          </li>
        ))}
      </ol>
      <button className="button" disabled={disabled} onClick={() => set({ scenes: [...scenario.scenes, { say: '', steps: [] }] })}>
        <Icon name="plus" /> 장면 추가
      </button>

      {(scenario.mutates || scenario.cleanup?.length) && (
        <section className={`scene intro ${failure?.scene === 'cleanup' ? 'failed' : ''}`}>
          <div className="scene-head">
            <b>정리 단계</b>
            <span className="muted">녹화가 끝난 뒤 실행합니다. 영상에는 나오지 않습니다</span>
          </div>
          {stepList('cleanup')}
          <button className="button small" disabled={disabled} onClick={() => setEditing({ where: 'cleanup' })}>
            <Icon name="plus" /> 단계
          </button>
        </section>
      )}

      <section className="scene intro">
        <div className="scene-head">
          <b>가릴 곳</b>
          <span className="muted">영상에서 흐리게 처리할 요소</span>
        </div>
        <ul className="video-steps">
          {(scenario.mask ?? []).map((target, j) => (
            <ItemRow
              key={j}
              text={describeTarget(target)}
              disabled={disabled}
              onEdit={() => setMaskEditing({ index: j, target })}
              onRemove={() => setMask((scenario.mask ?? []).filter((_, k) => k !== j))}
              removeTitle="삭제"
            />
          ))}
          {!scenario.mask?.length && <li className="empty-step muted">없음</li>}
        </ul>
        <button className="button small" disabled={disabled} onClick={() => setMaskEditing({})}>
          <Icon name="plus" /> 가릴 곳
        </button>
      </section>

      {editing && <StepDialog step={editing.step} onClose={() => setEditing(undefined)} onSave={saveStep} />}
      {maskEditing && (
        <MaskDialog
          target={maskEditing.target}
          onClose={() => setMaskEditing(undefined)}
          onSave={(target) => {
            const mask = scenario.mask ?? []
            setMask(maskEditing.index === undefined ? [...mask, target] : replace(mask, maskEditing.index, target))
            setMaskEditing(undefined)
          }}
        />
      )}
    </div>
  )
}

// 자막 크기, 내레이션 속도, 조작 속도
function StyleFields({ scenario, disabled, set }: { scenario: VideoScenario; disabled?: boolean; set: (patch: Partial<VideoScenario>) => void }) {
  return (
    <div className="editor-grid three">
      <label className="field">
        <span>자막 크기</span>
        <select
          value={scenario.captionSize ?? ''}
          disabled={disabled}
          onChange={(e) => set({ captionSize: (e.target.value || undefined) as VideoScenario['captionSize'] })}
        >
          <option value="">기본 (매뉴얼 설정)</option>
          <option value="small">작게</option>
          <option value="medium">보통</option>
          <option value="large">크게</option>
        </select>
      </label>
      <label className="field">
        <span>내레이션 속도</span>
        <select value={scenario.speed ?? ''} disabled={disabled} onChange={(e) => set({ speed: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">기본 (매뉴얼 설정)</option>
          {SPEED_CHOICES.map((s) => (
            <option key={s} value={s}>
              {s.toFixed(1)}×{s === 1 ? ' (보통)' : s < 1 ? ' (느리게)' : ' (빠르게)'}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>조작 속도 (커서·입력·강조·쉬는 시간)</span>
        <select value={scenario.pace ?? ''} disabled={disabled} onChange={(e) => set({ pace: (e.target.value || undefined) as VideoScenario['pace'] })}>
          <option value="">보통</option>
          <option value="slow">느리게</option>
          <option value="fast">빠르게</option>
        </select>
      </label>
    </div>
  )
}

// 단계·가릴 곳 목록 한 줄: 설명과 고치기·순서·삭제. onUp/onDown이 null이면 끝이라 끈 버튼, undefined면 버튼 없음
function ItemRow({
  text,
  failed,
  disabled,
  onEdit,
  onUp,
  onDown,
  onRemove,
  removeTitle,
}: {
  text: string
  failed?: boolean
  disabled?: boolean
  onEdit: () => void
  onUp?: (() => void) | null
  onDown?: (() => void) | null
  onRemove: () => void
  removeTitle: string
}) {
  return (
    <li className={failed ? 'failed' : ''}>
      <span className="step-text">{text}</span>
      <span className="step-actions">
        <button className="icon-button small" title="고치기" disabled={disabled} onClick={onEdit}>
          <Icon name="settings" />
        </button>
        {onUp !== undefined && (
          <button className="icon-button small" title="위로" disabled={disabled || !onUp} onClick={() => onUp?.()}>
            <Icon name="up" />
          </button>
        )}
        {onDown !== undefined && (
          <button className="icon-button small" title="아래로" disabled={disabled || !onDown} onClick={() => onDown?.()}>
            <Icon name="down" />
          </button>
        )}
        <button className="icon-button small" title={removeTitle} disabled={disabled} onClick={onRemove}>
          <Icon name="x" />
        </button>
      </span>
    </li>
  )
}
