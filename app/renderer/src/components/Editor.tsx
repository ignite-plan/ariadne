import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  MatchDecorator,
  placeholder,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface EditorHandle {
  insert: (text: string) => void
  wrap: (before: string, after: string, fallback: string) => void
  prefixLines: (prefix: string) => void
  goToLine: (line: number) => void
  undo: () => void
  redo: () => void
  focus: () => void
}

// {width=6.27in} 같은 pandoc 크기 표기를 작은 칩으로 접는다. 기획자가 실수로 깨뜨리지 않게
class SizeWidget extends WidgetType {
  constructor(readonly label: string) {
    super()
  }
  eq(other: SizeWidget) {
    return other.label === this.label
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-size-chip'
    span.textContent = this.label
    span.title = 'Word에 들어갈 이미지 크기. 바꾸려면 이미지를 다시 넣으세요'
    return span
  }
}

const sizeLabel = (width: string) => {
  const w = Number.parseFloat(width)
  if (w >= 5.5) return `전체 ${width}in`
  if (w >= 1) return `팝업 ${width}in`
  return `아이콘 ${width}in`
}

const sizeMatcher = new MatchDecorator({
  regexp: /\{width=([\d.]+)in(?:\s+height=[\d.]+in)?\}/g,
  decoration: (match) => Decoration.replace({ widget: new SizeWidget(sizeLabel(match[1])) }),
})

const sizeChips = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = sizeMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = sizeMatcher.updateDeco(update, this.decorations)
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
)

function markPlugin(regexp: RegExp, className: string) {
  const matcher = new MatchDecorator({ regexp, decoration: Decoration.mark({ class: className }) })
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view)
      }
      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations)
      }
    },
    { decorations: (v) => v.decorations },
  )
}

const highlight = HighlightStyle.define([
  { tag: tags.heading2, class: 'cm-h2' },
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, class: 'cm-link' },
  { tag: tags.url, class: 'cm-url' },
  { tag: tags.processingInstruction, class: 'cm-mark' },
  { tag: tags.comment, class: 'cm-comment' },
])

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '15px' },
  '.cm-scroller': { fontFamily: 'var(--font)', lineHeight: '1.8', padding: '20px 0 160px' },
  '.cm-content': { maxWidth: '820px', padding: '0 28px', caretColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
})

export const Editor = forwardRef<
  EditorHandle,
  {
    docKey: string
    value: string
    onChange: (value: string) => void
    onImageFile: (file: File) => void
    onScrollRatio?: (ratio: number) => void
    // Claude가 이 화면을 고치는 중
    readOnly?: boolean
  }
>(function Editor({ docKey, value, onChange, onImageFile, onScrollRatio, readOnly = false }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | undefined>(undefined)
  const callbacks = useRef({ onChange, onImageFile, onScrollRatio })
  callbacks.current = { onChange, onImageFile, onScrollRatio }
  const lock = useRef(new Compartment())
  const locked = useRef(readOnly)
  locked.current = readOnly
  const lockExtension = (on: boolean) => [EditorState.readOnly.of(on), EditorView.editable.of(!on)]

  const createState = (doc: string) =>
    EditorState.create({
      doc,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        markdown(),
        syntaxHighlighting(highlight),
        sizeChips,
        markPlugin(/<!--\s*TODO\b[^]*?-->/g, 'cm-todo'),
        markPlugin(/!\[[^\]]*\]\(images\/[^)]+\)/g, 'cm-image'),
        markPlugin(/\*\*\\\[[^\]]*\\\]\*\*/g, 'cm-ui-label'),
        placeholder('내용을 입력하세요'),
        lock.current.of(lockExtension(locked.current)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) callbacks.current.onChange(u.state.doc.toString())
        }),
        EditorView.domEventHandlers({
          paste(event) {
            const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
            if (!file) return false
            event.preventDefault()
            callbacks.current.onImageFile(file)
            return true
          },
          drop(event) {
            const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'))
            if (!file) return false
            event.preventDefault()
            callbacks.current.onImageFile(file)
            return true
          },
          scroll(_event, v) {
            const el = v.scrollDOM
            const max = el.scrollHeight - el.clientHeight
            callbacks.current.onScrollRatio?.(max > 0 ? el.scrollTop / max : 0)
          },
        }),
      ],
    })

  useEffect(() => {
    view.current = new EditorView({ state: createState(value), parent: host.current! })
    return () => view.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    view.current?.dispatch({ effects: lock.current.reconfigure(lockExtension(readOnly)) })
  }, [readOnly])

  // 다른 섹션을 열면 undo 기록까지 새로 시작한다
  useEffect(() => {
    const v = view.current
    if (!v) return
    v.setState(createState(value))
    v.scrollDOM.scrollTop = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  useImperativeHandle(ref, () => ({
    insert(text) {
      const v = view.current!
      const { from, to } = v.state.selection.main
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true })
      v.focus()
    },
    wrap(before, after, fallback) {
      const v = view.current!
      const { from, to } = v.state.selection.main
      const selected = v.state.sliceDoc(from, to) || fallback
      v.dispatch({
        changes: { from, to, insert: `${before}${selected}${after}` },
        selection: { anchor: from + before.length, head: from + before.length + selected.length },
      })
      v.focus()
    },
    prefixLines(prefix) {
      const v = view.current!
      const { from, to } = v.state.selection.main
      const changes = []
      for (let pos = from; pos <= to; ) {
        const line = v.state.doc.lineAt(pos)
        changes.push({ from: line.from, insert: prefix })
        pos = line.to + 1
      }
      v.dispatch({ changes })
      v.focus()
    },
    goToLine(line) {
      const v = view.current!
      const target = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines))
      v.dispatch({
        selection: { anchor: target.from },
        effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
      })
      v.focus()
    },
    undo: () => void undo(view.current!),
    redo: () => void redo(view.current!),
    focus: () => view.current?.focus(),
  }))

  return <div className="editor-host" ref={host} />
})
