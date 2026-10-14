import { useMemo, useState, type DragEvent } from 'react'
import type { FileChange, ManualTree, Todo } from '../../../shared/api.ts'
import { CHANGE_STATUS_LABEL as STATUS_LABEL } from '../../../shared/format.ts'
import { Icon } from './Icon.tsx'

export type SidebarTab = 'toc' | 'todo' | 'changes'

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
  onMoveChapter,
  onMoveSection,
  onRefresh,
  onDiff,
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
  onMoveChapter: (dir: string, toIndex: number) => void
  onMoveSection: (path: string, toIndex: number) => void
  onRefresh: (target: { chapterDir: string; path?: string }) => void
  onDiff: (change: FileChange) => void
}) {
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
        <TocTab
          tree={tree}
          current={current}
          onOpen={onOpen}
          onNewSection={onNewSection}
          onRemoveSection={onRemoveSection}
          onMoveChapter={onMoveChapter}
          onMoveSection={onMoveSection}
          onRefresh={onRefresh}
        />
      )}
      {tab === 'todo' && <TodoTab todos={todos} onOpenTodo={onOpenTodo} />}
      {tab === 'changes' && <ChangesTab changes={changes} onOpen={onOpen} onRevert={onRevert} onDiff={onDiff} />}
    </nav>
  )
}

type DragItem = { type: 'chapter'; dir: string } | { type: 'section'; path: string; chapter: string }

// 끌어 놓기: 놓은 줄의 자리로 옮긴다. 검색 중에는 순서를 바꾸지 않는다
function useReorderDnd(enabled: boolean) {
  const [drag, setDrag] = useState<DragItem>()
  const [over, setOver] = useState<string>()
  const dragProps = (item: DragItem) =>
    enabled
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = 'move'
            setDrag(item)
          },
          onDragEnd: () => {
            setDrag(undefined)
            setOver(undefined)
          },
        }
      : {}
  // accept: 지금 끄는 것을 이 줄에 놓을 수 있는지
  const dropProps = (key: string, accept: (item: DragItem) => boolean, onDrop: (item: DragItem) => void) =>
    drag && accept(drag)
      ? {
          onDragOver: (e: DragEvent) => {
            e.preventDefault()
            setOver(key)
          },
          onDragLeave: () => setOver((o) => (o === key ? undefined : o)),
          onDrop: (e: DragEvent) => {
            e.preventDefault()
            setOver(undefined)
            setDrag(undefined)
            onDrop(drag)
          },
        }
      : {}
  return { over, dragProps, dropProps }
}

function TocTab({
  tree,
  current,
  onOpen,
  onNewSection,
  onRemoveSection,
  onMoveChapter,
  onMoveSection,
  onRefresh,
}: {
  tree?: ManualTree
  current?: string
  onOpen: (path: string) => void
  onNewSection: (chapterDir?: string) => void
  onRemoveSection: (path: string, title: string) => void
  onMoveChapter: (dir: string, toIndex: number) => void
  onMoveSection: (path: string, toIndex: number) => void
  onRefresh: (target: { chapterDir: string; path?: string }) => void
}) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const canReorder = !query.trim()
  const { over, dragProps, dropProps } = useReorderDnd(canReorder)

  const chapters = useMemo(() => {
    if (!tree) return []
    const q = query.trim().toLowerCase()
    if (!q) return tree.chapters
    return tree.chapters
      .map((c) => ({
        ...c,
        sections: c.title.toLowerCase().includes(q) ? c.sections : c.sections.filter((s) => s.title.toLowerCase().includes(q)),
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
    <>
      <div className="sidebar-search">
        <Icon name="search" size={14} />
        <input placeholder="화면 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="sidebar-scroll">
        {chapters.map((chapter, chapterIndex) => (
          <section key={chapter.dir} className="toc-chapter">
            <div
              className={`toc-chapter-row ${over === chapter.dir ? 'drop-target' : ''}`}
              title={canReorder ? '끌어서 장 순서를 바꿀 수 있습니다' : undefined}
              {...dragProps({ type: 'chapter', dir: chapter.dir })}
              {...dropProps(
                chapter.dir,
                (d) => d.type === 'chapter' && d.dir !== chapter.dir,
                (d) => d.type === 'chapter' && onMoveChapter(d.dir, chapterIndex),
              )}
            >
              <button className="toc-chapter-title" onClick={() => toggle(chapter.dir)}>
                <Icon name="chevron" size={12} className={collapsed.has(chapter.dir) ? 'chevron' : 'chevron open'} />
                <span className="toc-no">{chapter.no}</span>
                <span className="ellipsis">{chapter.title}</span>
              </button>
              <button className="icon-button small reveal" title="이 장 전체를 Claude로 최신화" onClick={() => onRefresh({ chapterDir: chapter.dir })}>
                <Icon name="sparkle" size={13} />
              </button>
              <button className="icon-button small reveal" title="이 장에 화면 추가" onClick={() => onNewSection(chapter.dir)}>
                <Icon name="plus" size={13} />
              </button>
            </div>
            {!collapsed.has(chapter.dir) && (
              <ul>
                {chapter.sections.map((s, sectionIndex) => (
                  <li
                    key={s.path}
                    className={`${s.path === current ? 'active' : ''} ${over === s.path ? 'drop-target' : ''}`}
                    // 장 소개는 맨 앞에 고정한다
                    {...(s.path.endsWith('/00-intro.md') ? {} : dragProps({ type: 'section', path: s.path, chapter: chapter.dir }))}
                    {...dropProps(
                      s.path,
                      (d) => d.type === 'section' && d.chapter === chapter.dir && d.path !== s.path,
                      (d) => d.type === 'section' && onMoveSection(d.path, sectionIndex),
                    )}
                  >
                    <button className="toc-section" onClick={() => onOpen(s.path)} title={s.path}>
                      <span className="ellipsis">{s.title}</span>
                      {s.review && (
                        <span className="badge review" title="Claude가 바꾼 곳을 아직 검토하지 않았습니다">
                          검토
                        </span>
                      )}
                      {s.todos > 0 && <span className="badge todo">{s.todos}</span>}
                      {s.modified && <span className="dot" title="제출하지 않은 변경" />}
                    </button>
                    <button
                      className="icon-button small reveal"
                      title="이 화면을 Claude로 최신화"
                      onClick={() => onRefresh({ chapterDir: chapter.dir, path: s.path })}
                    >
                      <Icon name="sparkle" size={13} />
                    </button>
                    <button className="icon-button small reveal" title="화면 삭제" onClick={() => onRemoveSection(s.path, s.title)}>
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
  )
}

function TodoTab({ todos, onOpenTodo }: { todos: Todo[]; onOpenTodo: (todo: Todo) => void }) {
  return (
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
  )
}

function ChangesTab({
  changes,
  onOpen,
  onRevert,
  onDiff,
}: {
  changes: FileChange[]
  onOpen: (path: string) => void
  onRevert: (changes: FileChange[]) => void
  onDiff: (change: FileChange) => void
}) {
  return (
    <>
      <div className="sidebar-scroll">
        {changes.length === 0 && <p className="empty">제출할 변경이 없습니다</p>}
        {changes.map((c) => (
          <div key={c.path} className="change-item">
            <span className={`status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
            <button
              className="change-label ellipsis"
              disabled={c.kind !== 'section' || c.status === 'deleted'}
              // manuals/<m>/<장>/<화면> → <장>/<화면>
              onClick={() => onOpen(c.path.split('/').slice(2).join('/'))}
              title={c.path}
            >
              {c.kind === 'image' && <Icon name="image" size={13} />}
              {c.label}
            </button>
            {c.kind !== 'image' && (
              <button className="icon-button small" title="변경 보기" onClick={() => onDiff(c)}>
                <Icon name="diff" size={13} />
              </button>
            )}
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
  )
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups: Record<string, T[]> = {}
  for (const item of items) (groups[key(item)] ??= []).push(item)
  return groups
}
