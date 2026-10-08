import { useEffect, useMemo, useState } from 'react'
import { assetUrl, type ImageInfo } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'

// _template.md 규칙: 전체 화면 6.27in, 팝업 3.4~4.2in, 인라인 아이콘 0.24in
const SIZES = [
  { id: 'full', label: '전체 화면', width: '6.27in', inline: false },
  { id: 'popup', label: '팝업', width: '4.2in', inline: false },
  { id: 'small', label: '작은 팝업', width: '3.4in', inline: false },
  { id: 'icon', label: '아이콘 (문장 안)', width: '0.24in', inline: true },
] as const

export interface PastedImage {
  data: Uint8Array
  previewUrl: string
  name: string
}

export function ImageDialog({
  manual,
  pasted,
  onInsert,
  onClose,
}: {
  manual: string
  pasted?: PastedImage
  onInsert: (markdown: string) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'new' | 'existing'>(pasted ? 'new' : 'existing')
  const [images, setImages] = useState<ImageInfo[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string>()
  const [source, setSource] = useState<{ path?: string; data?: Uint8Array; previewUrl?: string; name: string } | undefined>(
    pasted,
  )
  const [caption, setCaption] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [size, setSize] = useState<(typeof SIZES)[number]['id']>('full')
  const [center, setCenter] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.manual.images().then(setImages)
  }, [])

  // caption에서 id를 제안한다. 직접 고치면 더는 바꾸지 않는다
  useEffect(() => {
    if (mode !== 'new' || idTouched) return
    const handle = setTimeout(() => void api.manual.suggestImageId(caption || source?.name || 'image').then(setId), 200)
    return () => clearTimeout(handle)
  }, [caption, mode, idTouched, source])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? images.filter((i) => i.id.includes(q)) : images
  }, [images, query])

  const pickFile = async () => {
    const path = await api.manual.pickImageFile()
    if (path) setSource({ path, previewUrl: undefined, name: path.split('/').pop()!.replace(/\.[^.]+$/, '') })
  }

  const insert = async (existingId?: string) => {
    setBusy(true)
    setError('')
    try {
      let imageId = existingId ?? selected
      if (mode === 'new') {
        if (!source) throw new Error('이미지를 고르세요')
        imageId = await api.manual.importImage({ id, sourcePath: source.path, data: source.data })
      }
      if (!imageId) throw new Error('이미지를 고르세요')
      const preset = SIZES.find((s) => s.id === size)!
      const align = center && !preset.inline ? ' align=center' : ''
      const md = `![${preset.inline ? '' : caption}](images/${imageId}.png){width=${preset.width}${align}}`
      onInsert(preset.inline ? md : `\n\n${md}\n\n`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const canInsert = mode === 'existing' ? Boolean(selected) : Boolean(source && id)

  return (
    <Modal
      title="이미지 넣기"
      onClose={onClose}
      width={760}
      footer={
        <>
          {error && <span className="form-error inline">{error}</span>}
          <button className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={!canInsert || busy} onClick={() => insert()}>
            넣기
          </button>
        </>
      }
    >
      <div className="segmented">
        <button className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>
          있는 이미지
        </button>
        <button className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>
          새 이미지
        </button>
      </div>

      {mode === 'existing' ? (
        <>
          <div className="sidebar-search boxed">
            <Icon name="search" size={14} />
            <input placeholder="이미지 id 검색" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          </div>
          <div className="image-grid">
            {filtered.map((img) => (
              <button
                key={img.id}
                className={`image-tile ${selected === img.id ? 'selected' : ''}`}
                onClick={() => setSelected(img.id)}
                onDoubleClick={() => void insert(img.id)}
                title={img.id}
              >
                <img src={assetUrl(`manuals/${manual}/images/${img.id}.png`, Math.round(img.mtime))} loading="lazy" alt="" />
                <span className="ellipsis">{img.id}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="new-image">
          <div className="new-image-preview">
            {source?.previewUrl ? (
              <img src={source.previewUrl} alt="" />
            ) : source?.path ? (
              <div className="file-chip">
                <Icon name="image" /> {source.path.split('/').pop()}
              </div>
            ) : (
              <p className="muted">편집기에 이미지를 붙여 넣거나(⌘V) 끌어 놓아도 됩니다</p>
            )}
            <button className="button small" onClick={pickFile}>
              파일 고르기…
            </button>
          </div>
          <label className="field">
            <span>설명 (caption, 영어)</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Dealer List" autoFocus />
          </label>
          <label className="field">
            <span>이미지 id (파일 이름)</span>
            <input
              value={id}
              onChange={(e) => {
                setIdTouched(true)
                setId(e.target.value)
              }}
            />
          </label>
        </div>
      )}

      <fieldset className="size-options">
        <legend>Word에서의 크기</legend>
        {SIZES.map((s) => (
          <label key={s.id} className={size === s.id ? 'active' : ''}>
            <input type="radio" name="size" checked={size === s.id} onChange={() => setSize(s.id)} />
            {s.label} <span className="muted">{s.width}</span>
          </label>
        ))}
      </fieldset>
      <label className="check-inline">
        <input
          type="checkbox"
          checked={center && !SIZES.find((s) => s.id === size)?.inline}
          disabled={SIZES.find((s) => s.id === size)?.inline}
          onChange={(e) => setCenter(e.target.checked)}
        />
        가운데 정렬 (Word에서 이미지를 가운데에)
      </label>
    </Modal>
  )
}
