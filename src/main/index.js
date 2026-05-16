const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const https = require('https')
const { loginCashier, getStoredAuth, clearAuth } = require('./auth')
const { startModeDetector, stopModeDetector, getMode } = require('./mode-detector')
const { hubRequest, setHubBaseUrl, getHubBaseUrl } = require('./hub-client')

let mainWindow = null

// ── Ekran zoom'i: ELECTRON-NATIVE (setZoomFactor — sahifa qayta joylanadi,
//    chetda bo'sh joy QOLMAYDI). Saqlanadi, qayta yuklanganda tiklanadi.
const fs = require('fs')
let currentZoom = 1
const clampZoom = (f) => Math.min(2, Math.max(0.5, Math.round((Number(f) || 1) * 100) / 100))
function zoomFile() {
  return path.join(app.getPath('userData'), 'ui-zoom.json')
}
function loadZoom() {
  try {
    const f = Number(JSON.parse(fs.readFileSync(zoomFile(), 'utf8')).factor)
    currentZoom = f >= 0.5 && f <= 2 ? f : 1
  } catch {
    currentZoom = 1
  }
  return currentZoom
}
function applyZoom(f) {
  currentZoom = clampZoom(f)
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.setZoomFactor(currentZoom)
  } catch {
    /* ignore */
  }
  try {
    fs.writeFileSync(zoomFile(), JSON.stringify({ factor: currentZoom }))
  } catch {
    /* ignore */
  }
  return currentZoom
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    title: 'AridaiPOS Monitor',
    backgroundColor: '#f4f2ed',
    // Весь экран по рабочей области, но БЕЗ kiosk — панель задач остаётся видимой
    fullscreen: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true // <webview> ishlatilishi uchun
    }
  })
  mainWindow.maximize()

  const indexFile = path.join(__dirname, '../renderer/index.html')
  const devUrl = process.env.ELECTRON_RENDERER_URL

  // Dev-server (localhost) ochiqligini YUKLASHDAN OLDIN tekshiramiz.
  // Internetsiz/offline bo'lsa Vite dev server javob bermaydi — o'shanda
  // qurilgan lokal bundle'ni (file://) yuklaymiz. Shunda offline'da hech
  // qachon localhost so'rovi bo'lmaydi, xato chiqmaydi, reload ham ishlaydi.
  function pingDev(url) {
    return new Promise((resolve) => {
      try {
        const http = require('http')
        const u = new URL(url)
        const req = http.get(
          { host: u.hostname, port: u.port || 80, path: '/', timeout: 1500 },
          (res) => { res.destroy(); resolve(true) }
        )
        req.on('error', () => resolve(false))
        req.on('timeout', () => { req.destroy(); resolve(false) })
      } catch {
        resolve(false)
      }
    })
  }

  async function loadApp() {
    if (devUrl && (await pingDev(devUrl))) {
      mainWindow.loadURL(devUrl)
      mainWindow.webContents.openDevTools()
      return
    }
    if (devUrl) console.warn('[main] dev server unreachable (offline) — built bundle yuklanmoqda')
    mainWindow.loadFile(indexFile)
  }

  // Xavfsizlik to'ri: yuklash o'rtada uzilsa — built bundle'ga tushamiz.
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    if (errorCode === -3) return // ABORTED
    if (validatedURL && validatedURL.startsWith('file://')) return
    console.warn(`[main] renderer load failed (${errorCode} ${errorDesc}) — fallback to built bundle`)
    mainWindow.loadFile(indexFile)
  })

  // Har yuklanganda saqlangan zoom'ni tiklash
  mainWindow.webContents.on('did-finish-load', () => {
    try {
      mainWindow.webContents.setZoomFactor(loadZoom())
    } catch {
      /* ignore */
    }
  })

  // Reload (Cmd/Ctrl+R yoki F5) + zoom klavishlari (Ctrl/Cmd +/−/0).
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const k = String(input.key || '').toLowerCase()
    if (k === 'f5' || ((input.control || input.meta) && k === 'r')) {
      e.preventDefault()
      loadApp()
    } else if ((input.control || input.meta) && (k === '=' || k === '+' || input.key === '+')) {
      e.preventDefault()
      applyZoom(currentZoom + 0.1)
    } else if ((input.control || input.meta) && (k === '-' || k === '_')) {
      e.preventDefault()
      applyZoom(currentZoom - 0.1)
    } else if ((input.control || input.meta) && k === '0') {
      e.preventDefault()
      applyZoom(1)
    }
  })

  loadApp()

  // Mode change'larni renderer'ga yuborib turish
  startModeDetector((mode) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mode:changed', mode)
    }
  })
}

// Bitta nusxa — qayta ochilsa mavjud oynani fokuslaymiz
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // Windows yonganda avtomatik ishga tushsin (faqat o'rnatilgan .exe da)
  try {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true })
  } catch (_) {}
  createWindow()
  setupAutoUpdater()
})

app.on('window-all-closed', () => {
  stopModeDetector()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ===================== IPC =====================

ipcMain.handle('auth:login', async (_, { phone, password }) => loginCashier(phone, password))
ipcMain.handle('auth:current', () => getStoredAuth())
ipcMain.handle('auth:logout', () => { clearAuth(); return { success: true } })

ipcMain.handle('mode:get', () => getMode())

// Ekran zoom'i (Electron-native)
ipcMain.handle('zoom:get', () => currentZoom)
ipcMain.handle('zoom:set', (_, f) => applyZoom(f))

// Hub (Local Server LAN API) settings
ipcMain.handle('hub:get-url', () => getHubBaseUrl())
ipcMain.handle('hub:set-url', (_, url) => { setHubBaseUrl(url); return { success: true } })
ipcMain.handle('hub:request', async (_, { method, path: p, body }) => {
  return hubRequest(method, p, body)
})

// ===================== Auto-updater (#16) =====================
const GH_OWNER = 'Shukurulla'
const GH_REPO = 'aridai-pos-monitor'
let _au = null
function getAU() {
  if (_au) return _au
  try {
    _au = require('electron-updater').autoUpdater
    _au.autoDownload = false
    _au.autoInstallOnAppQuit = true
    _au.allowDowngrade = true
    // GitHub'da differential (blockmap, bo'lakma-bo'lak) yuklash juda sekin —
    // o'chiramiz, to'liq bitta fayl yuklansin (Telegram'dek tez).
    _au.disableDifferentialDownload = true
  } catch (e) {
    console.warn('[updater] unavailable:', e.message)
    _au = null
  }
  return _au
}
function sendUpd(p) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:event', p)
  } catch {
    /* ignore */
  }
}
function setupAutoUpdater() {
  const au = getAU()
  if (!au || !app.isPackaged) return
  au.on('checking-for-update', () => sendUpd({ state: 'checking' }))
  au.on('update-available', (i) => sendUpd({ state: 'available', version: i?.version }))
  au.on('update-not-available', (i) => sendUpd({ state: 'latest', version: i?.version }))
  au.on('download-progress', (p) => sendUpd({ state: 'downloading', percent: Math.round(p?.percent || 0) }))
  au.on('update-downloaded', (i) => sendUpd({ state: 'downloaded', version: i?.version }))
  au.on('error', (e) => sendUpd({ state: 'error', error: String((e && e.message) || e) }))
  setTimeout(() => au.checkForUpdates().catch(() => {}), 8000)
}
ipcMain.handle('updates:current', () => ({ version: app.getVersion(), packaged: app.isPackaged }))
ipcMain.handle('updates:check', async () => {
  const au = getAU()
  if (!au) return { success: false, error: 'Updater недоступен' }
  if (!app.isPackaged) return { success: false, error: 'Доступно только в установленном приложении' }
  try {
    const r = await au.checkForUpdates()
    return { success: true, version: r?.updateInfo?.version }
  } catch (e) {
    return { success: false, error: e.message }
  }
})
ipcMain.handle('updates:download', async () => {
  const au = getAU()
  if (!au) return { success: false, error: 'Updater недоступен' }
  try {
    await au.downloadUpdate()
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})
ipcMain.handle('updates:install', () => {
  const au = getAU()
  if (!au) return { success: false }
  setImmediate(() => au.quitAndInstall(false, true))
  return { success: true }
})
ipcMain.handle('updates:releases', () =>
  new Promise((resolve) => {
    const req = https.get(
      {
        host: 'api.github.com',
        path: `/repos/${GH_OWNER}/${GH_REPO}/releases?per_page=20`,
        headers: { 'User-Agent': 'AridaiPOS', Accept: 'application/vnd.github+json' },
        timeout: 8000
      },
      (res) => {
        let body = ''
        res.on('data', (d) => (body += d))
        res.on('end', () => {
          try {
            const arr = JSON.parse(body)
            if (!Array.isArray(arr))
              return resolve({ success: false, error: 'GitHub: ' + (arr.message || 'нет релизов'), data: [] })
            resolve({
              success: true,
              data: arr.map((r) => ({
                tag: r.tag_name,
                name: r.name || r.tag_name,
                prerelease: !!r.prerelease,
                publishedAt: r.published_at,
                url: r.html_url,
                exe: (r.assets || [])
                  .filter((a) => /\.exe$/i.test(a.name))
                  .map((a) => ({ name: a.name, url: a.browser_download_url }))
              }))
            })
          } catch (e) {
            resolve({ success: false, error: e.message, data: [] })
          }
        })
      }
    )
    req.on('error', (e) => resolve({ success: false, error: e.message, data: [] }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ success: false, error: 'timeout', data: [] })
    })
  })
)
ipcMain.handle('updates:open', (_, url) => {
  try {
    shell.openExternal(String(url))
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})
