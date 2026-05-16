import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.js'),
          'mode-detector': resolve(__dirname, 'src/main/mode-detector.js'),
          auth: resolve(__dirname, 'src/main/auth.js'),
          'hub-client': resolve(__dirname, 'src/main/hub-client.js'),
          'kv-store': resolve(__dirname, 'src/main/kv-store.js')
        },
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, 'src/preload/index.js'), formats: ['cjs'] }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } }
    },
    plugins: [react()],
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } }
  }
})
