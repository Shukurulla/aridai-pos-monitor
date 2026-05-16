import { useEffect, useState } from 'react'

// Ручной зум экрана (− / + / сброс). Сохраняется и применяется через CSS zoom.
const KEY = 'ui-zoom'
const MIN = 0.5
const MAX = 2
const STEP = 0.1
const clamp = (z) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100))

export default function ZoomControl() {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const saved = parseFloat(localStorage.getItem(KEY) || '1')
    setZoom(isNaN(saved) ? 1 : clamp(saved))
  }, [])

  useEffect(() => {
    document.documentElement.style.zoom = String(zoom)
    localStorage.setItem(KEY, String(zoom))
  }, [zoom])

  const btn = {
    width: 44,
    height: 44,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 24,
    fontWeight: 900,
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 10,
        bottom: 10,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(10,10,10,0.82)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 6,
        userSelect: 'none'
      }}
    >
      <button style={btn} onClick={() => setZoom((z) => clamp(z - STEP))} title="Уменьшить">
        −
      </button>
      <button
        style={{ ...btn, width: 58, fontSize: 14, fontWeight: 800 }}
        onClick={() => setZoom(1)}
        title="Сбросить (100%)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button style={btn} onClick={() => setZoom((z) => clamp(z + STEP))} title="Увеличить">
        +
      </button>
    </div>
  )
}
