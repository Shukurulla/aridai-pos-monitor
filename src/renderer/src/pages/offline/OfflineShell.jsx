import { useState, useEffect, useMemo, useCallback } from 'react'
import { T, fmt } from '../../lib/theme'
import aridaiLogo from '../../assets/aridai-logo.png'
import Numpad from '../../components/Numpad'
import OrdersPage from './OrdersPage'
import MenuPage from './MenuPage'
import SaboyPage from './SaboyPage'
import ExpensesPage from './ExpensesPage'
import AdvancesPage from './AdvancesPage'
import ReportsPage from './ReportsPage'
import SettingsPage from './SettingsPage'

const NAV = [
  { id: 'orders', label: 'Заказы', icon: 'orders' },
  { id: 'menu', label: 'Меню', icon: 'pos' },
  { id: 'saboy', label: 'Сабой', icon: 'bag' },
  { id: 'expenses', label: 'Расходы', icon: 'money' },
  { id: 'advances', label: 'Авансы', icon: 'advance' },
  { id: 'reports', label: 'Отчёты', icon: 'reports' },
  { id: 'settings', label: 'Настройки', icon: 'settings' }
]

export default function OfflineShell({ auth, onLogout }) {
  const [page, setPage] = useState('orders')
  const [numpadOpen, setNumpadOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [shift, setShift] = useState(null)
  const [now, setNow] = useState(() =>
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  )

  const refresh = useCallback(async () => {
    const [o, s] = await Promise.all([
      window.pos.hub.request('GET', '/api/orders'),
      window.pos.hub.request('GET', '/api/shifts/active')
    ])
    setOrders(o.success ? o.data?.data || [] : [])
    setShift(s.success ? s.data?.data || null : null)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    const c = setInterval(
      () => setNow(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })),
      15000
    )
    return () => {
      clearInterval(t)
      clearInterval(c)
    }
  }, [refresh])

  // Kunlik tushum — paid orderlardan to'lov turi bo'yicha (web bilan bir xil)
  const sum = useMemo(() => {
    let total = 0
    let cash = 0
    let card = 0
    let click = 0
    for (const o of orders) {
      if (!(o.isPaid || o.status === 'paid')) continue
      const amt =
        o.grandTotal ||
        (o.items || [])
          .filter((i) => i.status !== 'cancelled' && !i.isCancelled)
          .reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0)
      total += amt
      const sp = o.paymentSplit
      if (o.paymentType === 'mixed' && sp) {
        cash += sp.cash || 0
        card += sp.card || 0
        click += sp.click || 0
      } else if (o.paymentType === 'card') card += amt
      else if (o.paymentType === 'click') click += amt
      else cash += amt
    }
    return { total, cash, card, click }
  }, [orders])

  const handleLogout = async () => {
    if (!confirm('Выйти из POS Monitor?')) return
    await window.pos.auth.logout()
    onLogout()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: T.font }}>
      {/* TOP HEADER */}
      <header
        style={{
          height: 72,
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0
        }}
      >
        {/* Logo + small offline badge + branch */}
        <div
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRight: `1px solid ${T.border}`,
            minWidth: 300
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img src={aridaiLogo} alt="Aridai" style={{ width: 40, height: 40 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.05 }}>AridaiPOS</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  color: T.cancelled,
                  background: T.cancelledBg,
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
                title="Нет связи с VPS — работа офлайн"
              >
                <span style={{ width: 7, height: 7, background: T.cancelled, borderRadius: 999 }} />
                ОФЛАЙН
              </span>
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
              {auth.restaurantName} · {auth.branchName || 'Филиал'}
            </div>
          </div>
        </div>

        {/* Summary — web bilan bir xil */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 26 }}>
          <HeaderStat label="Выручка" value={fmt(sum.total)} strong />
          <span style={{ width: 1, height: 36, background: T.border }} />
          <HeaderStat label="Наличные" value={fmt(sum.cash)} />
          <HeaderStat label="Карта" value={fmt(sum.card)} />
          <HeaderStat label="Перевод" value={fmt(sum.click)} />
        </div>

        {/* Shift + time */}
        <div
          style={{
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderLeft: `1px solid ${T.border}`
          }}
        >
          <div
            style={{
              background: shift ? T.readyBg : T.cancelledBg,
              color: shift ? T.ready : T.cancelled,
              padding: '9px 16px',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 0.3,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: shift ? T.ready : T.cancelled,
                borderRadius: 999
              }}
            />
            {shift ? `Смена №${shift.shiftNumber}` : 'Смена закрыта'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', padding: '0 4px' }}>
            {now}
          </div>
        </div>

        {/* User + logout */}
        <div
          style={{
            padding: '0 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderLeft: `1px solid ${T.border}`
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>
              {auth.staff?.firstName} {auth.staff?.lastName}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
              {roleLabel(auth.staff?.role)}
            </div>
          </div>
          <button
            onClick={() => setNumpadOpen((v) => !v)}
            title="Экранная клавиатура"
            style={{
              width: 52,
              height: 48,
              background: numpadOpen ? T.cta : T.surface,
              color: numpadOpen ? '#fff' : T.text,
              border: `2px solid ${numpadOpen ? T.cta : T.borderStrong}`,
              fontSize: 20,
              fontWeight: 800,
              fontFamily: T.font,
              cursor: 'pointer'
            }}
          >
            ⠿
          </button>
        </div>
      </header>

      {/* MAIN — sidebar + content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav current={page} onChange={setPage} />
        <main style={{ flex: 1, overflow: 'auto', background: T.bg }}>
          {page === 'orders' && <OrdersPage auth={auth} />}
          {page === 'menu' && <MenuPage auth={auth} />}
          {page === 'saboy' && <SaboyPage auth={auth} />}
          {page === 'expenses' && <ExpensesPage auth={auth} />}
          {page === 'advances' && <AdvancesPage auth={auth} />}
          {page === 'reports' && <ReportsPage auth={auth} />}
          {page === 'settings' && <SettingsPage auth={auth} onLogout={handleLogout} />}
        </main>
      </div>

      <Numpad open={numpadOpen} onClose={() => setNumpadOpen(false)} />
    </div>
  )
}

function SideNav({ current, onChange }) {
  return (
    <nav
      style={{
        width: 116,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}
    >
      {NAV.map((it) => {
        const active = it.id === current
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              height: 84,
              background: active ? T.cta : 'transparent',
              color: active ? '#fff' : T.text,
              border: 'none',
              borderBottom: `1px solid ${T.borderSoft}`,
              fontFamily: T.font,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: 0
            }}
          >
            <NavIcon kind={it.icon} color={active ? '#fff' : T.text} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function NavIcon({ kind, color = 'currentColor' }) {
  const svgs = {
    orders: <path d="M3 5h18M3 12h18M3 19h18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />,
    pos: <><rect x="3" y="6" width="18" height="13" rx="1" stroke={color} strokeWidth="2.2" /><path d="M7 3v3M17 3v3M3 11h18" stroke={color} strokeWidth="2.2" strokeLinecap="round" /></>,
    bag: <><path d="M6 9h12l-1 11H7L6 9z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" fill="none" /><path d="M9 9V6a3 3 0 0 1 6 0v3" stroke={color} strokeWidth="2.2" fill="none" /></>,
    money: <><rect x="3" y="6" width="18" height="13" rx="1" stroke={color} strokeWidth="2.2" /><circle cx="12" cy="12.5" r="2.5" stroke={color} strokeWidth="2.2" /></>,
    advance: <><circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="2.2" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" /></>,
    reports: <><path d="M5 21V9l7-5 7 5v12" stroke={color} strokeWidth="2.2" strokeLinejoin="round" /><path d="M9 21v-7h6v7" stroke={color} strokeWidth="2.2" /></>,
    settings: <><circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" /></>
  }
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none">{svgs[kind] || null}</svg>
}

function roleLabel(role) {
  switch (String(role || '').toLowerCase()) {
    case 'cashier': return 'Кассир'
    case 'admin': return 'Админ'
    case 'owner': return 'Владелец'
    default: return role || '—'
  }
}

function HeaderStat({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span
        style={{
          fontSize: 12,
          color: T.textMuted,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: strong ? 20 : 17,
          fontWeight: strong ? 900 : 800,
          color: T.text,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          lineHeight: 1
        }}
      >
        {value}
      </span>
    </div>
  )
}
