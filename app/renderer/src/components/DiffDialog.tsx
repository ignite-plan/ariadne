import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../api.ts'
import { buildRows } from '../diff-rows.ts'
import { Modal } from './Modal.tsx'

export function DiffDialog({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const [data, setData] = useState<{ before: string | null; after: string | null }>()
  const [error, setError] = useState('')

  useEffect(() => {
    api.workspace.diff(path).then(setData, (e) => setError(errorMessage(e)))
  }, [path])

  const rows = useMemo(() => (data ? buildRows(data.before ?? '', data.after ?? '') : []), [data])
  const added = rows.filter((r) => r.kind === 'add').length
  const removed = rows.filter((r) => r.kind === 'del').length

  return (
    <Modal
      title={
        <>
          변경 보기 <span className="muted">· {title}</span>
        </>
      }
      onClose={onClose}
      width={980}
    >
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="muted">불러오는 중…</p>}
      {data && (
        <>
          <div className="diff-stats">
            {data.before === null ? <span className="pill accent">새 파일</span> : null}
            {data.after === null ? <span className="pill danger">삭제됨</span> : null}
            <span className="diff-add">+{added}</span>
            <span className="diff-del">−{removed}</span>
            <span className="muted">마지막으로 제출된 내용과 비교</span>
          </div>
          {rows.length === 0 ? (
            <p className="empty">바뀐 내용이 없습니다</p>
          ) : (
            <div className="diff">
              {rows.map((row, i) =>
                row.kind === 'gap' ? (
                  <div key={i} className="diff-row gap">⋯</div>
                ) : (
                  <div key={i} className={`diff-row ${row.kind}`}>
                    <span className="diff-no">{row.before ?? ''}</span>
                    <span className="diff-no">{row.after ?? ''}</span>
                    <span className="diff-mark">{row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ''}</span>
                    <span className="diff-text">{row.text || ' '}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
