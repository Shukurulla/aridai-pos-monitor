import { useEffect, useState, useMemo } from 'react'
import { T, fmt } from '../../lib/theme'

export default function ReportsPage({ auth }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('revenue')
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await window.pos.hub.request('GET', '/api/orders')
      if (cancelled) return
      setOrders(res.success ? res.data?.data || [] : [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const r = useMemo(() => {
    const paid = orders.filter((o) => o.isPaid === true || o.status === 'paid')
    const sumOrder = (o) => {
      if (typeof o.grandTotal === 'number' && o.grandTotal > 0) return o.grandTotal
      return (o.items || [])
        .filter((i) => i.status !== 'cancelled' && !i.isCancelled)
        .reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0)
    }
    const totalRevenue = paid.reduce((s, o) => s + sumOrder(o), 0)
    const byType = { cash: 0, card: 0, click: 0 }
    paid.forEach((o) => {
      const t = o.paymentType === 'card' ? 'card' : o.paymentType === 'click' ? 'click' : 'cash'
      byType[t] += sumOrder(o)
    })
    const checks = paid.length
    const avg = checks ? Math.round(totalRevenue / checks) : 0

    const waiterMap = {}
    paid.forEach((o) => {
      const n = o.waiterName || 'Касса'
      if (!waiterMap[n]) waiterMap[n] = { name: n, orders: 0, revenue: 0 }
      waiterMap[n].orders += 1
      waiterMap[n].revenue += sumOrder(o)
    })
    const waiters = Object.values(waiterMap).sort((a, b) => b.revenue - a.revenue)

    const foodMap = {}
    paid.forEach((o) =>
      (o.items || [])
        .filter((i) => i.status !== 'cancelled' && !i.isCancelled)
        .forEach((i) => {
          const n = i.foodName || 'Блюдо'
          if (!foodMap[n]) foodMap[n] = { name: n, qty: 0, revenue: 0 }
          foodMap[n].qty += i.quantity || 1
          foodMap[n].revenue += (i.price || 0) * (i.quantity || 1)
        })
    )
    const foods = Object.values(foodMap).sort((a, b) => b.revenue - a.revenue)

    const cancelled = []
    orders.forEach((o) => {
      if (o.status === 'cancelled') {
        cancelled.push({ orderNumber: o.orderNumber, name: o.tableName || 'Заказ', qty: 1, total: sumOrder(o) })
      } else {
        ;(o.items || [])
          .filter((i) => i.status === 'cancelled' || i.isCancelled)
          .forEach((i) =>
            cancelled.push({
              orderNumber: o.orderNumber,
              name: i.foodName,
              qty: i.quantity || 1,
              total: (i.price || 0) * (i.quantity || 1)
            })
          )
      }
    })
    const cancelledTotal = cancelled.reduce((s, c) => s + c.total, 0)

    return { totalRevenue, byType, checks, avg, waiters, foods, cancelled, cancelledTotal }
  }, [orders])

  const tabs = [
    { id: 'revenue', label: 'Выручка' },
    { id: 'waiters', label: 'Официанты' },
    { id: 'foods', label: 'Блюда' },
    { id: 'cancelled', label: 'Отменённые' }
  ]

  const doPrint = async () => {
    if (printing) return
    setPrinting(true)
    const header = {
      restaurantName: auth?.restaurantName || auth?.restaurant?.name || '',
      date: new Date().toLocaleDateString('ru-RU'),
      title:
        tab === 'revenue'
          ? 'ОБЩАЯ ВЫРУЧКА'
          : tab === 'waiters'
            ? 'ПО ОФИЦИАНТАМ'
            : tab === 'foods'
              ? 'ПРОДАННЫЕ БЛЮДА'
              : 'ОТМЕНЁННЫЕ'
    }
    const payload = { printerName: '', currency: '₸', header }
    let path = ''
    if (tab === 'revenue') {
      path = '/print/revenue'
      payload.sections = [
        {
          title: 'СПОСОБЫ ОПЛАТЫ',
          rows: [
            { label: 'Наличные', amount: r.byType.cash },
            { label: 'Карта', amount: r.byType.card },
            { label: 'Перевод', amount: r.byType.click }
          ]
        },
        {
          title: 'ИТОГИ',
          rows: [
            { label: 'Кол-во чеков', value: String(r.checks) },
            { label: 'Средний чек', amount: r.avg }
          ]
        }
      ]
      payload.grandTotal = r.totalRevenue
    } else if (tab === 'waiters') {
      path = '/print/waiters'
      payload.waiters = r.waiters.map((w) => ({
        name: w.name,
        ordersCount: w.orders,
        totalRevenue: w.revenue
      }))
      payload.grandTotal = r.totalRevenue
    } else if (tab === 'foods') {
      path = '/print/sold-foods'
      const subtotal = r.foods.reduce((s, f) => s + f.revenue, 0)
      payload.categories = [
        {
          name: '',
          items: r.foods.map((f) => ({ name: f.name, qty: f.qty, price: 0, total: f.revenue })),
          subtotal
        }
      ]
      payload.grandTotal = subtotal
    } else {
      path = '/print/cancelled'
      payload.items = r.cancelled.map((c) => ({
        time: '',
        tableName: `#${c.orderNumber || ''}`,
        foodName: c.name,
        qty: c.qty,
        total: c.total,
        reason: ''
      }))
      payload.totalCount = r.cancelled.length
      payload.grandTotal = r.cancelledTotal
    }
    try {
      const res = await window.pos.hub.request('POST', path, payload)
      const ok = !!(res && res.success && (!res.data || res.data.success !== false))
      if (!ok) alert('Ошибка печати: ' + ((res && (res.error || res.data?.error)) || 'нет связи с сервером'))
    } catch (e) {
      alert('Ошибка печати: ' + (e?.message || e))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 900 }}>Отчёты смены</span>
        <span style={{ fontSize: 14, color: T.textMuted }}>Локальный расчёт (офлайн)</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={doPrint}
          disabled={printing || loading}
          style={{
            height: 48,
            padding: '0 24px',
            background: printing ? T.panelStrong : T.cta,
            color: '#fff',
            border: 'none',
            fontFamily: T.font,
            fontSize: 16,
            fontWeight: 800,
            cursor: printing ? 'not-allowed' : 'pointer'
          }}
        >
          {printing ? 'Печать…' : '🖨 Распечатать'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 0 }}>
        <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
          {tabs.map((t) => {
            const a = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '20px 18px',
                  background: a ? T.cta : 'transparent',
                  color: a ? '#fff' : T.text,
                  border: 'none',
                  borderBottom: `1px solid ${T.borderSoft}`,
                  fontFamily: T.font,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ overflow: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: T.textMuted }}>Загрузка…</div>
          ) : tab === 'revenue' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Stat label="Наличные" value={fmt(r.byType.cash)} color={T.ready} />
                <Stat label="Карта" value={fmt(r.byType.card)} color={T.served} />
                <Stat label="Перевод" value={fmt(r.byType.click)} color={T.cta} />
              </div>
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  padding: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline'
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase' }}>Итого выручка</span>
                <span style={{ fontSize: 32, fontWeight: 900, color: T.cta, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r.totalRevenue)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <Stat label="Кол-во чеков" value={r.checks} color={T.text} />
                <Stat label="Средний чек" value={fmt(r.avg)} color={T.text} />
              </div>
            </div>
          ) : tab === 'waiters' ? (
            <List
              rows={r.waiters}
              empty="Нет данных"
              render={(w) => (
                <Row
                  key={w.name}
                  left={w.name}
                  mid={`${w.orders} зак.`}
                  right={fmt(w.revenue)}
                />
              )}
            />
          ) : tab === 'foods' ? (
            <List
              rows={r.foods}
              empty="Нет данных"
              render={(f) => (
                <Row key={f.name} left={f.name} mid={`${f.qty} шт`} right={fmt(f.revenue)} />
              )}
            />
          ) : (
            <>
              <List
                rows={r.cancelled}
                empty="Отменённых нет"
                render={(c, i) => (
                  <Row
                    key={i}
                    left={`#${c.orderNumber || '—'} · ${c.name}`}
                    mid={`${c.qty} шт`}
                    right={fmt(c.total)}
                    danger
                  />
                )}
              />
              {r.cancelled.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    background: T.cancelledBg,
                    color: T.cancelled,
                    padding: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900
                  }}
                >
                  <span>ИТОГО: {r.cancelled.length} шт</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.cancelledTotal)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: T.panel, padding: '16px 18px', borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function List({ rows, render, empty }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>{empty}</div>
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rows.map(render)}</div>
}

function Row({ left, mid, right, danger }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 16,
        alignItems: 'center',
        padding: '14px 16px',
        background: T.surface,
        border: `1px solid ${T.border}`
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 700 }}>{left}</span>
      <span style={{ fontSize: 14, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>{mid}</span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: danger ? T.cancelled : T.text,
          minWidth: 130,
          textAlign: 'right'
        }}
      >
        {right}
      </span>
    </div>
  )
}
