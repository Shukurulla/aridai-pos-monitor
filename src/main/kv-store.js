// Minimal disk-backed key/value store (no native deps).
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

function makeStore(name) {
  const file = path.join(app.getPath('userData'), `${name}.json`)
  let cache = null

  function load() {
    if (cache !== null) return cache
    try {
      cache = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      cache = {}
    }
    return cache
  }

  function save() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(cache, null, 2))
    } catch (err) {
      console.error(`[kv-store:${name}] save failed:`, err)
    }
  }

  return {
    get(key) {
      const data = load()
      return data[key] !== undefined ? data[key] : null
    },
    set(key, value) {
      load()
      cache[key] = value
      save()
    },
    delete(key) {
      load()
      delete cache[key]
      save()
    }
  }
}

module.exports = { makeStore }
