const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pos', {
  auth: {
    login: (phone, password) => ipcRenderer.invoke('auth:login', { phone, password }),
    current: () => ipcRenderer.invoke('auth:current'),
    logout: () => ipcRenderer.invoke('auth:logout')
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
