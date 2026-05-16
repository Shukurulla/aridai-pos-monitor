import { useEffect, useState } from 'react'
import { T } from '../../lib/theme'

export default function SettingsPage({ onLogout }) {
  const [hubUrl, setHubUrl] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.pos.hub.getUrl().then(setHubUrl)
  }, [])

  const handleSave = async () => {
    await window.pos.hub.setUrl(hubUrl.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // #16: обновления
  const [uv, setUv] = useState('')
  const [ust, setUst] = useState({ state: 'idle' })
  const [rels, setRels] = useState([])
  useEffect(() => {
    window.pos.updates.current().then((r) => setUv(r?.version || ''))
    const off = window.pos.updates.onEvent(setUst)
    window.pos.updates.releases().then((r) => {
      if (r && r.success) setRels(r.data || [])
    })
    return off
  }, [])
  const uLabel = () => {
    const s = ust.state
    if (s === 'checking') return 'Проверка…'
    if (s === 'available') return `Доступна версия ${ust.version}`
    if (s === 'downloading') return `Загрузка ${ust.percent || 0}%`
    if (s === 'downloaded') return `Версия ${ust.version} загружена`
    if (s === 'latest') return 'Установлена последняя версия'
    if (s === 'error') return 'Ошибка: ' + (ust.error || '')
    return ''
  }
  const ubtn = (bg, col) => ({
    height: 44,
    padding: '0 16px',
    background: bg,
    color: col,
    border: 'none',
    fontFamily: T.font,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer'
  })

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>Настройки</h1>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 28px' }}>
        Адрес локального сервера (LAN) и режим работы
      </p>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          URL локального сервера (Hub)
        </label>
        <input
          value={hubUrl}
          onChange={(e) => setHubUrl(e.target.value)}
          placeholder="http://192.168.1.10:3011"
          style={{
            width: '100%',
            height: 52,
            padding: '0 14px',
            fontSize: 16,
            fontFamily: T.font,
            background: T.panel,
            border: `2px solid ${T.border}`,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        <p style={{ fontSize: 12, color: T.textMuted, margin: '8px 0 16px' }}>
          POS-монитор подключается к этому адресу в офлайн-режиме (LAN API локального сервера).
        </p>
        <button
          onClick={handleSave}
          style={{
            padding: '12px 24px',
            background: T.cta,
            color: '#fff',
            border: 'none',
            fontFamily: T.font,
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          {saved ? 'Сохранено' : 'Сохранить'}
        </button>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>Обновления</h3>
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>
          Текущая версия: <b style={{ color: T.text }}>{uv || '—'}</b>
        </div>
        {uLabel() && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: 12,
              background: ust.state === 'error' ? T.cancelledBg : T.panelStrong,
              color: ust.state === 'error' ? T.cancelled : T.text,
              fontWeight: 700,
              fontSize: 14
            }}
          >
            {uLabel()}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: rels.length ? 14 : 0 }}>
          <button onClick={() => window.pos.updates.check()} style={ubtn(T.cta, '#fff')}>
            Проверить обновления
          </button>
          {ust.state === 'available' && (
            <button onClick={() => window.pos.updates.download()} style={ubtn(T.panelStrong, T.text)}>
              Скачать
            </button>
          )}
          {ust.state === 'downloaded' && (
            <button onClick={() => window.pos.updates.install()} style={ubtn(T.cta, '#fff')}>
              Установить и перезапустить
            </button>
          )}
        </div>
        {rels.length > 0 && (
          <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>
              Версии (откат):
            </div>
            {rels.slice(0, 10).map((r) => (
              <div
                key={r.tag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: `1px solid ${T.borderSoft}`
                }}
              >
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
                  {r.name}
                  {r.prerelease ? ' (beta)' : ''}
                </span>
                {(r.exe || []).slice(0, 1).map((a) => (
                  <button key={a.url} onClick={() => window.pos.updates.open(a.url)} style={ubtn(T.cta, '#fff')}>
                    Скачать .exe
                  </button>
                ))}
                <button onClick={() => window.pos.updates.open(r.url)} style={ubtn(T.panelStrong, T.text)}>
                  Открыть
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>Информация</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: T.text }}>
          <li>POS всегда работает в этом приложении (нативно), без веб-окна.</li>
          <li>Данные идут через Local Server: при интернете — синхронизация с сервером, без интернета — локально.</li>
          <li>Обновления приложения доступны всегда (кнопка «Обновления» внизу справа).</li>
        </ul>
      </div>

      <button
        onClick={() => onLogout && onLogout()}
        style={{
          marginTop: 20,
          height: 56,
          width: '100%',
          background: T.cancelledBg,
          color: T.cancelled,
          border: `2px solid ${T.cancelled}`,
          fontFamily: T.font,
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer'
        }}
      >
        Выйти из системы
      </button>
    </div>
  )
}
