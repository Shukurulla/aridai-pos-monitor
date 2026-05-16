// Hub-client — Local Server (LAN) bilan ulanish.
// Default localhost:3011 (Local Server bir xil kompyuterda ishlasa)
const axios = require('axios')
const { makeStore } = require('./kv-store')

const store = makeStore('aridai-pos-hub')

const DEFAULT_HUB_URL = 'http://localhost:3011'

function getHubBaseUrl() {
  return store.get('hubBaseUrl') || DEFAULT_HUB_URL
}

function setHubBaseUrl(url) {
  store.set('hubBaseUrl', url)
}

async function hubRequest(method, path, body) {
  try {
    const url = getHubBaseUrl() + path
    const { data } = await axios({
      method: method || 'GET',
      url,
      data: body,
      timeout: 5000
    })
    return { success: true, data }
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || 'Hub unreachable'
    return { success: false, error: msg }
  }
}

module.exports = { hubRequest, getHubBaseUrl, setHubBaseUrl }
