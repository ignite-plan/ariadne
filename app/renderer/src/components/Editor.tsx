import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state'
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
import { MARK_RE, toggleCenter, toggleMark } from '../../../shared/markdown-edit.ts'
import type { ReviewHunk } from '../../../shared/review-diff.ts'
import { editorSearch, openSearch } from '../editor-search.ts'
import { imageToInsert } from '../paste.ts'

// Claude가 바꾼 줄 왼쪽에 막대를 그린다 (본문에는 아무것도 넣지 않는다). 줄 번호는 지금 본문 기준
function reviewLines(hunks: ReviewHunk[]) {
  return EditorView.decorations.compute(['doc'], (state) => {
    const builder = new RangeSetBuilder<Decoration>()
    const lines = state.doc.lines
    for (const hunk of hunks) {
      for (let n = Math.max(1, hunk.from); n <= Math.min(hunk.to, lines); n++) {
        builder.add(state.doc.line(n).from, state.doc.line(n).from, Decoration.line({ class: `cm-review-${hunk.kind}` }))
      }
    }
    return builder.finish()
  })
}

export interface EditorHandle {
  insert: (text: string) => void
  // 노란 형광펜 켜기/끄기 (선택한 글자)
  toggleMark: () => void
  // 커서가 있는 줄의 이미지 가운데 정렬 켜기/끄기. 이미지가 없으면 false
  toggleCenter: () => boolean
  wrap: (before: string, after: string, fallback: string) => void
  prefixLines: (prefix: string) => void
  goToLine: (line: number) => void
  // 찾기 막대 열기 (replace면 바꿀 말 칸으로)
  openSearch: (replace?: boolean) => void
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
    span.title = 'Word에 들어갈 이미지 크기와 정렬. 크기를 바꾸려면 이미지를 다시 넣고, 가운데 정렬은 툴바 버튼으로 켜고 끕니다'
    return span
  }
}

const sizeLabel = (width: string) => {
  const w = Number.parseFloat(width)
  if (w >= 5.5) return `전체 ${width}in`
  if (w >= 1) return `팝업 ${width}in`
  return `아이콘 ${width}in`
}

// {width=4.2in}, {width=4.2in align=center}, {align=center} (형광펜 {.mark}는 아님)
const sizeMatcher = new MatchDecorator({
  regexp: /\{(?:width=([\d.]+)in(?:\s+height=[\d.]+in)?(?:\s+align=center)?|align=center)\}/g,
  decoration: (match) =>
    Decoration.replace({
      widget: new SizeWidget(
        [match[1] ? sizeLabel(match[1]) : '', match[0].includes('align=center') ? '가운데' : ''].filter(Boolean).join(' · '),
      ),
    }),
})

// 형광펜 [글자]{.mark}: 괄호 표기는 숨기고 글자에 노란 배경
const hideSyntax = Decoration.replace({})
const markBg = Decoration.mark({ class: 'cm-hl' })
const markMatcher = new MatchDecorator({
  regexp: MARK_RE,
  decorate: (add, from, to) => {
    add(from, from + 1, hideSyntax)
    add(from + 1, to - '{.mark}'.length - 1, markBg)
    add(to - '{.mark}'.length - 1, to, hideSyntax)
  },
})

const markHighlights = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = markMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = markMatcher.updateDeco(update, this.decorations)
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
)

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
    // Claude가 바꾼 줄 (검토 중일 때)
    review?: ReviewHunk[]
  }
>(function Editor({ docKey, value, onChange, onImageFile, onScrollRatio, readOnly = false, review }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | undefined>(undefined)
  const callbacks = useRef({ onChange, onImageFile, onScrollRatio })
  callbacks.current = { onChange, onImageFile, onScrollRatio }
  const lock = useRef(new Compartment())
  const locked = useRef(readOnly)
  locked.current = readOnly
  const lockExtension = (on: boolean) => [EditorState.readOnly.of(on), EditorView.editable.of(!on)]
  const reviewing = useRef(new Compartment())
  const reviewHunks = useRef(review)
  reviewHunks.current = review
  const reviewExtension = (hunks?: ReviewHunk[]) => (hunks?.length ? reviewLines(hunks) : [])

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
        markHighlights,
        markPlugin(/<!--\s*TODO\b[^]*?-->/g, 'cm-todo'),
        markPlugin(/!\[[^\]]*\]\(images\/[^)]+\)/g, 'cm-image'),
        markPlugin(/\*\*\\\[[^\]]*\\\]\*\*/g, 'cm-ui-label'),
        placeholder('내용을 입력하세요'),
        lock.current.of(lockExtension(locked.current)),
        reviewing.current.of(reviewExtension(reviewHunks.current)),
        // 지금 화면 안에서 찾기·바꾸기 (⌘F, ⌥⌘F)
        editorSearch,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) callbacks.current.onChange(u.state.doc.toString())
        }),
        EditorView.domEventHandlers({
          // 글자가 있으면 글자로 (Word에서 복사한 문장에 같이 들어 있는 그림은 무시), 그림만 있을 때 이미지 넣기
          paste(event) {
            const file = imageToInsert(event.clipboardData)
            if (!file) return false
            event.preventDefault()
            callbacks.current.onImageFile(file)
            return true
          },
          drop(event) {
            const file = imageToInsert(event.dataTransfer)
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

  useEffect(() => {
    view.current?.dispatch({ effects: reviewing.current.reconfigure(reviewExtension(review)) })
  }, [review])

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
    toggleMark() {
      const v = view.current!
      const { from, to } = v.state.selection.main
      const edit = toggleMark(v.state.doc.toString(), from, to)
      v.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert }, selection: edit.selection })
      v.focus()
    },
    toggleCenter() {
      const v = view.current!
      const line = v.state.doc.lineAt(v.state.selection.main.head)
      const next = toggleCenter(line.text)
      if (next === null) return false
      v.dispatch({ changes: { from: line.from, to: line.to, insert: next } })
      v.focus()
      return true
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
    openSearch: (replace) => void openSearch(view.current!, replace),
    undo: () => void undo(view.current!),
    redo: () => void redo(view.current!),
    focus: () => view.current?.focus(),
  }))

  return <div className="editor-host" ref={host} />
})
