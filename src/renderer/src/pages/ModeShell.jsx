import OfflineShell from './offline/OfflineShell'
import UpdateOverlay from '../components/UpdateOverlay'

// Webview butunlay YO'Q. Online ham, offline ham — doim shu native Electron UI.
// Ma'lumot doim native hub orqali oqadi (local-server: internet bo'lsa VPS'ga
// proksi, bo'lmasa lokal nusxa). Yangilanish paneli (UpdateOverlay) har doim
// ko'rinadi — shu sabab "online'da obnovleniya yo'q" muammosi yo'qoladi.
export default function ModeShell({ auth, onLogout }) {
  return (
    <>
      <OfflineShell auth={auth} onLogout={onLogout} />
      <UpdateOverlay />
    </>
  )
}
