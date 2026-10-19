import type { ManualTree } from '../../../shared/api.ts'
import { Icon } from './Icon.tsx'

// 매뉴얼 화면 고르기 (장별로 묶음). 빈 값은 (없음)
export function SectionSelect({
  tree,
  value,
  disabled,
  empty = '(없음)',
  onChange,
}: {
  tree?: ManualTree
  value: string
  disabled?: boolean
  empty?: string
  onChange: (path: string) => void
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
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
  )
}

// 매뉴얼 화면 여러 개 고르기 (가이드 영상이 이 순서로 화면을 옮겨 가며 보여 준다)
export function SectionsSelect({
  tree,
  value,
  disabled,
  onChange,
}: {
  tree?: ManualTree
  value: string[]
  disabled?: boolean
  onChange: (paths: string[]) => void
}) {
  // 바꾼 화면이 이미 목록에 있으면 그 줄을 지운다 (같은 화면을 두 번 넣지 않는다)
  const replace = (index: number, path: string) =>
    onChange(path ? value.flatMap((p, i) => (i === index ? [path] : p === path ? [] : [p])) : value.filter((_, i) => i !== index))
  return (
    <div className="sections-select">
      {value.map((path, i) => (
        <div key={path} className="sections-row">
          <span className="muted">{i + 1}</span>
          <SectionSelect tree={tree} value={path} disabled={disabled} onChange={(next) => replace(i, next)} />
          <button className="icon-button small" onClick={() => replace(i, '')} disabled={disabled} aria-label="연결 해제" title="연결 해제">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <div className="sections-row">
        {value.length > 0 && <span className="muted">{value.length + 1}</span>}
        <SectionSelect
          tree={tree}
          value=""
          disabled={disabled}
          empty={value.length ? '(화면 추가)' : '(없음)'}
          onChange={(path) => path && !value.includes(path) && onChange([...value, path])}
        />
      </div>
    </div>
  )
}
