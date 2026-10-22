// 가이드 영상 단계·가릴 곳 편집 다이얼로그. 입력 규칙은 core video/step-form.ts
import { useState } from 'react'
import { describeStep, describeTarget, ROLE_NAMES } from '../../../../src/core/video/describe.ts'
import {
  buildStep,
  byOf,
  cleanTarget,
  kindOf,
  needsTarget,
  STEP_KINDS,
  stepFields,
  stepValid,
  TARGET_BY,
  targetOf,
  targetValid,
  type StepKind,
  type TargetBy,
} from '../../../../src/core/video/step-form.ts'
import type { VideoStep, VideoTarget } from '../../../shared/api.ts'
import { Modal } from './Modal.tsx'

export function StepDialog({ step, onClose, onSave }: { step?: VideoStep; onClose: () => void; onSave: (step: VideoStep) => void }) {
  const [kind, setKind] = useState<StepKind>(kindOf(step))
  const [target, setTarget] = useState<VideoTarget>(targetOf(step) ?? { role: 'button', name: '' })
  const initial = stepFields(step)
  const [path, setPath] = useState(initial.path)
  const [text, setText] = useState(initial.text)
  const [seconds, setSeconds] = useState(initial.seconds)
  const fields = { path, text, seconds }
  const valid = stepValid(kind, target, fields)

  return (
    <Modal
      title={step ? '단계 고치기' : '단계 추가'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={!valid} onClick={() => onSave(buildStep(kind, target, fields))}>
            {step ? '고치기' : '추가'}
          </button>
        </>
      }
    >
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
      {needsTarget(kind) && <TargetFields target={target} onChange={setTarget} />}
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
      {kind === 'upload' && (
        <label className="field">
          <span>올릴 파일 (매뉴얼 폴더 기준 경로)</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="videos/files/photo.png" />
        </label>
      )}
      {(kind === 'pause' || kind === 'highlight') && (
        <label className="field">
          <span>{kind === 'pause' ? '멈출 시간 (초)' : '강조할 시간 (초)'}</span>
          <input type="number" min={0.1} step={0.1} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
        </label>
      )}
      <p className="muted">미리 보기: {valid ? describeStep(buildStep(kind, target, fields)) : '빈 칸을 채우세요'}</p>
    </Modal>
  )
}

// 영상에서 흐리게 처리할 요소 하나
export function MaskDialog({ target, onClose, onSave }: { target?: VideoTarget; onClose: () => void; onSave: (t: VideoTarget) => void }) {
  const [value, setValue] = useState<VideoTarget>(target ?? { role: 'cell', name: '' })
  return (
    <Modal
      title="가릴 곳"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={!targetValid(value)} onClick={() => onSave(cleanTarget(value))}>
            저장
          </button>
        </>
      }
    >
      <TargetFields target={value} onChange={setValue} />
      <p className="muted">미리 보기: {targetValid(value) ? describeTarget(cleanTarget(value)) : '빈 칸을 채우세요'}</p>
    </Modal>
  )
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
