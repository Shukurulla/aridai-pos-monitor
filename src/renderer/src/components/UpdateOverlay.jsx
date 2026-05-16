import { useEffect, useState } from 'react'
import { T } from '../lib/theme'

// Doim ko'rinadigan kichik yangilanish paneli (pastki-o'ng burchak). POS
// har doim native — shuning uchun yangilanishni istalgan paytda shu yerdan
// tekshirib/o'rnatib bo'ladi.
export default function UpdateOverlay() {
  const [open, setOpen] = useState(false)
  const [ver, setVer] = useState('')
  const [st, setSt] = useState({ state: 'idle' })

  useEffect(() => {
    window.pos.updates.current().then((r) => setVer(r?.version || ''))
    const off = window.pos.updates.onEvent((p) => {
      setSt(p || { state: 'idle' })
      if (p && (p.state === 'available' || p.state === 'downloaded')) setOpen(true)
    })
    return off
  }, [])

  const s = st.state
  const has = s === 'available' || s === 'downloading' || s === 'downloaded'
  const label =
    s === 'checking'
      ? 'Проверка обновлений…'
      : s === 'available'
        ? `Доступна версия ${st.version || ''}`
        : s === 'downloading'
          ? `Загрузка ${st.percent || 0}%`
          : s === 'downloaded'
            ? `Версия ${st.version || ''} загружена`
            : s === 'latest'
              ? 'Установлена последняя версия'
              : s === 'error'
                ? 'Ошибка обновления'
                : ''

  const pillBg = s === 'downloaded' ? T.ready : has ? T.cta : 'rgba(10,10,10,0.82)'

  const btn = (bg, color) => ({
    height: 46,
    padding: '0 16px',
    background: bg,
    color,
    border: 'none',
    fontFamily: T.font,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer'
  })

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 100000, fontFamily: T.font }}>
      {open && (
        <div
          style={{
            width: 320,
            background: T.surface,
            border: `2px solid ${T.borderStrong}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.30)',
            marginBottom: 8,
            padding: 16
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>Обновления</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
            Текущая версия: <b style={{ color: T.text }}>{ver || '—'}</b>
          </div>
          {label && (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: 12,
                background: s === 'error' ? T.cancelledBg : T.panelStrong,
                color: s === 'error' ? T.cancelled : T.text,
                fontSize: 13,
                fontWeight: 700
              }}
            >
              {label}
              {s === 'error' && st.error ? ': ' + String(st.error).slice(0, 80) : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn(T.cta, '#fff')} onClick={() => window.pos.updates.check()}>
              Проверить
            </button>
            {s === 'available' && (
              <button style={btn(T.panelStrong, T.text)} onClick={() => window.pos.updates.download()}>
                Скачать
              </button>
            )}
            {s === 'downloaded' && (
              <button style={btn(T.ready, '#fff')} onClick={() => window.pos.updates.install()}>
                Установить и перезапустить
              </button>
            )}
            <button style={btn('transparent', T.textMuted)} onClick={() => setOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 44,
          padding: '0 16px',
          background: pillBg,
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: T.font
        }}
        title="Обновления"
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: s === 'downloaded' ? '#fff' : has ? '#fff' : T.textDim
          }}
        />
        {has || s === 'checking' ? label : `Обновления · v${ver || '—'}`}
      </button>
    </div>
  )
}
