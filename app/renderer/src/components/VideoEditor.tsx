// 가이드 영상 장면 편집기. 기본 정보, 장면(내레이션 + 단계), 정리 단계, 가릴 곳을 고친다.
// 바뀔 때마다 onChange로 넘기고 저장은 VideoPanel이 한다
import { useState } from 'react'
import { describeStep, describeTarget, ROLE_NAMES } from '../../../../src/core/video/describe.ts'
import { assetUrl, type ManualTree, type VideoScenario, type VideoScene, type VideoStep, type VideoTarget } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'

export interface EditorFailure {
  scene?: number | 'cleanup'
  step?: number
}

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

// 음성 듣기: 한 문장을 만들어 재생한다
function useSpeak() {
  const toast = useToast()
  const [speaking, setSpeaking] = useState<string>()
  const speak = async (text: string) => {
    if (!text.trim()) return
    setSpeaking(text)
    try {
      const clip = await api.video.speak(text)
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
  onPreviewFrom: (scene: number) => void
  onRecord?: (scene: number) => void
}) {
  const { speaking, speak } = useSpeak()
  const [editing, setEditing] = useState<{ where: number | 'cleanup'; index?: number; step?: VideoStep }>()
  const [maskEditing, setMaskEditing] = useState<{ index?: number; target?: VideoTarget }>()

  const set = (patch: Partial<VideoScenario>) => onChange({ ...scenario, ...patch })
  const setScene = (index: number, patch: Partial<VideoScene>) =>
    set({ scenes: replace(scenario.scenes, index, { ...scenario.scenes[index], ...patch }) })
  const stepsOf = (where: number | 'cleanup') => (where === 'cleanup' ? (scenario.cleanup ?? []) : scenario.scenes[where].steps)
  const setSteps = (where: number | 'cleanup', steps: VideoStep[]) =>
    where === 'cleanup' ? set({ cleanup: steps.length ? steps : undefined }) : setScene(where, { steps })

  const saveStep = (step: VideoStep) => {
    if (!editing) return
    const steps = stepsOf(editing.where)
    setSteps(editing.where, editing.index === undefined ? [...steps, step] : replace(steps, editing.index, step))
    setEditing(undefined)
  }

  const speakButton = (text: string | undefined) => (
    <button
      className="icon-button small"
      title={voiceReady ? '음성 듣기' : '음성 모델을 받아야 들을 수 있습니다'}
      disabled={!voiceReady || !text?.trim() || Boolean(speaking)}
      onClick={() => void speak(text ?? '')}
    >
      <Icon name={speaking !== undefined && speaking === text ? 'sync' : 'speaker'} className={speaking !== undefined && speaking === text ? 'spin' : ''} />
    </button>
  )

  const stepList = (where: number | 'cleanup') => {
    const steps = stepsOf(where)
    return (
      <ul className="video-steps">
        {steps.map((step, j) => (
          <li key={j} className={failure?.scene === where && failure.step === j ? 'failed' : ''}>
            <span className="step-text">{describeStep(step)}</span>
            <span className="step-actions">
              <button className="icon-button small" title="고치기" disabled={disabled} onClick={() => setEditing({ where, index: j, step })}>
                <Icon name="settings" />
              </button>
              <button className="icon-button small" title="위로" disabled={disabled || j === 0} onClick={() => setSteps(where, move(steps, j, -1))}>
                <Icon name="up" />
              </button>
              <button
                className="icon-button small"
                title="아래로"
                disabled={disabled || j === steps.length - 1}
                onClick={() => setSteps(where, move(steps, j, 1))}
              >
                <Icon name="down" />
              </button>
              <button className="icon-button small" title="단계 삭제" disabled={disabled} onClick={() => setSteps(where, steps.filter((_, k) => k !== j))}>
                <Icon name="x" />
              </button>
            </span>
          </li>
        ))}
        {!steps.length && <li className="empty-step muted">단계가 없습니다</li>}
      </ul>
    )
  }

  return (
    <div className="video-editor">
      <section className="scene intro">
        <div className="editor-grid">
          <label className="field">
            <span>영상 제목 (영어, 시작 카드)</span>
            <input value={scenario.title} disabled={disabled} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="field">
            <span>연결할 화면</span>
            <select value={scenario.section ?? ''} disabled={disabled} onChange={(e) => set({ section: e.target.value || undefined })}>
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
        <div className="editor-checks">
          <label>
            <input type="checkbox" checked={Boolean(scenario.maskPersonal)} disabled={disabled} onChange={(e) => set({ maskPersonal: e.target.checked || undefined })} />
            이메일·전화번호 가리기
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
              <button className="button small ghost" disabled={disabled} onClick={() => onPreviewFrom(i)} title="앞 장면은 빠르게 재생하고 이 장면부터 화면을 띄워 봅니다">
                <Icon name="play" /> 여기부터 미리보기
              </button>
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
                <input
                  value={scene.caption}
                  disabled={disabled}
                  placeholder="화면 자막 (짧게)"
                  onChange={(e) => setScene(i, { caption: e.target.value })}
                />
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
            <li key={j}>
              <span className="step-text">{describeTarget(target)}</span>
              <span className="step-actions">
                <button className="icon-button small" title="고치기" disabled={disabled} onClick={() => setMaskEditing({ index: j, target })}>
                  <Icon name="settings" />
                </button>
                <button
                  className="icon-button small"
                  title="삭제"
                  disabled={disabled}
                  onClick={() => {
                    const mask = (scenario.mask ?? []).filter((_, k) => k !== j)
                    set({ mask: mask.length ? mask : undefined })
                  }}
                >
                  <Icon name="x" />
                </button>
              </span>
            </li>
          ))}
          {!scenario.mask?.length && <li className="empty-step muted">없음</li>}
        </ul>
        <button className="button small" disabled={disabled} onClick={() => setMaskEditing({})}>
          <Icon name="plus" /> 가릴 곳
        </button>
      </section>

      {editing && <StepDialog step={editing.step} onClose={() => setEditing(undefined)} onSave={saveStep} />}
      {maskEditing && (
        <Modal title="가릴 곳" onClose={() => setMaskEditing(undefined)} width={520}>
          <TargetDialogBody
            target={maskEditing.target}
            onCancel={() => setMaskEditing(undefined)}
            onSave={(target) => {
              const mask = scenario.mask ?? []
              set({ mask: maskEditing.index === undefined ? [...mask, target] : replace(mask, maskEditing.index, target) })
              setMaskEditing(undefined)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

// ── 단계 편집 ──────────────────────────────────────────────

type StepKind = 'open' | 'waitFor' | 'click' | 'type' | 'choose' | 'select' | 'highlight' | 'hover' | 'scroll' | 'pause'

const STEP_KINDS: { kind: StepKind; label: string }[] = [
  { kind: 'open', label: '화면 열기' },
  { kind: 'waitFor', label: '보일 때까지 기다리기' },
  { kind: 'click', label: '클릭' },
  { kind: 'type', label: '입력' },
  { kind: 'choose', label: '선택 상자에서 고르기' },
  { kind: 'highlight', label: '강조 (누르지 않음)' },
  { kind: 'hover', label: '마우스 올리기' },
  { kind: 'scroll', label: '스크롤' },
  { kind: 'pause', label: '잠깐 멈춤' },
  { kind: 'select', label: '목록 상자에서 고르기 (기본 select)' },
]

function kindOf(step?: VideoStep): StepKind {
  return step ? (Object.keys(step)[0] as StepKind) : 'click'
}

function targetOf(step?: VideoStep): VideoTarget | undefined {
  if (!step) return undefined
  if ('waitFor' in step) return step.waitFor
  if ('click' in step) return step.click
  if ('hover' in step) return step.hover
  if ('scroll' in step) return step.scroll
  if ('type' in step) return step.type.target
  if ('choose' in step) return step.choose.target
  if ('select' in step) return step.select.target
  if ('highlight' in step) return step.highlight.target
  return undefined
}

function StepDialog({ step, onClose, onSave }: { step?: VideoStep; onClose: () => void; onSave: (step: VideoStep) => void }) {
  const [kind, setKind] = useState<StepKind>(kindOf(step))
  const [target, setTarget] = useState<VideoTarget>(targetOf(step) ?? { role: 'button', name: '' })
  const [path, setPath] = useState(step && 'open' in step ? step.open : '/')
  const [text, setText] = useState(
    step && 'type' in step ? step.type.text : step && 'choose' in step ? step.choose.option : step && 'select' in step ? step.select.value : '',
  )
  const [seconds, setSeconds] = useState(
    step && 'pause' in step ? step.pause / 1000 : step && 'highlight' in step && step.highlight.ms ? step.highlight.ms / 1000 : 1.5,
  )

  const needsTarget = kind !== 'open' && kind !== 'pause'
  const valid =
    (kind === 'open' ? path.trim().length > 0 : true) &&
    (needsTarget ? targetValid(target) : true) &&
    (kind === 'choose' || kind === 'select' ? text.trim().length > 0 : true) &&
    (kind === 'pause' || kind === 'highlight' ? seconds > 0 : true)

  const build = (): VideoStep => {
    const t = cleanTarget(target)
    const ms = Math.round(seconds * 1000)
    switch (kind) {
      case 'open':
        return { open: path.trim() }
      case 'pause':
        return { pause: ms }
      case 'waitFor':
        return { waitFor: t }
      case 'click':
        return { click: t }
      case 'hover':
        return { hover: t }
      case 'scroll':
        return { scroll: t }
      case 'type':
        return { type: { target: t, text } }
      case 'choose':
        return { choose: { target: t, option: text.trim() } }
      case 'select':
        return { select: { target: t, value: text.trim() } }
      case 'highlight':
        return { highlight: { target: t, ms } }
    }
  }

  return (
    <Modal title={step ? '단계 고치기' : '단계 추가'} onClose={onClose} width={560}>
      <label className="field">
        <span>할 일</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as StepKind)}>
          {STEP_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {kind === 'open' && (
        <label className="field">
          <span>화면 주소 (STG 주소 뒤 경로, 예: /dealer/company)</span>
          <input value={path} onChange={(e) => setPath(e.target.value)} />
        </label>
      )}
      {needsTarget && <TargetFields target={target} onChange={setTarget} />}
      {kind === 'type' && (
        <label className="field">
          <span>입력할 내용 ({'{stamp}'}는 실행 시각으로 바뀝니다)</span>
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      {(kind === 'choose' || kind === 'select') && (
        <label className="field">
          <span>고를 항목 이름 (화면 문구 그대로)</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Active" />
        </label>
      )}
      {(kind === 'pause' || kind === 'highlight') && (
        <label className="field">
          <span>{kind === 'pause' ? '멈출 시간 (초)' : '강조할 시간 (초)'}</span>
          <input type="number" min={0.1} step={0.1} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
        </label>
      )}
      <p className="muted">미리 보기: {valid ? describeStep(build()) : '빈 칸을 채우세요'}</p>
      <div className="actions">
        <button className="button" onClick={onClose}>
          취소
        </button>
        <button className="button primary" disabled={!valid} onClick={() => onSave(build())}>
          {step ? '고치기' : '추가'}
        </button>
      </div>
    </Modal>
  )
}

// ── 대상(Target) ─────────────────────────────────────────

type TargetBy = 'role' | 'text' | 'label' | 'placeholder'

const TARGET_BY: { by: TargetBy; label: string }[] = [
  { by: 'role', label: '종류와 이름 (버튼, 링크, 탭 …)' },
  { by: 'text', label: '화면 글자' },
  { by: 'label', label: '입력칸 이름 (label)' },
  { by: 'placeholder', label: '입력칸 안내 문구 (placeholder)' },
]

function byOf(target: VideoTarget): TargetBy {
  return target.role ? 'role' : target.label ? 'label' : target.placeholder ? 'placeholder' : 'text'
}

function targetValid(target: VideoTarget): boolean {
  const by = byOf(target)
  const own = by === 'role' ? Boolean(target.role) : Boolean(target[by]?.trim())
  return own && (!target.within || targetValid(target.within))
}

// 빈 값과 기본값을 지워 YAML을 짧게 한다
function cleanTarget(target: VideoTarget): VideoTarget {
  const t: VideoTarget = {}
  const by = byOf(target)
  if (by === 'role') {
    t.role = target.role
    if (target.name?.trim()) t.name = target.name.trim()
  } else t[by] = target[by]!.trim()
  if (target.nth) t.nth = target.nth
  if (target.exact) t.exact = true
  if (target.within && targetValid(target.within)) t.within = cleanTarget(target.within)
  return t
}

function TargetFields({ target, onChange, nested }: { target: VideoTarget; onChange: (t: VideoTarget) => void; nested?: boolean }) {
  const by = byOf(target)
  const value = by === 'role' ? (target.name ?? '') : (target[by] ?? '')
  const setBy = (next: TargetBy) => {
    const base: VideoTarget = { nth: target.nth, exact: target.exact, within: target.within }
    onChange(next === 'role' ? { ...base, role: 'button', name: value } : { ...base, [next]: value })
  }
  const setValue = (v: string) => onChange(by === 'role' ? { ...target, name: v } : { ...target, [by]: v })

  return (
    <div className={`target-fields ${nested ? 'nested' : ''}`}>
      <div className="editor-grid">
        <label className="field">
          <span>{nested ? '안쪽을 찾을 요소' : '찾을 요소'}</span>
          <select value={by} onChange={(e) => setBy(e.target.value as TargetBy)}>
            {TARGET_BY.map((t) => (
              <option key={t.by} value={t.by}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {by === 'role' && (
          <label className="field">
            <span>종류</span>
            <select value={target.role} onChange={(e) => onChange({ ...target, role: e.target.value })}>
              {Object.entries(ROLE_NAMES).map(([role, name]) => (
                <option key={role} value={role}>
                  {name} ({role})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="field">
        <span>{by === 'role' ? '이름 (화면 문구 그대로, 비우면 종류만으로 찾음)' : '문구 (화면 그대로)'}</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="editor-grid">
        <label className="field">
          <span>같은 것이 여러 개면 몇 번째</span>
          <input
            type="number"
            min={1}
            value={(target.nth ?? 0) + 1}
            onChange={(e) => onChange({ ...target, nth: Math.max(0, Number(e.target.value) - 1) || undefined })}
          />
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={Boolean(target.exact)} onChange={(e) => onChange({ ...target, exact: e.target.checked || undefined })} />
          문구가 정확히 같을 때만
        </label>
      </div>
      {!nested &&
        (target.within ? (
          <>
            <TargetFields nested target={target.within} onChange={(within) => onChange({ ...target, within })} />
            <button className="link small" onClick={() => onChange({ ...target, within: undefined })}>
              안쪽에서 찾지 않기
            </button>
          </>
        ) : (
          <button className="link small" onClick={() => onChange({ ...target, within: { role: 'row', name: '' } })}>
            특정 행·팝업 안에서만 찾기
          </button>
        ))}
    </div>
  )
}

function TargetDialogBody({ target, onCancel, onSave }: { target?: VideoTarget; onCancel: () => void; onSave: (t: VideoTarget) => void }) {
  const [value, setValue] = useState<VideoTarget>(target ?? { role: 'cell', name: '' })
  return (
    <>
      <TargetFields target={value} onChange={setValue} />
      <p className="muted">미리 보기: {targetValid(value) ? describeTarget(cleanTarget(value)) : '빈 칸을 채우세요'}</p>
      <div className="actions">
        <button className="button" onClick={onCancel}>
          취소
        </button>
        <button className="button primary" disabled={!targetValid(value)} onClick={() => onSave(cleanTarget(value))}>
          저장
        </button>
      </div>
    </>
  )
}
