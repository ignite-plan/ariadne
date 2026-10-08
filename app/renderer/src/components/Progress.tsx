import type { ReactNode } from 'react'

// 진행 막대. percent를 모르면 fallback 너비로 움직이는 막대를 보여 준다
export function Progress({ percent, fallback, children }: { percent?: number; fallback?: number; children?: ReactNode }) {
  const width = percent ?? fallback
  return (
    <div className="progress">
      <div
        className="progress-bar"
        style={width === undefined ? undefined : { width: `${width}%` }}
        data-indeterminate={percent === undefined ? 'true' : undefined}
      />
      {children}
    </div>
  )
}
