import type { ManualTree } from '../../../shared/api.ts'

// 매뉴얼 화면 고르기 (장별로 묶음). 빈 값은 (없음)
export function SectionSelect({
  tree,
  value,
  disabled,
  onChange,
}: {
  tree?: ManualTree
  value: string
  disabled?: boolean
  onChange: (path: string) => void
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
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
  )
}
