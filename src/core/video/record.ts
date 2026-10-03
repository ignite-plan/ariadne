// STG에서 기획자가 직접 조작한 것을 시나리오 단계로 기록한다.
// 페이지 스크립트가 누르려는 요소에 표시를 붙이고 찾는 방법 후보를 보내면, 여기서 Playwright 규칙(locate)으로
// 그 요소를 실제로 찾는 후보와 몇 번째인지(nth)를 정한다. 클릭은 페이지가 붙잡아 두고 기록기가 그 대상으로 대신 누른다.
// 누르자마자 사라지는 요소(선택 목록 등)도 놓치지 않고, 기록된 단계는 영상 만들 때와 같은 규칙으로 한 번 실행된 것이다
import type { Page } from 'playwright'
import { isBlockedLabel } from '../safety.ts'
import type { Step, Target } from './scenario.ts'
import { locate } from './steps.ts'

export { appendRecorded } from './edit.ts'

const MARK = 'data-ariadne-rec'

// 페이지 → 기록기
export type PageEvent =
  | { kind: 'click'; id: string; candidates: Target[]; x: number; y: number }
  | { kind: 'type'; id: string; candidates: Target[]; text: string }
  | { kind: 'select'; id: string; candidates: Target[]; value: string }
  | { kind: 'pick'; purpose: 'highlight' | 'mask' | 'wait'; id: string; candidates: Target[] }
  | { kind: 'control'; action: 'scene' | 'stop' }

// 기록기 → 앱
export type RecordEvent =
  | { kind: 'step'; step: Step; warning?: string }
  | { kind: 'mask'; target: Target }
  | { kind: 'scene' }
  | { kind: 'stop' }
  | { kind: 'warning'; message: string }

// 표시된 요소가 조건에 맞는 요소 중 몇 번째인지, 모두 몇 개인지. 없으면 index -1
async function position(page: Page, target: Target, id: string) {
  return locate(page, target, { all: true })
    .evaluateAll(
      (els, [attr, value]) => ({ index: els.findIndex((el) => el.getAttribute(attr) === value), count: els.length }),
      [MARK, id] as const,
    )
    .catch(() => ({ index: -1, count: 0 }))
}

// 표시된 요소를 실제로 찾는 첫 후보. nth는 같은 조건 중 몇 번째인지.
// 부분 일치로 여러 개가 걸리면(예: Active ⊂ Inactive) 정확히 일치로 좁혀 본다
export async function resolveTarget(page: Page, id: string, candidates: Target[]) {
  for (const candidate of candidates) {
    let target = candidate
    let found = await position(page, candidate, id)
    if (found.index < 0) continue
    if (found.count > 1 && (candidate.name || candidate.text || candidate.label || candidate.placeholder)) {
      const exact = await position(page, { ...candidate, exact: true }, id)
      if (exact.index >= 0 && exact.count < found.count) {
        target = { ...candidate, exact: true }
        found = exact
      }
    }
    // 이름 없이 종류만으로 찾으면 화면이 바뀔 때 틀리기 쉽다
    const weak = Boolean(candidate.role && !candidate.name)
    return { target: found.index ? { ...target, nth: found.index } : target, weak }
  }
  return undefined
}

export interface RecorderOptions {
  // false면 저장/삭제류 버튼을 기록할 때 알린다 (영상에서는 막힌다)
  mutates?: boolean
  onEvent: (event: RecordEvent) => void
}

// 이미 열린 페이지에 기록기를 붙인다. 페이지 이동 뒤에도 다시 붙도록 이 탭에 init script를 건다
export async function attachRecorder(page: Page, { mutates = false, onEvent }: RecorderOptions) {
  const label = (target: Target) => target.name ?? target.text ?? ''
  const resolve = async (id: string, candidates: Target[]) => {
    const found = await resolveTarget(page, id, candidates)
    if (!found) {
      onEvent({ kind: 'warning', message: '누른 곳을 다시 찾을 수 있는 방법이 없어 기록하지 못했습니다. 단계를 직접 추가하세요' })
      return undefined
    }
    return found
  }
  // 붙잡아 둔 클릭을 기록기가 대신 누른다. 그동안 페이지 스크립트는 이벤트를 붙잡지 않는다
  const replay = async (fn: () => Promise<unknown>) => {
    await page.evaluate(() => ((window as unknown as { __ariadneReplaying: boolean }).__ariadneReplaying = true)).catch(() => {})
    try {
      await fn()
    } finally {
      await page.evaluate(() => ((window as unknown as { __ariadneReplaying: boolean }).__ariadneReplaying = false)).catch(() => {})
    }
  }
  await page.exposeBinding('__ariadneRecord', async (_source, event: PageEvent) => {
    if (event.kind === 'control') return onEvent({ kind: event.action })
    if (event.kind === 'click') {
      const found = await resolveTarget(page, event.id, event.candidates)
      if (!found) {
        await replay(() => page.mouse.click(event.x, event.y))
        return onEvent({ kind: 'warning', message: '누른 곳을 다시 찾을 수 있는 방법이 없어 기록하지 못했습니다. 단계를 직접 추가하세요' })
      }
      const clicked = await replay(() => locate(page, found.target).click({ timeout: 5000 })).then(
        () => true,
        () => false,
      )
      if (!clicked) await replay(() => page.mouse.click(event.x, event.y))
      const blocked = !mutates && isBlockedLabel(label(found.target))
      const warning = !clicked
        ? '기록한 대상으로 누르지 못했습니다. 미리보기로 확인하세요'
        : blocked
          ? `"${label(found.target)}"은(는) 'STG에 실제 저장 허용'을 켜야 영상에서 누를 수 있습니다`
          : found.weak
            ? '이름이 없는 요소라 화면이 바뀌면 다른 요소를 누를 수 있습니다. 확인하세요'
            : undefined
      return onEvent({ kind: 'step', step: { click: found.target }, ...(warning ? { warning } : {}) })
    }
    const found = await resolve(event.id, event.candidates)
    if (!found) return
    const weak = found.weak ? { warning: '이름이 없는 요소라 화면이 바뀌면 다른 요소를 누를 수 있습니다. 확인하세요' } : {}
    if (event.kind === 'type') return onEvent({ kind: 'step', step: { type: { target: found.target, text: event.text } }, ...weak })
    if (event.kind === 'select') return onEvent({ kind: 'step', step: { select: { target: found.target, value: event.value } }, ...weak })
    if (event.purpose === 'mask') return onEvent({ kind: 'mask', target: found.target })
    if (event.purpose === 'wait') return onEvent({ kind: 'step', step: { waitFor: found.target } })
    return onEvent({ kind: 'step', step: { highlight: { target: found.target, ms: 2000 } } })
  })
  await page.addInitScript({ content: recordScript() })
  await page.evaluate(recordScript())
}

// 페이지에 넣는 기록 스크립트와 도구 막대. tsx가 함수에 helper를 끼워 넣지 않도록 문자열로 둔다
export function recordScript() {
  return `(() => {
  if (window.__ariadneRecorder || window.top !== window) return
  window.__ariadneRecorder = true
  const MARK = ${JSON.stringify(MARK)}
  const send = (event) => { try { window.__ariadneRecord(event) } catch {} }
  let seq = 0
  const mark = (el) => {
    const id = 'r' + Date.now().toString(36) + (++seq)
    el.setAttribute(MARK, id)
    setTimeout(() => { if (el.getAttribute(MARK) === id) el.removeAttribute(MARK) }, 5000)
    return id
  }
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim()
  const textOf = (el) => clean(el.innerText || el.textContent)
  const INTERACTIVE = 'button, a[href], summary, input, select, textarea, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=checkbox], [role=radio], [role=combobox], [role=switch], [role=treeitem], [role=menuitemcheckbox], [role=menuitemradio]'
  const TEXT_FIELD = 'textarea, [contenteditable=""], [contenteditable="true"], input:not([type]), input[type=text], input[type=email], input[type=search], input[type=tel], input[type=url], input[type=number], input[type=password], input[type=date]'
  const implicitRole = (el) => {
    const tag = el.tagName.toLowerCase()
    const type = (el.getAttribute('type') || '').toLowerCase()
    if (tag === 'button' || (tag === 'input' && ['button', 'submit', 'reset'].includes(type))) return 'button'
    if (tag === 'a' && el.hasAttribute('href')) return 'link'
    if (tag === 'input' && type === 'checkbox') return 'checkbox'
    if (tag === 'input' && type === 'radio') return 'radio'
    if (tag === 'select') return 'combobox'
    if (el.matches(TEXT_FIELD)) return 'textbox'
    if (tag === 'tr') return 'row'
    if (tag === 'td') return 'cell'
    if (/^h[1-6]$/.test(tag)) return 'heading'
    return ''
  }
  const labelOf = (el) => {
    if (el.labels && el.labels[0]) return textOf(el.labels[0])
    const by = el.getAttribute('aria-labelledby')
    if (by) return clean(by.split(' ').map((id) => document.getElementById(id)).filter(Boolean).map(textOf).join(' '))
    return ''
  }
  const candidates = (el, preferText) => {
    const list = []
    const role = el.getAttribute('role') || implicitRole(el)
    const field = el.matches('input, select, textarea')
    const name = clean(el.getAttribute('aria-label') || (field ? labelOf(el) : textOf(el)) || el.getAttribute('title') || el.getAttribute('alt')).slice(0, 80)
    const text = field ? '' : textOf(el)
    if (preferText && text && text.length <= 80) list.push({ text })
    if (role && name) list.push({ role, name })
    if (field) {
      const label = labelOf(el)
      if (label) list.push({ label })
      if (el.getAttribute('placeholder')) list.push({ placeholder: el.getAttribute('placeholder') })
    }
    if (!preferText && text && text.length <= 80) list.push({ text })
    if (role) list.push({ role })
    return list
  }

  // 도구 막대
  let mode = 'record'
  const host = document.createElement('ariadne-recorder')
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = '<style>' +
    // 화면 위쪽(메뉴·제목)을 가리지 않게 오른쪽 아래에 둔다
    ':host{all:initial;position:fixed;bottom:12px;right:12px;z-index:2147483647;font:12px -apple-system,BlinkMacSystemFont,sans-serif}' +
    '.bar{display:flex;gap:4px;align-items:center;padding:6px;border-radius:10px;background:rgba(17,24,39,.92);color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.3)}' +
    '.dot{width:10px;height:10px;margin:0 6px;border-radius:50%;background:#ef4444;animation:b 1.2s infinite}@keyframes b{50%{opacity:.3}}' +
    'button{border:0;border-radius:6px;padding:6px 10px;background:rgba(255,255,255,.12);color:#fff;font:inherit;cursor:pointer}' +
    'button:hover{background:rgba(255,255,255,.22)}button.on{background:#f59e0b;color:#111}' +
    '.hint{padding:0 8px;color:#fcd34d}</style>' +
    '<div class="bar"><span class="dot"></span><b>기록 중</b>' +
    '<button data-mode="highlight">강조할 곳 고르기</button><button data-mode="mask">가릴 곳 고르기</button>' +
    '<button data-mode="wait">기다릴 글자 고르기</button><button data-action="scene">새 장면</button>' +
    '<button data-action="stop">기록 끝</button><span class="hint"></span></div>'
  const hint = root.querySelector('.hint')
  const box = document.createElement('div')
  Object.assign(box.style, { position: 'fixed', pointerEvents: 'none', zIndex: 2147483646, border: '2px solid #f59e0b', borderRadius: '6px', display: 'none' })
  const setMode = (next) => {
    mode = mode === next ? 'record' : next
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode))
    hint.textContent = mode === 'record' ? '' : '화면에서 요소를 누르세요'
    box.style.display = 'none'
  }
  root.addEventListener('click', (e) => {
    const button = e.target.closest('button')
    if (!button) return
    if (button.dataset.mode) setMode(button.dataset.mode)
    if (button.dataset.action) send({ kind: 'control', action: button.dataset.action })
  })
  const attach = () => {
    if (!document.documentElement) return
    if (!host.isConnected) document.documentElement.appendChild(host)
    if (!box.isConnected) document.documentElement.appendChild(box)
  }
  attach()
  document.addEventListener('DOMContentLoaded', attach)
  setInterval(attach, 500)

  const fromToolbar = (e) => e.composedPath().includes(host)
  const pickTarget = (e) => (mode === 'mask' || mode === 'highlight' ? e.target.closest(INTERACTIVE + ', tr, td, th, li, p, h1, h2, h3, h4, label, span, div') : e.target) || e.target
  addEventListener('mousemove', (e) => {
    if (mode === 'record' || fromToolbar(e)) return
    const r = pickTarget(e).getBoundingClientRect()
    Object.assign(box.style, { display: 'block', left: r.left - 3 + 'px', top: r.top - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' })
  }, true)
  // 붙잡은 누르기(고르기, 기록기가 대신 누를 클릭)는 click까지 화면에 전달하지 않는다
  let swallowing = false
  const replaying = () => window.__ariadneReplaying === true
  const swallow = (e) => {
    if (replaying() || fromToolbar(e) || (mode === 'record' && !swallowing)) return
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.type === 'click') swallowing = false
  }
  for (const type of ['mousedown', 'mouseup', 'pointerup', 'click', 'dblclick']) addEventListener(type, swallow, true)

  // 누르기 직전(pointerdown)에 붙잡아 기록한다. 요소가 아직 화면에 있을 때 기록기가 찾고 대신 누른다
  addEventListener('pointerdown', (e) => {
    if (replaying() || fromToolbar(e)) return
    if (mode !== 'record') {
      e.preventDefault()
      e.stopImmediatePropagation()
      const el = pickTarget(e)
      send({ kind: 'pick', purpose: mode, id: mark(el), candidates: candidates(el, mode === 'wait') })
      swallowing = true
      setTimeout(() => { swallowing = false }, 1500)
      setMode(mode)
      return
    }
    const el = e.target.closest(INTERACTIVE) || e.target
    // 입력칸은 그대로 두고 입력이 끝났을 때(change) 기록한다
    if (el.matches(TEXT_FIELD) || el.tagName === 'SELECT') return
    e.preventDefault()
    e.stopImmediatePropagation()
    swallowing = true
    setTimeout(() => { swallowing = false }, 1500)
    send({ kind: 'click', id: mark(el), candidates: candidates(el, false), x: e.clientX, y: e.clientY })
  }, true)

  addEventListener('change', (e) => {
    const el = e.target
    if (!(el instanceof Element) || fromToolbar(e) || replaying()) return
    if (el.tagName === 'SELECT') {
      const option = el.selectedOptions && el.selectedOptions[0]
      return send({ kind: 'select', id: mark(el), candidates: candidates(el, false), value: option ? clean(option.text) : el.value })
    }
    // 비밀번호는 기록하지 않는다
    if (el.matches(TEXT_FIELD) && el.getAttribute('type') !== 'password') {
      send({ kind: 'type', id: mark(el), candidates: candidates(el, false), text: el.value })
    }
  }, true)
})()`
}
