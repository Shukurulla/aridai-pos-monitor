const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pos', {
  auth: {
    login: (phone, password) => ipcRenderer.invoke('auth:login', { phone, password }),
    current: () => ipcRenderer.invoke('auth:current'),
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  // Doimiy kassir sessiyasi (main, userData) — bir marta login, keyin avto
  session: {
    get: () => ipcRenderer.invoke('session:get'),
    set: (s) => ipcRenderer.invoke('session:set', s),
    clear: () => ipcRenderer.invoke('session:clear')
  },
  zoom: {
    get: () => ipcRenderer.invoke('zoom:get'),
    set: (factor) => ipcRenderer.invoke('zoom:set', factor)
  },
  mode: {
    get: () => ipcRenderer.invoke('mode:get'),
    onChange: (cb) => {
      const handler = (_e, mode) => cb(mode)
      ipcRenderer.on('mode:changed', handler)
      return () => ipcRenderer.removeListener('mode:changed', handler)
    }
  },
  hub: {
    getUrl: () => ipcRenderer.invoke('hub:get-url'),
    setUrl: (url) => ipcRenderer.invoke('hub:set-url', url),
    request: (method, path, body) => ipcRenderer.invoke('hub:request', { method, path, body })
  },
  updates: {
    current: () => ipcRenderer.invoke('updates:current'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    releases: () => ipcRenderer.invoke('updates:releases'),
    open: (url) => ipcRenderer.invoke('updates:open', url),
    onEvent: (cb) => {
      const h = (_e, p) => cb(p)
      ipcRenderer.on('updates:event', h)
      return () => ipcRenderer.removeListener('updates:event', h)
    }
  }
})

// ─── Cashier-web SPA ustiga native panellarni injekt qilamiz ────────────────
// Endi oyna = cashier-web (web bilan aynan bir xil). Zoom (− % +) va
// "Обновления" — Electron'niki, shu sahifaga qo'shiladi (saytda yo'q).
function injectNativeOverlays() {
  if (document.getElementById('__ar_overlays')) return
  const root = document.createElement('div')
  root.id = '__ar_overlays'
  root.style.cssText = 'all:initial'
  document.documentElement.appendChild(root)

  const mk = (tag, css, txt) => {
    const e = document.createElement(tag)
    if (css) e.style.cssText = css
    if (txt != null) e.textContent = txt
    return e
  }
  const FONT = 'Arial,Helvetica,sans-serif'

  // ── Zoom (pastki-chap) ──
  let zoom = 1
  const zWrap = mk(
    'div',
    'position:fixed;left:10px;bottom:10px;z-index:2147483600;display:flex;align-items:center;background:rgba(10,10,10,.85);border:1px solid rgba(255,255,255,.25);border-radius:6px;font-family:' +
      FONT
  )
  const zBtn = (label, fn) => {
    const b = mk(
      'button',
      'width:44px;height:44px;border:none;background:transparent;color:#fff;font-size:22px;font-weight:900;cursor:pointer',
      label
    )
    b.onclick = fn
    return b
  }
  const zPct = mk(
    'button',
    'width:58px;height:44px;border:none;background:transparent;color:#fff;font-size:14px;font-weight:800;cursor:pointer',
    '100%'
  )
  const clampZ = (z) => Math.min(2, Math.max(0.5, Math.round(z * 100) / 100))
  const applyZ = (z) => {
    zoom = clampZ(z)
    zPct.textContent = Math.round(zoom * 100) + '%'
    ipcRenderer.invoke('zoom:set', zoom).catch(() => {})
  }
  zPct.onclick = () => applyZ(1)
  zWrap.appendChild(zBtn('−', () => applyZ(zoom - 0.1)))
  zWrap.appendChild(zPct)
  zWrap.appendChild(zBtn('+', () => applyZ(zoom + 0.1)))
  root.appendChild(zWrap)
  ipcRenderer
    .invoke('zoom:get')
    .then((f) => {
      zoom = clampZ(Number(f) || 1)
      zPct.textContent = Math.round(zoom * 100) + '%'
    })
    .catch(() => {})

  // ── Обновления (pastki-o'ng) ──
  let ver = ''
  let st = { state: 'idle' }
  const uWrap = mk(
    'div',
    'position:fixed;right:12px;bottom:12px;z-index:2147483600;font-family:' + FONT
  )
  const panel = mk(
    'div',
    'display:none;width:320px;background:#fff;border:2px solid #0a0a0a;box-shadow:0 12px 40px rgba(0,0,0,.3);margin-bottom:8px;padding:16px;color:#0a0a0a'
  )
  const pTitle = mk('div', 'font-size:15px;font-weight:900;margin-bottom:4px', 'Обновления')
  const pVer = mk('div', 'font-size:13px;color:#6b6657;margin-bottom:10px')
  const pStat = mk('div', 'font-size:13px;font-weight:700;padding:8px 12px;margin-bottom:10px;background:#ece7da;display:none')
  const pBtns = mk('div', 'display:flex;gap:8px;flex-wrap:wrap')
  const ubtn = (label, bg, col) => {
    const b = mk(
      'button',
      'height:44px;padding:0 14px;border:none;background:' +
        bg +
        ';color:' +
        col +
        ';font-size:14px;font-weight:800;cursor:pointer;font-family:' +
        FONT,
      label
    )
    return b
  }
  const bCheck = ubtn('Проверить', '#d72121', '#fff')
  const bDl = ubtn('Скачать', '#ece7da', '#0a0a0a')
  const bInst = ubtn('Установить и перезапустить', '#1f7a3a', '#fff')
  const bClose = ubtn('Закрыть', 'transparent', '#6b6657')
  bCheck.onclick = () => ipcRenderer.invoke('updates:check').catch(() => {})
  bDl.onclick = () => ipcRenderer.invoke('updates:download').catch(() => {})
  bInst.onclick = () => ipcRenderer.invoke('updates:install').catch(() => {})
  bClose.onclick = () => {
    panel.style.display = 'none'
  }
  pBtns.appendChild(bCheck)
  pBtns.appendChild(bDl)
  pBtns.appendChild(bInst)
  pBtns.appendChild(bClose)
  panel.appendChild(pTitle)
  panel.appendChild(pVer)
  panel.appendChild(pStat)
  panel.appendChild(pBtns)
  const pill = mk(
    'button',
    'display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;background:rgba(10,10,10,.85);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:6px;font-size:14px;font-weight:800;cursor:pointer;font-family:' +
      FONT
  )
  pill.onclick = () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
  }
  uWrap.appendChild(panel)
  uWrap.appendChild(pill)
  root.appendChild(uWrap)

  const render = () => {
    pVer.innerHTML = 'Текущая версия: <b style="color:#0a0a0a">' + (ver || '—') + '</b>'
    const s = st.state
    const has = s === 'available' || s === 'downloading' || s === 'downloaded'
    const label =
      s === 'checking'
        ? 'Проверка обновлений…'
        : s === 'available'
          ? 'Доступна версия ' + (st.version || '')
          : s === 'downloading'
            ? 'Загрузка ' + (st.percent || 0) + '%'
            : s === 'downloaded'
              ? 'Версия ' + (st.version || '') + ' загружена'
              : s === 'latest'
                ? 'Установлена последняя версия'
                : s === 'error'
                  ? 'Ошибка обновления'
                  : ''
    if (label) {
      pStat.style.display = 'block'
      pStat.style.background = s === 'error' ? '#f1d8d6' : '#ece7da'
      pStat.style.color = s === 'error' ? '#a8302a' : '#0a0a0a'
      pStat.textContent = label + (s === 'error' && st.error ? ': ' + String(st.error).slice(0, 80) : '')
    } else {
      pStat.style.display = 'none'
    }
    bDl.style.display = s === 'available' ? '' : 'none'
    bInst.style.display = s === 'downloaded' ? '' : 'none'
    pill.style.background = s === 'downloaded' ? '#1f7a3a' : has ? '#d72121' : 'rgba(10,10,10,.85)'
    pill.textContent = has || s === 'checking' ? label : 'Обновления · v' + (ver || '—')
    if (has) panel.style.display = panel.style.display || 'block'
  }
  ipcRenderer
    .invoke('updates:current')
    .then((r) => {
      ver = (r && r.version) || ''
      render()
    })
    .catch(() => render())
  ipcRenderer.on('updates:event', (_e, p) => {
    st = p || { state: 'idle' }
    if (st.state === 'available' || st.state === 'downloaded') panel.style.display = 'block'
    render()
  })
  render()
}

// Suzuvchi zoom/Обновления overlay O'CHIRILDI — ekran ustida turishi
// noqulay edi. Endi ular "Настройки" sahifasida (window.pos.zoom/updates).
// injectNativeOverlays() funksiyasi zaxira sifatida qoldirildi, chaqirilmaydi.
void injectNativeOverlays
