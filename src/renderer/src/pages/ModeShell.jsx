import { useEffect, useState } from 'react'
import { T } from '../lib/theme'
import OfflineShell from './offline/OfflineShell'
import UpdateOverlay from '../components/UpdateOverlay'

export default function ModeShell({ auth, onLogout }) {
  const [mode, setMode] = useState('unknown')
  const [cashierUrl, setCashierUrl] = useState('')
  const [navOnline, setNavOnline] = useState(navigator.onLine)

  // Initial mode + subscribe to changes
  useEffect(() => {
    let unsub = null
    window.pos.mode.get().then((s) => {
      setMode(s.mode)
      setCashierUrl(s.cashierUrl)
    })
    unsub = window.pos.mode.onChange((newMode) => setMode(newMode))
    return () => { if (unsub) unsub() }
  }, [])

  // Browser-level online/offline (instant)
  useEffect(() => {
    const onOnline = () => setNavOnline(true)
    const onOffline = () => setNavOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Effective mode: agar OS internet uzilgan bo'lsa, online emas
  const effective = !navOnline ? 'offline' : mode

  let content
  if (effective === 'unknown') {
    content = (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bg,
          color: T.textMuted,
          fontFamily: T.font
        }}
      >
        Определяется режим…
      </div>
    )
  } else if (effective === 'online' && cashierUrl) {
    content = <OnlineWebview url={cashierUrl} />
  } else {
    content = <OfflineShell auth={auth} onLogout={onLogout} />
  }

  return (
    <>
      {content}
      <UpdateOverlay />
    </>
  )
}

function OnlineWebview({ url }) {
  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <webview src={url} style={{ width: '100%', height: '100%' }} allowpopups="true" />
    </div>
  )
}
