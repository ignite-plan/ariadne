import { useMemo, useState } from 'react'
import type { FileChange, ManualTree, Todo } from '../../../shared/api.ts'
import { Icon } from './Icon.tsx'

export type SidebarTab = 'toc' | 'todo' | 'changes'

const STATUS_LABEL = { added: '추가', modified: '수정', deleted: '삭제' } as const

export function Sidebar({
  tab,
  onTab,
  tree,
  todos,
  changes,
  current,
  onOpen,
  onOpenTodo,
  onNewSection,
  onRemoveSection,
  onRevert,
}: {
  tab: SidebarTab
  onTab: (tab: SidebarTab) => void
  tree?: ManualTree
  todos: Todo[]
  changes: FileChange[]
  current?: string
  onOpen: (path: string) => void
  onOpenTodo: (todo: Todo) => void
  onNewSection: (chapterDir?: string) => void
  onRemoveSection: (path: string, title: string) => void
  onRevert: (changes: FileChange[]) => void
}) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const chapters = useMemo(() => {
    if (!tree) return []
    const q = query.trim().toLowerCase()
    if (!q) return tree.chapters
    return tree.chapters
      .map((c) => ({
        ...c,
        sections: c.title.toLowerCase().includes(q)
          ? c.sections
          : c.sections.filter((s) => s.title.toLowerCase().includes(q)),
      }))
      .filter((c) => c.sections.length)
  }, [tree, query])

  const toggle = (dir: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })

  return (
    <nav className="sidebar">
      <div className="tabs" role="tablist">
        <button role="tab" className={tab === 'toc' ? 'active' : ''} onClick={() => onTab('toc')}>
          목차
        </button>
        <button role="tab" className={tab === 'todo' ? 'active' : ''} onClick={() => onTab('todo')}>
          TODO {todos.length > 0 && <span className="count">{todos.length}</span>}
        </button>
        <button role="tab" className={tab === 'changes' ? 'active' : ''} onClick={() => onTab('changes')}>
          변경 {changes.length > 0 && <span className="count accent">{changes.length}</span>}
        </button>
      </div>

      {tab === 'toc' && (
        <>
          <div className="sidebar-search">
            <Icon name="search" size={14} />
            <input placeholder="화면 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="sidebar-scroll">
            {chapters.map((chapter) => (
              <section key={chapter.dir} className="toc-chapter">
                <div className="toc-chapter-row">
                  <button className="toc-chapter-title" onClick={() => toggle(chapter.dir)}>
                    <Icon name="chevron" size={12} className={collapsed.has(chapter.dir) ? 'chevron' : 'chevron open'} />
                    <span className="toc-no">{chapter.no}</span>
                    <span className="ellipsis">{chapter.title}</span>
                  </button>
                  <button
                    className="icon-button small reveal"
                    title="이 장에 화면 추가"
                    onClick={() => onNewSection(chapter.dir)}
                  >
                    <Icon name="plus" size={13} />
                  </button>
                </div>
                {!collapsed.has(chapter.dir) && (
                  <ul>
                    {chapter.sections.map((s) => (
                      <li key={s.path} className={s.path === current ? 'active' : ''}>
                        <button className="toc-section" onClick={() => onOpen(s.path)} title={s.path}>
                          <span className="ellipsis">{s.title}</span>
                          {s.todos > 0 && <span className="badge todo">{s.todos}</span>}
                          {s.modified && <span className="dot" title="제출하지 않은 변경" />}
                        </button>
                        <button
                          className="icon-button small reveal"
                          title="화면 삭제"
                          onClick={() => onRemoveSection(s.path, s.title)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            {!chapters.length && <p className="empty">찾는 화면이 없습니다</p>}
          </div>
          <div className="sidebar-footer">
            <button className="button small block" onClick={() => onNewSection()}>
              <Icon name="plus" size={14} /> 새 화면
            </button>
          </div>
        </>
      )}

      {tab === 'todo' && (
        <div className="sidebar-scroll">
          {todos.length === 0 && <p className="empty">남은 TODO가 없습니다</p>}
          {Object.entries(groupBy(todos, (t) => t.path)).map(([path, items]) => (
            <section key={path} className="todo-group">
              <h3 className="ellipsis">{items[0].sectionTitle}</h3>
              {items.map((t) => (
                <button key={`${t.path}:${t.line}`} className="todo-item" onClick={() => onOpenTodo(t)}>
                  <Icon name="flag" size={13} />
                  <span>{t.text}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {tab === 'changes' && (
        <>
          <div className="sidebar-scroll">
            {changes.length === 0 && <p className="empty">제출할 변경이 없습니다</p>}
            {changes.map((c) => (
              <div key={c.path} className="change-item">
                <span className={`status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                <button
                  className="change-label ellipsis"
                  disabled={c.kind !== 'section' || c.status === 'deleted'}
                  onClick={() => onOpen(c.path.split('/').slice(2).join('/'))}
                  title={c.path}
                >
                  {c.kind === 'image' && <Icon name="image" size={13} />}
                  {c.label}
                </button>
                <button className="icon-button small" title="변경 되돌리기" onClick={() => onRevert([c])}>
                  <Icon name="revert" size={13} />
                </button>
              </div>
            ))}
          </div>
          {changes.length > 1 && (
            <div className="sidebar-footer">
              <button className="button small block" onClick={() => onRevert(changes)}>
                <Icon name="revert" size={14} /> 모두 되돌리기
              </button>
            </div>
          )}
        </>
      )}
    </nav>
  )
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups: Record<string, T[]> = {}
  for (const item of items) (groups[key(item)] ??= []).push(item)
  return groups
}
