import { useEffect, useRef, useState, useCallback } from 'react'
import { T } from '../lib/theme'

// Suzuvchi raqamli klaviatura. Fokusdagi input/textarea ga yozadi.
// Header'dagi tugma orqali ochiladi; markazda paydo bo'ladi; tepa
// chizig'idan ushlab ekranning istalgan joyiga ko'chirish mumkin.
export default function Numpad({ open, onClose }) {
  const fieldRef = useRef(null) // oxirgi fokuslangan input/textarea
  const [pos, setPos] = useState(null) // null = markaz; {x,y} = ko'chirilgan
  const dragRef = useRef(null)
  const boxRef = useRef(null)

  // Fokusdagi input'ni doimiy kuzatib boramiz (yopiq bo'lsa ham)
  useEffect(() => {
    const onFocusIn = (e) => {
      const el = e.target
      if (!el) return
      const tag = el.tagName
      if (tag === 'TEXTAREA') {
        fieldRef.current = el
        return
      }
      if (tag === 'INPUT') {
        const t = (el.getAttribute('type') || 'text').toLowerCase()
        if (['text', 'tel', 'number', 'search', 'password', 'email', ''].includes(t)) {
          fieldRef.current = el
        }
      }
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  const apply = useCallback((key) => {
    const el = fieldRef.current
    if (!el || !el.isConnected) return
    const isNumber = el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'number'
    const v = el.value != null ? String(el.value) : ''
    let start
    let end
    if (isNumber) {
      start = v.length
      end = v.length
    } else {
      start = el.selectionStart == null ? v.length : el.selectionStart
      end = el.selectionEnd == null ? v.length : el.selectionEnd
    }

    let next = v
    let caret = start
    if (key === 'clear') {
      next = ''
      caret = 0
    } else if (key === 'back') {
      if (start !== end) {
        next = v.slice(0, start) + v.slice(end)
        caret = start
      } else if (start > 0) {
        next = v.slice(0, start - 1) + v.slice(start)
        caret = start - 1
      }
    } else {
      // raqam yoki '00'
      next = v.slice(0, start) + key + v.slice(end)
      caret = start + key.length
    }

    const proto =
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, next)
    // React onChange ishga tushishi uchun haqiqiy input event
    el.dispatchEvent(new Event('input', { bubbles: true }))
    try {
      el.focus()
      if (!isNumber) el.setSelectionRange(caret, caret)
    } catch {
      /* number input setSelectionRange'ni qo'llamaydi */
    }
  }, [])

  // Drag — tepa chiziqdan ushlab ko'chirish
  const onDragStart = (e) => {
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      w: rect.width,
      h: rect.height
    }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      let x = ev.clientX - d.dx
      let y = ev.clientY - d.dy
      x = Math.max(0, Math.min(x, window.innerWidth - d.w))
      y = Math.max(0, Math.min(y, window.innerHeight - d.h))
      setPos({ x, y })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

  if (!open) return null

  const boxStyle = pos
    ? { left: pos.x, top: pos.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'back']

  // mousedown'da preventDefault — fokus inputdan ketmaydi (caret saqlanadi)
  const noBlur = (e) => e.preventDefault()

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed',
        zIndex: 99999,
        width: 320,
        background: T.surface,
        border: `2px solid ${T.borderStrong}`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.30)',
        userSelect: 'none',
        ...boxStyle
      }}
    >
      {/* Drag handle / header */}
      <div
        onMouseDown={onDragStart}
        style={{
          height: 44,
          background: T.borderStrong,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 14px',
          cursor: 'move',
          fontFamily: T.font
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>⠿ Клавиатура</span>
        <button
          onMouseDown={noBlur}
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            color: '#fff',
            border: 'none',
            fontSize: 20,
            fontWeight: 900,
            cursor: 'pointer'
          }}
          title="Закрыть"
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {keys.map((k) => {
            const isBack = k === 'back'
            return (
              <button
                key={k}
                onMouseDown={noBlur}
                onClick={() => apply(isBack ? 'back' : k)}
                style={{
                  height: 64,
                  background: isBack ? T.panelStrong : T.panel,
                  color: T.text,
                  border: `2px solid ${T.border}`,
                  fontFamily: T.font,
                  fontSize: 24,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {isBack ? '⌫' : k}
              </button>
            )
          })}
        </div>
        <button
          onMouseDown={noBlur}
          onClick={() => apply('clear')}
          style={{
            width: '100%',
            height: 52,
            marginTop: 8,
            background: T.cancelledBg,
            color: T.cancelled,
            border: 'none',
            fontFamily: T.font,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.4,
            cursor: 'pointer'
          }}
        >
          Очистить
        </button>
      </div>
    </div>
  )
}
