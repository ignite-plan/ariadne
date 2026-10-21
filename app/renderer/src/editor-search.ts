// 편집기 찾기·바꾸기 막대 (지금 화면 안에서만). 찾기 엔진은 @codemirror/search, 막대는 한국어 문구와 "3 / 12" 결과 수가
// 있게 직접 그린다. ⌘F 찾기, ⌥⌘F 바꾸기 칸에 바로, Enter 다음, ⇧Enter 이전, Esc 닫기
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  searchPanelOpen,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search'
import type { EditorState, Extension } from '@codemirror/state'
import { EditorView, keymap, type Panel, type ViewUpdate } from '@codemirror/view'
import { iconElement, type IconName } from './icons.ts'

// 결과가 아주 많으면 그만 센다
const MAX_COUNT = 999

// 찾은 수와 지금 선택이 몇 번째 결과인지 (결과가 아니면 0)
export function matchInfo(state: EditorState, query: SearchQuery) {
  if (!query.search || !query.valid) return { total: 0, current: 0 }
  const { from, to } = state.selection.main
  let total = 0
  let current = 0
  const cursor = query.getCursor(state)
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    total++
    if (next.value.from === from && next.value.to === to) current = total
    if (total > MAX_COUNT) break
  }
  return { total, current }
}

export const countLabel = ({ total, current }: { total: number; current: number }, hasQuery: boolean) => {
  if (!hasQuery) return ''
  if (!total) return '결과 없음'
  const all = total > MAX_COUNT ? `${MAX_COUNT}+` : String(total)
  return current ? `${current} / ${all}` : `${all}개`
}

const bars = new WeakMap<EditorView, SearchBar>()

// DOM 하나 만들기 (속성은 그대로 넣는다)
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props)
}

class SearchBar implements Panel {
  dom: HTMLElement
  top = true
  private search: HTMLInputElement
  private replace: HTMLInputElement
  // 옵션 토글 (앱 버튼 모양, aria-pressed)
  private caseSensitive: HTMLButtonElement
  private wholeWord: HTMLButtonElement
  private count: HTMLElement
  private replaceButtons: HTMLButtonElement[]
  private query: SearchQuery

  constructor(private view: EditorView) {
    this.query = getSearchQuery(view.state)
    this.search = el('input', { className: 'cm-find-input', placeholder: '찾을 말', value: this.query.search, type: 'text' })
    this.search.setAttribute('main-field', 'true')
    this.search.setAttribute('aria-label', '찾을 말')
    this.replace = el('input', { className: 'cm-find-input', placeholder: '바꿀 말', value: this.query.replace, type: 'text' })
    this.replace.setAttribute('aria-label', '바꿀 말')
    this.count = el('span', { className: 'cm-find-count' })
    this.count.setAttribute('aria-live', 'polite')

    // 앱 버튼과 같은 모양: 글자 버튼은 .button small, 아이콘 버튼은 .icon-button small + 앱 라인 아이콘
    const button = (content: string | { icon: IconName }, title: string, run: () => void) => {
      const b = el('button', { type: 'button', title })
      if (typeof content === 'string') {
        b.className = 'button small'
        b.textContent = content
      } else {
        b.className = 'icon-button small'
        b.append(iconElement(content.icon, 15))
      }
      b.setAttribute('aria-label', title)
      b.addEventListener('click', () => {
        run()
        this.refresh()
      })
      return b
    }
    const toggle = (label: string, title: string, on: boolean) => {
      const b = el('button', { type: 'button', className: 'button small ghost cm-find-toggle', textContent: label, title })
      b.setAttribute('aria-pressed', String(on))
      b.addEventListener('click', () => {
        b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))
        this.commit()
      })
      return b
    }
    this.caseSensitive = toggle('대소문자', '대소문자가 같은 것만 찾기', this.query.caseSensitive)
    this.wholeWord = toggle('단어 단위', '단어 전체가 같은 것만 찾기', this.query.wholeWord)
    this.replaceButtons = [
      button('바꾸기', '지금 찾은 곳을 바꾸고 다음으로', () => replaceNext(this.view)),
      button('모두 바꾸기', '이 화면에서 찾은 곳을 모두 바꾸기', () => replaceAll(this.view)),
    ]

    this.search.addEventListener('input', () => this.commit(true))
    this.replace.addEventListener('input', () => this.commit())
    this.search.addEventListener('keydown', (e) => this.keydown(e, () => (e.shiftKey ? findPrevious(this.view) : findNext(this.view))))
    this.replace.addEventListener('keydown', (e) => this.keydown(e, () => replaceNext(this.view)))

    const findRow = el('div', { className: 'cm-find-row' })
    findRow.append(
      this.search,
      this.count,
      button({ icon: 'up' }, '이전 (⇧Enter)', () => findPrevious(this.view)),
      button({ icon: 'down' }, '다음 (Enter)', () => findNext(this.view)),
      this.caseSensitive,
      this.wholeWord,
    )
    const close = button({ icon: 'x' }, '닫기 (Esc)', () => {
      closeSearchPanel(this.view)
      this.view.focus()
    })
    close.classList.add('cm-find-close')
    const replaceRow = el('div', { className: 'cm-find-row' })
    replaceRow.append(this.replace, ...this.replaceButtons)
    this.dom = el('div', { className: 'cm-find' })
    this.dom.setAttribute('role', 'search')
    this.dom.setAttribute('aria-label', '찾기·바꾸기')
    this.dom.append(findRow, replaceRow, close)
    // 막대 안 어디에 있든 Esc로 닫고 편집기로, ⌘F·⌥⌘F로 찾을 말·바꿀 말 칸으로 (⌥를 누르면 key가 'ƒ'가 되어 code로 본다)
    this.dom.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSearchPanel(this.view)
        this.view.focus()
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyF') {
        e.preventDefault()
        this.focus(e.altKey)
      }
    })
    bars.set(view, this)
    this.refresh()
  }

  mount() {
    this.search.select()
  }

  destroy() {
    bars.delete(this.view)
  }

  // 바꾸기 칸에 바로 들어가려면 replace
  focus(replace = false) {
    const target = replace && !this.view.state.readOnly ? this.replace : this.search
    target.focus()
    target.select()
  }

  private keydown(e: KeyboardEvent, run: () => void) {
    if (e.key === 'Enter') {
      e.preventDefault()
      run()
      this.refresh()
    }
  }

  // 입력을 찾기 상태로. 찾을 말을 고쳤으면 지금 위치가 결과가 아닐 때 다음 결과로 옮긴다
  private commit(move = false) {
    const query = new SearchQuery({
      search: this.search.value,
      replace: this.replace.value,
      caseSensitive: this.caseSensitive.getAttribute('aria-pressed') === 'true',
      wholeWord: this.wholeWord.getAttribute('aria-pressed') === 'true',
      literal: true,
    })
    if (query.eq(this.query)) return
    this.query = query
    this.view.dispatch({ effects: setSearchQuery.of(query) })
    if (move && query.search && !matchInfo(this.view.state, query).current) findNext(this.view)
    this.refresh()
  }

  update(update: ViewUpdate) {
    const query = getSearchQuery(update.state)
    if (!query.eq(this.query)) {
      // 바깥에서 찾기 상태가 바뀌었다 (⌘F로 선택한 글자를 넣는 등)
      this.query = query
      this.search.value = query.search
      this.replace.value = query.replace
      this.caseSensitive.setAttribute('aria-pressed', String(query.caseSensitive))
      this.wholeWord.setAttribute('aria-pressed', String(query.wholeWord))
    }
    if (update.docChanged || update.selectionSet || update.transactions.some((t) => t.effects.length) || update.startState.readOnly !== update.state.readOnly) {
      this.refresh()
    }
  }

  private refresh() {
    this.count.textContent = countLabel(matchInfo(this.view.state, this.query), Boolean(this.query.search))
    // Claude가 고치는 중인 화면은 찾기만
    const locked = this.view.state.readOnly
    this.replace.disabled = locked
    for (const b of this.replaceButtons) b.disabled = locked || !this.query.search
    this.replace.title = locked ? 'Claude가 고치는 중이라 바꿀 수 없습니다' : ''
  }
}

// 찾기 막대를 연다 (이미 열려 있으면 그 칸으로). 선택한 한 줄 글자가 있으면 찾을 말로 넣는다
export function openSearch(view: EditorView, replace = false) {
  if (!searchPanelOpen(view.state)) openSearchPanel(view)
  else {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    if (selected && !selected.includes('\n')) {
      const query = getSearchQuery(view.state)
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ ...query, search: selected, literal: true })) })
    }
  }
  bars.get(view)?.focus(replace)
  return true
}

export const editorSearch: Extension = [
  search({ top: true, literal: true, createPanel: (view) => new SearchBar(view) }),
  keymap.of([
    { key: 'Mod-f', run: (view) => openSearch(view), preventDefault: true },
    { key: 'Mod-Alt-f', run: (view) => openSearch(view, true), preventDefault: true },
    { key: 'Mod-g', run: findNext, shift: findPrevious, preventDefault: true },
    {
      key: 'Escape',
      run: (view) => {
        if (!searchPanelOpen(view.state)) return false
        closeSearchPanel(view)
        return true
      },
    },
  ]),
  EditorView.theme({
    '.cm-searchMatch': { backgroundColor: 'var(--find-match)', borderRadius: '2px' },
    '.cm-searchMatch-selected': { backgroundColor: 'var(--find-current)', outline: '1px solid var(--accent)' },
  }),
]
