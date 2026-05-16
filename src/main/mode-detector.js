// Online/Offline rejimni aniqlovchi.
// 1. VPS Cashier-web reachable bo'lsa → 'online' (webview ko'rsatish mumkin)
// 2. Aks holda → 'offline' (native UI)
const axios = require('axios')

const CASHIER_URL = process.env.CASHIER_URL || 'https://kepket-kz-cashier.vercel.app'
const VPS_HEALTH = process.env.VPS_HEALTH || 'https://kz.kepket.uz/api/health'

let interval = null
let currentMode = 'unknown' // 'online' | 'offline' | 'unknown'
let onChangeListener = null

async function check() {
  try {
    // VPS healthcheck — eng aniq ishonchli signal
    await axios.get(VPS_HEALTH, { timeout: 4000 })
    return 'online'
  } catch {
    return 'offline'
  }
}

function startModeDetector(onChange) {
  onChangeListener = onChange
  stopModeDetector()
  // Birinchi tezda
  check().then(broadcastIfChanged)
  // Keyin har 5 sekundda
  interval = setInterval(() => check().then(broadcastIfChanged), 5000)
}

function broadcastIfChanged(mode) {
  if (mode !== currentMode) {
    currentMode = mode
    console.log(`[mode-detector] mode = ${mode}`)
    if (onChangeListener) onChangeListener(mode)
  }
}

function stopModeDetector() {
  if (interval) clearInterval(interval)
  interval = null
}

function getMode() {
  return { mode: currentMode, cashierUrl: CASHIER_URL }
}

module.exports = { startModeDetector, stopModeDetector, getMode, CASHIER_URL }
