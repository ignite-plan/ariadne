import { useEffect, useMemo, useState } from 'react'
import type { DocxAnalysis, ImportProgress, ManualInfo } from '../../../shared/api.ts'
import { ID_PATTERN, ID_RULE } from '../../../../src/core/naming.ts'
import { CODE_PRESETS, suggestManualId, VIEWPORTS, type ViewportKey } from '../../../shared/presets.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'

type Step = 'pick' | 'review' | 'importing'

const PHASE_LABEL: Record<ImportProgress['phase'], string> = {
  convert: 'Word 변환 중',
  write: '화면 파일 만드는 중',
  images: '이미지 옮기는 중',
  reference: 'Word 서식 추출 중',
}

// Word 원본 → 새 매뉴얼. 분석(아무것도 쓰지 않음) → 정보 확인 → 가져오기
export function ImportWizard({ onDone, onClose }: { onDone: (id: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick')
  const [docx, setDocx] = useState('')
  const [analysis, setAnalysis] = useState<DocxAnalysis>()
  const [manuals, setManuals] = useState<ManualInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<ImportProgress>()

  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [version, setVersion] = useState('')
  const [output, setOutput] = useState('')
  const [outputTouched, setOutputTouched] = useState(false)
  const [app, setApp] = useState(CODE_PRESETS[0].app)
  const [baseUrl, setBaseUrl] = useState(CODE_PRESETS[0].baseUrl)
  const [viewport, setViewport] = useState<ViewportKey>('desktop')
  const [keepSource, setKeepSource] = useState(true)

  useEffect(() => {
    void api.manual.list().then(setManuals)
    return api.on('import-progress', setProgress)
  }, [])

  const taken = useMemo(() => manuals.map((m) => m.id), [manuals])

  useEffect(() => {
    if (!idTouched && title) setId(suggestManualId(title, taken))
  }, [title, idTouched, taken])
  useEffect(() => {
    if (!outputTouched && title) setOutput(`${title}_v{version}`)
  }, [title, outputTouched])

  const pick = async () => {
    const path = await api.manual.pickDocx()
    if (!path) return
    setDocx(path)
    setBusy(true)
    setError('')
    try {
      const result = await api.manual.analyzeDocx(path)
      setAnalysis(result)
      setTitle(result.title)
      setVersion(result.version)
      setStep('review')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const choosePreset = (next: string) => {
    setApp(next)
    const preset = CODE_PRESETS.find((p) => p.app === next)
    if (preset) setBaseUrl(preset.baseUrl)
  }

  const idError = !ID_PATTERN.test(id)
    ? ID_RULE
    : taken.includes(id)
      ? '이미 있는 id입니다'
      : ''
  const ready = analysis && title.trim() && version.trim() && !idError

  const run = async () => {
    setStep('importing')
    setError('')
    try {
      const vp = VIEWPORTS[viewport]
      const created = await api.manual.importDocx({
        docx,
        id,
        title,
        version,
        output,
        capture: { baseUrl, viewport: { width: vp.width, height: vp.height } },
        code: app ? { app } : undefined,
        keepSource,
      })
      onDone(created)
    } catch (e) {
      setError(errorMessage(e))
      setStep('review')
    }
  }

  const sectionCount = analysis?.chapters.reduce((n, c) => n + c.sections.length + (c.hasIntro ? 1 : 0), 0) ?? 0
  const percent =
    progress?.phase === 'images' && progress.total ? Math.round(((progress.done ?? 0) / progress.total) * 100) : undefined

  return (
    <Modal
      title="새 매뉴얼 가져오기"
      onClose={onClose}
      dismissible={step !== 'importing'}
      width={step === 'pick' ? 520 : 920}
      footer={
        step === 'review' ? (
          <>
            {error && <span className="form-error inline">{error}</span>}
            <button className="button" onClick={() => setStep('pick')}>
              다른 파일
            </button>
            <button className="button primary" disabled={!ready} onClick={run}>
              가져오기
            </button>
          </>
        ) : undefined
      }
    >
      {step === 'pick' && (
        <div className="import-pick">
          <Icon name="word" size={36} />
          <p>
            BO 매뉴얼과 같은 형식의 Word 원본을 고르세요.
            <br />
            <span className="muted">목차(1. 장 제목, • 화면 제목)로 장과 화면을 나눕니다. 고르기만 해서는 아무것도 바뀌지 않습니다.</span>
          </p>
          <button className="button primary" onClick={pick} disabled={busy}>
            {busy ? '분석 중…' : 'Word 파일 고르기…'}
          </button>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}

      {step !== 'pick' && analysis && (
        <div className="import-review">
          <section className="import-outline">
            <div className="import-file">
              <Icon name="word" size={14} /> <span className="ellipsis">{docx.split('/').pop()}</span>
            </div>
            <div className="import-stats">
              <span className="pill">{analysis.chapters.length}장</span>
              <span className="pill">화면 {sectionCount}개</span>
              <span className="pill">이미지 {analysis.images}장</span>
              <span className="pill">{analysis.structure === 'toc' ? '목차 기준' : '제목 스타일 기준'}</span>
            </div>
            {analysis.warnings.length > 0 && (
              <ul className="import-warnings">
                {analysis.warnings.map((w) => (
                  <li key={w}>
                    <Icon name="alert" size={13} /> {w}
                  </li>
                ))}
              </ul>
            )}
            <ol className="import-chapters">
              {analysis.chapters.map((c) => (
                <li key={c.no}>
                  <b>
                    {c.no}. {c.title}
                  </b>
                  <ul>
                    {c.hasIntro && <li className="muted">(장 소개)</li>}
                    {c.sections.map((s) => (
                      <li key={s.slug}>
                        <span className="ellipsis">{s.title}</span>
                        {s.images > 0 && <span className="muted">🖼 {s.images}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          <section className="import-form">
            <label className="field">
              <span>매뉴얼 제목</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={step === 'importing'} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>id (폴더 이름)</span>
                <input
                  value={id}
                  onChange={(e) => {
                    setIdTouched(true)
                    setId(e.target.value)
                  }}
                  disabled={step === 'importing'}
                />
                {idError && <em className="field-error">{idError}</em>}
              </label>
              <label className="field">
                <span>버전</span>
                <input value={version} onChange={(e) => setVersion(e.target.value)} disabled={step === 'importing'} />
              </label>
            </div>
            <label className="field">
              <span>Word 파일 이름 ({'{version}'}은 버전으로 바뀜)</span>
              <input
                value={output}
                onChange={(e) => {
                  setOutputTouched(true)
                  setOutput(e.target.value)
                }}
                disabled={step === 'importing'}
              />
            </label>
            <label className="field">
              <span>화면(코드) 연결</span>
              <select value={app} onChange={(e) => choosePreset(e.target.value)} disabled={step === 'importing'}>
                {CODE_PRESETS.map((p) => (
                  <option key={p.app} value={p.app}>
                    {p.label}
                  </option>
                ))}
                <option value="">연결 안 함</option>
              </select>
            </label>
            <label className="field">
              <span>캡처 주소 (STG)</span>
              <input
                value={baseUrl}
                placeholder="https://stg-…"
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={step === 'importing'}
              />
            </label>
            <div className="field">
              <span>캡처 화면 크기</span>
              <div className="segmented small">
                {(Object.keys(VIEWPORTS) as ViewportKey[]).map((k) => (
                  <button key={k} className={viewport === k ? 'active' : ''} onClick={() => setViewport(k)} disabled={step === 'importing'}>
                    {VIEWPORTS[k].label}
                  </button>
                ))}
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={keepSource} onChange={(e) => setKeepSource(e.target.checked)} disabled={step === 'importing'} />
              원본 Word도 함께 보관 (나중에 서식을 다시 뽑을 때 필요)
            </label>

            {step === 'importing' && (
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{ width: `${percent ?? 20}%` }}
                  data-indeterminate={percent === undefined}
                />
                <span>
                  {progress ? PHASE_LABEL[progress.phase] : '준비 중'} {percent !== undefined ? `${progress?.done}/${progress?.total}` : ''}
                </span>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
