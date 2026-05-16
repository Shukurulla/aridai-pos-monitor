import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { LoginScreen } from '@/components/cashier/screens/Login'
import { CashierApp } from '@/components/cashier/CashierApp'

// pos-monitor endi aynan cashier-web kassir UI'sini native ko'rsatadi
// (web bilan bir xil dizayn + ishlash). Ma'lumot window.pos.hub orqali:
// online → Local Server VPS'ga proksi, offline → lokal nusxa.
function Root() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#a8a294',
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: 18
        }}
      >
        Загрузка…
      </div>
    )
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'auto',
        background: '#f4f1ea'
      }}
    >
      {isAuthenticated ? <CashierApp /> : <LoginScreen />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
)
