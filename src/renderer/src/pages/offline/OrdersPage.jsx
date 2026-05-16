import { useEffect, useState, useMemo, useCallback } from 'react'
import { T, STATUS, fmt, fmtN } from '../../lib/theme'
import NewOrderPage from './NewOrderPage'

export default function OrdersPage({ auth }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active') // active | paid | cancelled | all
  const [view, setView] = useState({ name: 'list' }) // list | new | detail | add | pay

  const load = useCallback(async () => {
    const res = await window.pos.hub.request('GET', '/api/orders')
    setOrders(res.success ? res.data?.data || [] : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const res = await window.pos.hub.request('GET', '/api/orders')
      if (cancelled) return
      setOrders(res.success ? res.data?.data || [] : [])
      setLoading(false)
    }
    tick()
    const t = setInterval(tick, 4000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // Keep the open order fresh after reload
  const currentOrder = useMemo(
    () => (view.orderId ? orders.find((o) => o._id === view.orderId) || view.order : null),
    [orders, view],
  )

  if (view.name === 'new') {
    return (
      <NewOrderPage
        auth={auth}
        onCancel={() => setView({ name: 'list' })}
        onCreated={() => {
          setView({ name: 'list' })
          load()
        }}
      />
    )
  }
  if (view.name === 'detail' && currentOrder) {
    return (
      <OrderDetail
        order={currentOrder}
        onBack={() => setView({ name: 'list' })}
        onAdd={() => setView({ name: 'add', orderId: currentOrder._id, order: currentOrder })}
        onPay={() => setView({ name: 'pay', orderId: currentOrder._id, order: currentOrder })}
        onCancelled={() => {
          setView({ name: 'list' })
          load()
        }}
      />
    )
  }
  if (view.name === 'add' && currentOrder) {
    return (
      <AddItems
        order={currentOrder}
        onBack={() => setView({ name: 'detail', orderId: currentOrder._id, order: currentOrder })}
        onDone={() => {
          setView({ name: 'list' })
          load()
        }}
      />
    )
  }
  if (view.name === 'pay' && currentOrder) {
    return (
      <PayScreen
        order={currentOrder}
        onBack={() => setView({ name: 'detail', orderId: currentOrder._id, order: currentOrder })}
        onDone={() => {
          setView({ name: 'list' })
          load()
        }}
      />
    )
  }

  const isPaid = (o) => o.isPaid || o.status === 'paid'
  const filtered = orders.filter((o) => {
    if (tab === 'active') return !['paid', 'cancelled'].includes(o.status) && !o.isPaid
    if (tab === 'paid') return isPaid(o)
    if (tab === 'cancelled') return o.status === 'cancelled'
    return true
  })
  const counts = {
    active: orders.filter((o) => !['paid', 'cancelled'].includes(o.status) && !o.isPaid).length,
    paid: orders.filter(isPaid).length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    all: orders.length,
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <button onClick={() => setView({ name: 'new' })} style={ctaBtn}>
          + НОВЫЙ ЗАКАЗ
        </button>
        <div style={{ width: 1, height: 36, background: T.border, margin: '0 8px' }} />
        {[
          { id: 'active', label: 'Готовится' },
          { id: 'paid', label: 'Оплачено' },
          { id: 'cancelled', label: 'Отменено' },
          { id: 'all', label: 'Все' },
        ].map((t2) => {
          const a = tab === t2.id
          return (
            <button
              key={t2.id}
              onClick={() => setTab(t2.id)}
              style={{
                padding: '14px 22px',
                background: a ? T.text : T.surface,
                color: a ? '#fff' : T.text,
                border: `2px solid ${a ? T.borderStrong : T.border}`,
                fontFamily: T.font,
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {t2.label}
              <span
                style={{
                  background: a ? 'rgba(255,255,255,0.2)' : T.panelStrong,
                  color: a ? '#fff' : T.textMuted,
                  padding: '2px 10px',
                  fontSize: 14,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {counts[t2.id]}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ color: T.textMuted, padding: 40, textAlign: 'center' }}>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filtered.map((o) => (
            <OrderCard
              key={o._id}
              order={o}
              onOpen={() => setView({ name: 'detail', orderId: o._id, order: o })}
              onAdd={() => setView({ name: 'add', orderId: o._id, order: o })}
              onPay={() => setView({ name: 'pay', orderId: o._id, order: o })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function activeItems(order) {
  return (order.items || []).filter((i) => i.status !== 'cancelled' && !i.isCancelled)
}
function orderTotal(order) {
  return activeItems(order).reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0)
}

function OrderCard({ order, onOpen, onAdd, onPay }) {
  const s = STATUS[order.status] || STATUS.pending
  const items = activeItems(order)
  const total = orderTotal(order)
  const paid = order.isPaid || order.status === 'paid'

  return (
    <div
      onClick={onOpen}
      style={{
        background: T.surface,
        border: `2px solid ${T.border}`,
        borderLeft: `6px solid ${s.color}`,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
    >
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {order.orderType === 'saboy' ? 'Сабой' : order.tableName || `Заказ #${order.orderNumber || ''}`}
          </div>
          <span style={{ background: s.bg, color: s.color, padding: '6px 12px', fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>
            {paid ? STATUS.paid.label : s.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
          №{order.orderNumber || '—'} · {order.waiterName || '—'}
        </div>
      </div>

      <div style={{ padding: '14px 18px', flex: 1 }}>
        {items.slice(0, 4).map((it) => (
          <div key={it._id || it.foodId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <div style={{ fontSize: 15 }}>
              <span style={{ color: T.textMuted, marginRight: 8, fontWeight: 700 }}>{it.quantity}×</span>
              {it.foodName}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmt((it.price || 0) * (it.quantity || 1))}
            </div>
          </div>
        ))}
        {items.length > 4 && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>+ ещё {items.length - 4}</div>}
        {items.length === 0 && <div style={{ fontSize: 14, color: T.textMuted }}>Нет блюд</div>}
      </div>

      <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 700 }}>{paid ? 'ОПЛАЧЕНО' : 'К ОПЛАТЕ'}</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: paid ? T.paid : T.text }}>
          {fmt(total)}
        </span>
      </div>

      {!paid && order.status !== 'cancelled' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
            style={secBtn}
          >
            + Блюдо
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPay()
            }}
            style={payBtn}
          >
            ОПЛАТА
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────────── Order detail ─────────────────
function OrderDetail({ order, onBack, onAdd, onPay, onCancelled }) {
  const items = order.items || []
  const total = orderTotal(order)
  const paid = order.isPaid || order.status === 'paid'

  // Electron renderer'da window.prompt YO'Q — shuning uchun ichki modal.
  const [modal, setModal] = useState(null) // {kind:'qty'|'cancelItem'|'cancelOrder', it?, value?}
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const askQty = (it) => {
    setErr('')
    setModal({ kind: 'qty', it, value: it.quantity })
  }

  const runModal = async () => {
    if (!modal || busy) return
    setBusy(true)
    setErr('')
    try {
      const q = Math.max(1, Math.floor(modal.value || 1))
      if (q === modal.it.quantity) {
        setModal(null)
        return
      }
      const r = await window.pos.hub.request('PATCH', `/api/orders/${order._id}/items/${modal.it._id}/quantity`, { quantity: q })
      if (r && r.success === false) {
        setErr(r.error || 'Ошибка')
        return
      }
      setModal(null)
      onCancelled && onCancelled()
    } catch (e) {
      setErr((e && e.message) || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        title={`${order.orderType === 'saboy' ? 'Сабой' : order.tableName || 'Заказ'} · №${order.orderNumber || '—'}`}
        onBack={onBack}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, maxWidth: 760 }}>
          {items.map((it) => {
            const cancelled = it.status === 'cancelled' || it.isCancelled
            return (
              <div
                key={it._id || it.foodId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderBottom: `1px solid ${T.borderSoft}`,
                  opacity: cancelled ? 0.5 : 1,
                  textDecoration: cancelled ? 'line-through' : 'none',
                }}
              >
                {!paid && !cancelled ? (
                  <button
                    onClick={() => askQty(it)}
                    title="Изменить количество"
                    style={{
                      background: T.panel,
                      border: `2px solid ${T.borderStrong}`,
                      padding: '4px 10px',
                      fontWeight: 800,
                      minWidth: 56,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                      fontFamily: T.font,
                    }}
                  >
                    {it.quantity}× ✎
                  </button>
                ) : (
                  <span style={{ background: T.panel, padding: '4px 10px', fontWeight: 800, minWidth: 44, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {it.quantity}×
                  </span>
                )}
                <span style={{ flex: 1, fontSize: 16 }}>{it.foodName}</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt((it.price || 0) * (it.quantity || 1))}
                </span>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: T.panel }}>
            <span style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>{paid ? 'Оплачено' : 'К оплате'}</span>
            <span style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: paid ? T.paid : T.cta }}>
              {fmt(total)}
            </span>
          </div>
        </div>
      </div>
      {!paid && order.status !== 'cancelled' && (
        <div style={{ display: 'flex', gap: 12, padding: 18, borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <button onClick={onAdd} style={{ ...secBtn, flex: 1, height: 64, border: `2px solid ${T.borderStrong}` }}>
            + Блюдо
          </button>
          <button onClick={onPay} style={{ ...payBtn, flex: 2, height: 64 }}>
            ОПЛАТА · {fmt(total)}
          </button>
        </div>
      )}

      {modal && (
        <div
          onClick={() => !busy && setModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: T.surface, width: 520, maxWidth: '90%', border: `1px solid ${T.border}`, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {(
              <>
                <div style={{ fontSize: 22, fontWeight: 900 }}>Количество</div>
                <div style={{ fontSize: 16, color: T.textMuted }}>{modal.it.foodName}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                  <button onClick={() => setModal({ ...modal, value: Math.max(1, modal.value - 1) })} style={stepBtn}>
                    −
                  </button>
                  <div style={{ minWidth: 110, textAlign: 'center', fontSize: 44, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                    {modal.value}
                  </div>
                  <button onClick={() => setModal({ ...modal, value: modal.value + 1 })} style={stepBtn}>
                    +
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <button key={n} onClick={() => setModal({ ...modal, value: n })} style={quickBtn}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center' }}>
                  Было {modal.it.quantity} → станет {modal.value}.
                </div>
              </>
            )}

            {err && (
              <div style={{ background: T.cancelledBg, color: T.cancelled, padding: '10px 14px', fontWeight: 700, fontSize: 14 }}>
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => !busy && setModal(null)}
                style={{ flex: 1, height: 60, fontSize: 16, fontWeight: 800, background: T.surface, color: T.text, border: `2px solid ${T.borderStrong}`, cursor: 'pointer', fontFamily: T.font }}
              >
                Закрыть
              </button>
              <button
                onClick={runModal}
                disabled={busy}
                style={{ flex: 2, height: 60, fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: T.font, background: T.cta, color: '#fff', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? '…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────── Add items ─────────────────
function AddItems({ order, onBack, onDone }) {
  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      window.pos.hub.request('GET', '/api/foods'),
      window.pos.hub.request('GET', '/api/categories'),
    ]).then(([f, c]) => {
      setFoods(f.success ? f.data?.data || [] : [])
      setCategories(c.success ? c.data?.data || [] : [])
    })
  }, [])

  const filtered = useMemo(() => {
    let list = foods.filter((f) => f.isAvailable !== false)
    if (activeCat !== 'all')
      list = list.filter((f) => {
        const cid = typeof f.categoryId === 'object' ? f.categoryId?._id : f.categoryId
        return String(cid) === String(activeCat)
      })
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((f) => (f.foodName || '').toLowerCase().includes(q))
    return list
  }, [foods, activeCat, search])

  const add = (f) =>
    setCart((p) => {
      const i = p.findIndex((c) => c._id === f._id)
      if (i >= 0) {
        const cp = [...p]
        cp[i] = { ...cp[i], quantity: cp[i].quantity + 1 }
        return cp
      }
      return [...p, { _id: f._id, foodName: f.foodName, price: f.price || 0, quantity: 1 }]
    })
  const qty = (id, d) =>
    setCart((p) => p.map((c) => (c._id === id ? { ...c, quantity: Math.max(0, c.quantity + d) } : c)).filter((c) => c.quantity > 0))
  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0)

  const submit = async () => {
    if (cart.length === 0 || busy) return
    setBusy(true)
    try {
      const res = await window.pos.hub.request('POST', `/api/orders/${order._id}/items`, {
        items: cart.map((c) => ({ foodId: c._id, foodName: c.foodName, price: c.price, quantity: c.quantity })),
      })
      if (res.success) onDone()
      else alert('Ошибка: ' + (res.error || 'не удалось'))
    } finally {
      setBusy(false)
    }
  }

  // #13: tanlangan taomlar bilan orqaga bosilsa — yo'qotmay qo'shamiz
  const handleBack = () => {
    if (busy) return
    if (cart.length > 0) submit()
    else onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar title={`+ Блюдо · ${order.tableName || 'Заказ'}`} onBack={handleBack} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск блюда…"
              style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 15, fontFamily: T.font, background: T.panel, border: `2px solid ${T.border}`, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
                Все
              </Chip>
              {categories.map((c) => (
                <Chip key={c._id} active={activeCat === c._id} onClick={() => setActiveCat(c._id)}>
                  {c.title}
                </Chip>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gridAutoRows: 'min-content', gap: 10 }}>
            {filtered.map((f) => (
              <button key={f._id} onClick={() => add(f)} style={{ background: T.surface, border: `2px solid ${T.border}`, padding: '14px 12px', cursor: 'pointer', fontFamily: T.font, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, minHeight: 38, marginBottom: 6 }}>{f.foodName}</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.price || 0)}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: 380, borderLeft: `1px solid ${T.border}`, background: T.surface, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.borderSoft}`, fontSize: 16, fontWeight: 800 }}>
            Добавить ({cart.reduce((s, c) => s + c.quantity, 0)})
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 14 }}>Выберите блюда</div>
            ) : (
              cart.map((c) => (
                <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: `1px solid ${T.borderSoft}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.foodName}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{fmt(c.price)} × {c.quantity}</div>
                  </div>
                  <QBtn onClick={() => qty(c._id, -1)}>−</QBtn>
                  <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 800 }}>{c.quantity}</span>
                  <QBtn onClick={() => qty(c._id, +1)}>+</QBtn>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: 18, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 700 }}>ИТОГО</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
            </div>
            <button
              onClick={submit}
              disabled={cart.length === 0 || busy}
              style={{ width: '100%', height: 60, background: cart.length === 0 || busy ? T.panelStrong : T.cta, color: '#fff', border: 'none', fontFamily: T.font, fontSize: 18, fontWeight: 900, cursor: cart.length === 0 || busy ? 'not-allowed' : 'pointer' }}
            >
              {busy ? 'Добавление…' : 'ДОБАВИТЬ В ЗАКАЗ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────── Payment (полная / частичная / смешанная) ─────────────────
function PayScreen({ order, onBack, onDone }) {
  const allItems = useMemo(
    () => (order.items || []).filter((i) => i.status !== 'cancelled' && !i.isCancelled),
    [order],
  )
  const unpaid = useMemo(() => allItems.filter((i) => !i.isPaid), [allItems])
  const paidItems = useMemo(() => allItems.filter((i) => i.isPaid), [allItems])

  const [mode, setMode] = useState('full') // full | partial
  const [selected, setSelected] = useState(() => new Set(unpaid.map((i) => i._id)))
  const [payType, setPayType] = useState('cash')
  const [split, setSplit] = useState({ cash: 0, card: 0, click: 0 })
  const [busy, setBusy] = useState(false)
  // #15: наличные — «Получено» + numpad + «Сдача»
  const [received, setReceived] = useState(null)
  const [padBuf, setPadBuf] = useState(null)

  const allPaid = unpaid.length === 0
  const itemAmt = (i) => (i.price || 0) * (i.quantity || 1)
  const selectedItems = unpaid.filter((i) => selected.has(i._id))
  const itemsToPay = mode === 'full' ? unpaid : selectedItems
  const grandTotal = itemsToPay.reduce((s, i) => s + itemAmt(i), 0)
  const paidTotal = paidItems.reduce((s, i) => s + itemAmt(i), 0)

  const splitSum = split.cash + split.card + split.click
  const splitRemaining = grandTotal - splitSum

  const methods = [
    ['cash', 'НАЛИЧНЫЕ', 'Сом / тенге', T.ready, T.readyBg],
    ['card', 'КАРТА', 'Банковская карта', T.served, T.servedBg],
    ['click', 'ПЕРЕВОД', 'На счёт', T.cta, '#f8d9c0'],
    ['mixed', 'СМЕШАННАЯ', 'Несколько', T.preparing, T.preparingBg],
  ]

  const toggle = (id) => {
    if (mode !== 'partial') return
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const valid =
    (mode === 'full' || selectedItems.length > 0) &&
    (payType !== 'mixed' || Math.abs(splitRemaining) < 100)

  const confirm = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      const body = {
        paymentType: payType === 'mixed' ? 'mixed' : payType,
        paymentSplit: payType === 'mixed' ? split : undefined,
        itemIds: mode === 'partial' ? Array.from(selected) : undefined,
      }
      const res = await window.pos.hub.request('POST', `/api/orders/${order._id}/pay`, body)
      if (res.success) onDone()
      else alert('Ошибка: ' + (res.error || 'не удалось оплатить'))
    } finally {
      setBusy(false)
    }
  }

  if (allPaid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Toolbar title={`Оплата · ${order.tableName || 'Заказ'}`} onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: T.paid }}>Заказ полностью оплачен</div>
          <button onClick={onBack} style={{ ...ctaBtn, height: 60 }}>К заказам</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: T.cta, color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>ПРИЁМ ОПЛАТЫ</span>
          <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', fontSize: 16, fontWeight: 800 }}>
            {order.orderType === 'saboy' ? 'Сабой' : order.tableName || 'Заказ'}
          </span>
          <span style={{ fontSize: 15, opacity: 0.9 }}>№{order.orderNumber || '—'} · {order.waiterName || '—'}</span>
        </div>
        <button onClick={onBack} style={{ padding: '10px 22px', background: 'rgba(255,255,255,0.18)', color: '#fff', border: '2px solid rgba(255,255,255,0.5)', fontFamily: T.font, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          ‹ К заказам
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 460px', minHeight: 0 }}>
        {/* LEFT — items */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Что оплачиваем · {itemsToPay.length} из {unpaid.length} блюд
            </div>
            <div style={{ display: 'flex', border: `2px solid ${T.borderStrong}` }}>
              {['full', 'partial'].map((m, i) => {
                const a = mode === m
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m)
                      if (m === 'full') setSelected(new Set(unpaid.map((x) => x._id)))
                    }}
                    style={{ height: 48, padding: '0 20px', background: a ? T.borderStrong : T.surface, color: a ? '#fff' : T.text, border: 'none', borderRight: i === 0 ? `2px solid ${T.borderStrong}` : 'none', fontFamily: T.font, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {m === 'full' ? 'Полная оплата' : 'Выбрать блюда'}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allItems.map((it) => {
              const isP = it.isPaid
              const sel = selected.has(it._id)
              const canSel = !isP && mode === 'partial'
              return (
                <div
                  key={it._id}
                  onClick={() => canSel && toggle(it._id)}
                  style={{
                    background: isP ? T.paidBg : mode === 'partial' && sel ? '#fff5ed' : T.surface,
                    border: isP ? `2px solid ${T.paid}` : mode === 'partial' && sel ? `3px solid ${T.cta}` : `2px solid ${T.border}`,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: canSel ? 'pointer' : 'default',
                    opacity: isP ? 0.7 : 1,
                    textDecoration: isP ? 'line-through' : 'none',
                  }}
                >
                  {mode === 'partial' && !isP && (
                    <div style={{ width: 34, height: 34, border: `2px solid ${sel ? T.cta : T.borderStrong}`, background: sel ? T.cta : T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 900 }}>
                      {sel ? '✓' : ''}
                    </div>
                  )}
                  {isP && (
                    <div style={{ width: 34, height: 34, background: T.paid, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900 }}>✓</div>
                  )}
                  <div style={{ background: T.panel, padding: '6px 12px', fontSize: 16, fontWeight: 800, minWidth: 52, textAlign: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {it.quantity}×
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{it.foodName}</div>
                    <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                      {fmt(it.price || 0)} × {it.quantity}
                      {isP ? <span style={{ color: T.paid, fontWeight: 800 }}> · ОПЛАЧЕНО</span> : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {fmt(itemAmt(it))}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: T.surface, borderTop: `2px solid ${T.borderStrong}`, padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {paidItems.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: T.paid, fontWeight: 700 }}>
                <span>Уже оплачено ({paidItems.length})</span>
                <span style={{ textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{fmt(paidTotal)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: T.textMuted }}>
              <span>Подытог · {itemsToPay.length} блюд</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `2px solid ${T.borderStrong}`, marginTop: 6, paddingTop: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase' }}>К оплате</span>
              <span style={{ fontSize: 36, fontWeight: 900, color: T.cta, fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* RIGHT — methods */}
        <div style={{ background: T.panel, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: 14, gap: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Способ оплаты
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {methods.map(([id, label, sub, color, bg]) => {
              const a = id === payType
              return (
                <button key={id} onClick={() => setPayType(id)} style={{ padding: '14px 16px', background: a ? color : bg, color: a ? '#fff' : color, border: `2px solid ${a ? color : 'transparent'}`, fontFamily: T.font, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontSize: 17, fontWeight: 900 }}>{label}</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3, fontWeight: 700 }}>{sub}</div>
                </button>
              )
            })}
          </div>

          {payType === 'cash' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: T.readyBg, overflow: 'auto' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.ready, textAlign: 'center' }}>Оплата наличными</div>
              <div style={{ background: T.surface, border: `2px solid ${T.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.textMuted }}>К ОПЛАТЕ</span>
                <span style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
              </div>
              <div style={{ background: T.surface, border: `2px solid ${T.ready}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.ready }}>ПОЛУЧЕНО</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: T.ready, fontVariantNumeric: 'tabular-nums' }}>{fmt(received ?? grandTotal)}</span>
              </div>
              {received != null && received >= grandTotal && (
                <div style={{ background: T.cta, color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>СДАЧА</span>
                  <span style={{ fontSize: 28, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{fmt(received - grandTotal)}</span>
                </div>
              )}
              {received != null && received < grandTotal && (
                <div style={{ color: T.cancelled, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>Получено меньше суммы заказа</div>
              )}
              {padBuf === null ? (
                <button onClick={() => setPadBuf(received != null ? String(received) : '')} style={{ height: 50, background: T.surface, border: `2px solid ${T.borderStrong}`, fontFamily: T.font, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                  + Другая сумма
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: T.surface, border: `2px solid ${T.borderStrong}`, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px', fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                    {padBuf === '' ? '0' : Number(padBuf).toLocaleString('ru-RU')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '00'].map((k) => (
                      <button
                        key={k}
                        onClick={() =>
                          setPadBuf((b) => {
                            const cur = b ?? ''
                            if (k === '⌫') return cur.slice(0, -1)
                            const next = (cur + k).replace(/^0+(?=\d)/, '')
                            return next.length > 9 ? cur : next
                          })
                        }
                        style={{ height: 52, background: k === '⌫' ? T.panelStrong : T.surface, border: `2px solid ${T.border}`, fontFamily: T.font, fontSize: 20, fontWeight: 800, cursor: 'pointer' }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setReceived(null); setPadBuf(null) }} style={{ flex: 1, height: 48, background: T.surface, border: `2px solid ${T.borderStrong}`, fontFamily: T.font, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                      Сброс
                    </button>
                    <button onClick={() => { const v = Number(padBuf); setReceived(Number.isFinite(v) && v > 0 ? v : null); setPadBuf(null) }} style={{ flex: 2, height: 48, background: T.cta, color: '#fff', border: 'none', fontFamily: T.font, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                      Готово
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {(payType === 'card' || payType === 'click') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24, background: payType === 'card' ? T.servedBg : '#f8d9c0' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: payType === 'card' ? T.served : T.cta, textAlign: 'center' }}>
                {payType === 'card' ? 'Оплата по карте через терминал' : 'Перевод на счёт ресторана'}
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: payType === 'card' ? T.served : T.cta, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(grandTotal)}
              </div>
            </div>
          )}
          {payType === 'mixed' && (
            <>
              <div style={{ background: T.preparingBg, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['cash', 'card', 'click'].map((k) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 90, fontSize: 15, fontWeight: 800 }}>
                      {k === 'cash' ? 'Наличные' : k === 'card' ? 'Карта' : 'Перевод'}
                    </div>
                    <input
                      inputMode="numeric"
                      value={split[k] > 0 ? fmtN(split[k]) : ''}
                      onChange={(e) => setSplit((s) => ({ ...s, [k]: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))}
                      placeholder="0"
                      style={{ flex: 1, height: 44, padding: '0 12px', background: T.surface, border: `2px solid ${T.borderStrong}`, fontSize: 18, fontFamily: T.font, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ background: Math.abs(splitRemaining) < 100 ? T.readyBg : T.cancelledBg, color: Math.abs(splitRemaining) < 100 ? T.ready : T.cancelled, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 18, fontWeight: 800 }}>
                <span>Остаток</span>
                <span style={{ fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>{fmt(splitRemaining)}</span>
              </div>
            </>
          )}

          <div style={{ flex: 1 }} />
          <button
            onClick={confirm}
            disabled={!valid || busy}
            style={{ height: 72, background: !valid || busy ? T.textDim : T.cta, color: '#fff', border: 'none', fontFamily: T.font, fontSize: 20, fontWeight: 900, letterSpacing: 0.5, cursor: !valid || busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'ОБРАБОТКА…' : '✓ ПОДТВЕРДИТЬ ОПЛАТУ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────── shared ─────────────────
function Toolbar({ title, onBack }) {
  return (
    <div style={{ padding: '16px 24px', background: T.surface, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
      <button onClick={onBack} style={{ padding: '10px 18px', background: T.surface, color: T.text, border: `2px solid ${T.borderStrong}`, fontFamily: T.font, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
        ← Назад
      </button>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{title}</h2>
    </div>
  )
}
function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 14px', background: active ? T.text : T.surface, color: active ? '#fff' : T.text, border: `2px solid ${active ? T.borderStrong : T.border}`, fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {children}
    </button>
  )
}
function QBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 32, height: 32, background: T.surface, border: `2px solid ${T.borderStrong}`, fontFamily: T.font, fontSize: 16, fontWeight: 900, cursor: 'pointer', padding: 0 }}>
      {children}
    </button>
  )
}
function Empty() {
  return (
    <div style={{ padding: 60, textAlign: 'center', background: T.surface, border: `1px dashed ${T.border}`, color: T.textMuted }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Нет заказов</div>
      <div style={{ fontSize: 14 }}>Создайте заказ кнопкой «+ Новый заказ»</div>
    </div>
  )
}

const ctaBtn = {
  padding: '14px 26px',
  background: T.cta,
  color: '#fff',
  border: 'none',
  fontFamily: T.font,
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: 0.3,
  cursor: 'pointer',
}
const secBtn = {
  height: 56,
  background: T.surface,
  color: T.text,
  border: 'none',
  borderTop: `1px solid ${T.borderSoft}`,
  borderRight: `1px solid ${T.borderSoft}`,
  fontFamily: T.font,
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
}
const payBtn = {
  height: 56,
  background: T.cta,
  color: '#fff',
  border: 'none',
  borderTop: `1px solid ${T.borderSoft}`,
  fontFamily: T.font,
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: 0.5,
  cursor: 'pointer',
}
const stepBtn = {
  width: 72,
  height: 72,
  fontSize: 34,
  fontWeight: 900,
  background: T.panel,
  border: `2px solid ${T.borderStrong}`,
  color: T.text,
  cursor: 'pointer',
  fontFamily: T.font,
}
const quickBtn = {
  minWidth: 48,
  height: 44,
  fontSize: 16,
  fontWeight: 800,
  background: T.panel,
  border: `2px solid ${T.border}`,
  color: T.text,
  cursor: 'pointer',
  fontFamily: T.font,
}
