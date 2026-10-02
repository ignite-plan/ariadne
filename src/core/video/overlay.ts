// 녹화 화면 위에 그리는 자막, 커서, 클릭 표시, 하이라이트, 시작 카드.
// ffmpeg에 libass가 없어 자막을 영상에 새길 수 없으므로 페이지에 직접 그린다.
// tsx(esbuild)가 함수에 helper를 끼워 넣으면 브라우저에서 깨지므로 함수가 아닌 문자열로 주입한다.

export interface OverlayOptions {
  // 이메일·전화번호처럼 보이는 글자를 자동으로 blur
  personal?: boolean
}

// 이 속성이 붙은 요소는 blur된다. 시나리오 mask Target은 runner가 이 속성을 붙인다
export const MASK_ATTR = 'data-ariadne-mask'

// window.__ariadneVideo API. 상태는 sessionStorage에 두어 전체 새로고침 뒤에도 다시 그린다
export interface OverlayApi {
  caption(text: string | null): void
  card(title: string | null, subtitle?: string): void
  highlight(rect: { x: number; y: number; width: number; height: number }, ms: number): void
}

export function overlayScript({ personal = false }: OverlayOptions = {}) {
  return `(() => {
  if (window.__ariadneVideo || window.top !== window) return
  const KEY = '__ariadneVideo'
  const PERSONAL = ${JSON.stringify(personal)}
  const MASK_ATTR = ${JSON.stringify(MASK_ATTR)}
  const EMAIL = /[\\w.+-]+@[\\w-]+\\.[\\w.-]+/
  const PHONE = /(\\+?1[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4}/
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') } catch { return {} } }
  const state = Object.assign({ caption: null, card: null, cursor: null }, load())
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)) } catch {} }

  const CSS = \`
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .cursor { position: absolute; left: 0; top: 0; width: 28px; height: 28px; opacity: 0; will-change: transform;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    .cursor.on { opacity: 1; }
    .ripple { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(37,99,235,.35); border: 2px solid rgba(37,99,235,.8); animation: ripple .55s ease-out forwards; }
    @keyframes ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }
    .hl { position: absolute; border: 3px solid #f59e0b; border-radius: 8px; box-shadow: 0 0 0 6px rgba(245,158,11,.22);
      transition: opacity .25s; }
    .caption { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%); max-width: 78vw;
      padding: 14px 28px; border-radius: 12px; background: rgba(17,24,39,.84); color: #fff; text-align: center;
      font-size: 26px; font-weight: 600; line-height: 1.4; letter-spacing: .1px; opacity: 0; transition: opacity .2s; }
    .caption.on { opacity: 1; }
    .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; background: linear-gradient(135deg, rgba(0,44,95,.94), rgba(0,24,58,.97)); color: #fff;
      opacity: 0; transition: opacity .35s; backdrop-filter: blur(6px); }
    .card.on { opacity: 1; }
    .card.on ~ .cursor { opacity: 0; }
    .card h1 { margin: 0; font-size: 54px; font-weight: 700; letter-spacing: -.5px; text-align: center; max-width: 80vw; }
    .card p { margin: 0; font-size: 24px; color: rgba(255,255,255,.72); }
  \`
  const CURSOR = '<svg viewBox="0 0 28 28" width="28" height="28"><path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.6 16 L20 16 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'

  let host, root, els
  const ensure = () => {
    if (host && host.isConnected) return true
    if (!document.documentElement) return false
    host = document.createElement('ariadne-video-overlay')
    root = host.attachShadow({ mode: 'closed' })
    root.innerHTML = '<style>' + CSS + '</style><div class="card"><h1></h1><p></p></div><div class="caption"></div><div class="cursor">' + CURSOR + '</div>'
    els = { card: root.querySelector('.card'), caption: root.querySelector('.caption'), cursor: root.querySelector('.cursor') }
    document.documentElement.appendChild(host)
    if (!document.getElementById('ariadne-video-mask')) {
      const style = document.createElement('style')
      style.id = 'ariadne-video-mask'
      style.textContent = '[' + MASK_ATTR + ']{ filter: blur(7px) !important; }'
      document.documentElement.appendChild(style)
    }
    render()
    return true
  }
  const render = () => {
    els.caption.textContent = state.caption || ''
    els.caption.classList.toggle('on', !!state.caption)
    els.card.querySelector('h1').textContent = state.card ? state.card.title : ''
    els.card.querySelector('p').textContent = state.card && state.card.subtitle ? state.card.subtitle : ''
    els.card.classList.toggle('on', !!state.card)
    if (state.cursor) {
      els.cursor.style.transform = 'translate(' + (state.cursor.x - 5) + 'px,' + (state.cursor.y - 3) + 'px)'
      els.cursor.classList.add('on')
    }
  }

  addEventListener('mousemove', (e) => {
    state.cursor = { x: e.clientX, y: e.clientY }
    if (ensure()) render()
    save()
  }, { capture: true, passive: true })
  addEventListener('mousedown', (e) => {
    if (!ensure()) return
    const r = document.createElement('div')
    r.className = 'ripple'
    r.style.left = e.clientX + 'px'
    r.style.top = e.clientY + 'px'
    root.appendChild(r)
    setTimeout(() => r.remove(), 600)
  }, { capture: true, passive: true })
  // 개인정보처럼 보이는 글자의 부모 요소를 가린다. 화면이 바뀔 때마다 다시 본다
  const personalText = (text) => text && text.length >= 6 && (EMAIL.test(text) || PHONE.test(text))
  const scan = () => {
    if (!document.body) return
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement
      if (el && !el.hasAttribute(MASK_ATTR) && personalText(node.nodeValue)) el.setAttribute(MASK_ATTR, '')
    }
    for (const input of document.querySelectorAll('input, textarea')) {
      if (!input.hasAttribute(MASK_ATTR) && personalText(input.value)) input.setAttribute(MASK_ATTR, '')
    }
  }
  if (PERSONAL) {
    let queued = false
    const queue = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => { queued = false; scan() })
    }
    const observe = () => {
      if (!document.body) return false
      new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true })
      document.addEventListener('input', queue, true)
      scan()
      return true
    }
    if (!observe()) document.addEventListener('DOMContentLoaded', observe)
  }
  document.addEventListener('DOMContentLoaded', ensure)
  // SPA가 documentElement 자식을 갈아끼워도 다시 붙인다
  setInterval(ensure, 300)

  window.__ariadneVideo = {
    caption(text) { state.caption = text || null; save(); if (ensure()) render() },
    card(title, subtitle) { state.card = title ? { title, subtitle } : null; save(); if (ensure()) render() },
    highlight(rect, ms) {
      if (!ensure()) return
      const pad = 6
      const box = document.createElement('div')
      box.className = 'hl'
      Object.assign(box.style, { left: rect.x - pad + 'px', top: rect.y - pad + 'px', width: rect.width + pad * 2 + 'px', height: rect.height + pad * 2 + 'px' })
      root.insertBefore(box, els.caption)
      setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.remove(), 300) }, ms)
    },
  }
  ensure()
})()`
}
