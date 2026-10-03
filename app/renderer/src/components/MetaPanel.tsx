import { useEffect, useState } from 'react'
import type { SectionMeta } from '../../../shared/api.ts'
import { Icon } from './Icon.tsx'

const lines = (list?: string[]) => (list ?? []).join('\n')
const toList = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

// front-matter 편집. 코드와 매뉴얼을 잇는 키라 기본은 접어 둔다
export function MetaPanel({ meta, onSave }: { meta: SectionMeta; onSave: (meta: SectionMeta) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', routes: '', sources: '', i18nPrefix: '' })

  useEffect(() => {
    setDraft({
      title: meta.title ?? '',
      routes: lines(meta.routes),
      sources: lines(meta.sources),
      i18nPrefix: lines(meta.i18nPrefix),
    })
  }, [meta])

  const dirty =
    draft.title !== (meta.title ?? '') ||
    draft.routes !== lines(meta.routes) ||
    draft.sources !== lines(meta.sources) ||
    draft.i18nPrefix !== lines(meta.i18nPrefix)

  return (
    <div className={`meta-panel ${open ? 'open' : ''}`}>
      <button className="meta-toggle" onClick={() => setOpen(!open)}>
        <Icon name="chevron" size={13} className="chevron" />
        섹션 정보
        <span className="muted">· 코드 연결 키 (개발자용)</span>
      </button>
      {open && (
        <div className="meta-fields">
          <label className="field">
            <span>title</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="field">
            <span>routes</span>
            <textarea rows={2} value={draft.routes} onChange={(e) => setDraft({ ...draft, routes: e.target.value })} />
          </label>
          <label className="field">
            <span>sources (glob)</span>
            <textarea rows={2} value={draft.sources} onChange={(e) => setDraft({ ...draft, sources: e.target.value })} />
          </label>
          <label className="field">
            <span>i18nPrefix</span>
            <textarea
              rows={2}
              value={draft.i18nPrefix}
              onChange={(e) => setDraft({ ...draft, i18nPrefix: e.target.value })}
            />
          </label>
          <div className="meta-actions">
            <span className="hint">한 줄에 하나씩. dealerhub-web 변경 추적에 씁니다</span>
            <button
              className="button small primary"
              disabled={!dirty}
              onClick={() =>
                onSave({
                  // 최신화 근거 버전(refreshedFrom) 같은 다른 값은 그대로 둔다
                  ...meta,
                  title: draft.title.trim(),
                  routes: toList(draft.routes),
                  sources: toList(draft.sources),
                  i18nPrefix: toList(draft.i18nPrefix),
                })
              }
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
