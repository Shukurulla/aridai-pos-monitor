import { useEffect, useState, useMemo } from 'react'
import { T, fmt } from '../../lib/theme'

export default function SaboyPage() {
  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [cart, setCart] = useState([]) // [{_id,name,price,quantity}]
  const [paymentType, setPaymentType] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [f, c] = await Promise.all([
        window.pos.hub.request('GET', '/api/foods'),
        window.pos.hub.request('GET', '/api/categories')
      ])
      if (cancelled) return
      setFoods(f.success ? f.data?.data || [] : [])
      setCategories(c.success ? c.data?.data || [] : [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (activeCat === 'all') return foods
    return foods.filter((f) => {
      const cid = typeof f.categoryId === 'object' ? f.categoryId?._id : f.categoryId
      return String(cid) === String(activeCat)
    })
  }, [foods, activeCat])

  const add = (f) =>
    setCart((c) => {
      const ex = c.find((x) => x._id === f._id)
      if (ex) return c.map((x) => (x._id === f._id ? { ...x, quantity: x.quantity + 1 } : x))
      return [...c, { _id: f._id, name: f.foodName, price: Number(f.price || 0), quantity: 1 }]
    })
  const setQty = (id, d) =>
    setCart((c) =>
      c.map((x) => (x._id === id ? { ...x, quantity: Math.max(0, x.quantity + d) } : x)).filter((x) => x.quantity > 0)
    )
  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0)

  const submit = async () => {
    if (cart.length === 0 || busy) return
    setBusy(true)
    try {
      const res = await window.pos.hub.request('POST', '/api/orders/saboy', {
        items: cart.map((c) => ({ foodId: c._id, foodName: c.name, price: c.price, quantity: c.quantity })),
        paymentType
      })
      if (res.success) {
        alert(`Сабой создан — ${fmt(total)} (офлайн, синхронизируется позже)`)
        setCart([])
      } else {
        alert('Ошибка: ' + (res.error || 'не удалось создать сабой'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: T.cta,
          color: '#fff',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>НОВЫЙ САБОЙ</span>
        <span style={{ fontSize: 15, opacity: 0.9 }}>На вынос · без стола · офлайн</span>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '190px 1fr 400px', minHeight: 0, overflow: 'hidden' }}>
        {/* Categories */}
        <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, overflowY: 'auto', minHeight: 0 }}>
          {[{ _id: 'all', title: 'Все' }, ...categories].map((c) => {
            const a = c._id === activeCat
            return (
              <button
                key={c._id}
                onClick={() => setActiveCat(c._id)}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  background: a ? T.panel : 'transparent',
                  borderLeft: a ? `5px solid ${T.cta}` : '5px solid transparent',
                  border: 'none',
                  borderBottom: `1px solid ${T.borderSoft}`,
                  fontFamily: T.font,
                  fontSize: 15,
                  fontWeight: a ? 900 : 700,
                  color: a ? T.cta : T.text,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {c.title}
              </button>
            )
          })}
        </div>

        {/* Menu grid */}
        <div style={{ background: T.panel, overflow: 'auto', padding: 16, minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: T.textMuted }}>Загрузка меню…</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gridAutoRows: '116px',
                alignContent: 'start',
                gap: 10
              }}
            >
              {filtered.map((f) => (
                <button
                  key={f._id}
                  onClick={() => add(f)}
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontFamily: T.font,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 8
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {f.foodName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {fmt(f.price)}
                    </span>
                    <span
                      style={{
                        background: T.cta,
                        color: '#fff',
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        fontWeight: 900
                      }}
                    >
                      +
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            style={{
              padding: '14px 20px',
              background: T.cta,
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              flexShrink: 0
            }}
          >
            <span>Корзина</span>
            <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 12px' }}>{cart.length}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {cart.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 15 }}>
                Нажмите на блюдо
              </div>
            ) : (
              cart.map((c) => (
                <div
                  key={c._id}
                  style={{
                    background: T.panel,
                    border: `1px solid ${T.border}`,
                    padding: '12px 14px',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                      {fmt(c.price)} × {c.quantity} = <strong>{fmt(c.price * c.quantity)}</strong>
                    </div>
                  </div>
                  <button onClick={() => setQty(c._id, -1)} style={qtyBtn(false)}>
                    −
                  </button>
                  <span style={{ minWidth: 32, textAlign: 'center', fontSize: 20, fontWeight: 900 }}>{c.quantity}</span>
                  <button onClick={() => setQty(c._id, 1)} style={qtyBtn(true)}>
                    +
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: 14, borderTop: `2px solid ${T.borderStrong}`, background: T.panel, flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
              {[
                ['cash', 'НАЛИЧНЫЕ'],
                ['card', 'КАРТА'],
                ['click', 'ПЕРЕВОД']
              ].map(([id, label]) => {
                const a = id === paymentType
                return (
                  <button
                    key={id}
                    onClick={() => setPaymentType(id)}
                    style={{
                      height: 46,
                      background: a ? T.borderStrong : T.surface,
                      color: a ? '#fff' : T.text,
                      border: `2px solid ${T.borderStrong}`,
                      fontFamily: T.font,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase' }}>Итого</span>
              <span style={{ fontSize: 28, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
            </div>
            <button
              onClick={submit}
              disabled={cart.length === 0 || busy}
              style={{
                width: '100%',
                height: 64,
                background: cart.length === 0 || busy ? T.textDim : T.cta,
                color: '#fff',
                border: 'none',
                fontFamily: T.font,
                fontSize: 19,
                fontWeight: 900,
                letterSpacing: 0.5,
                cursor: cart.length === 0 || busy ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? 'СОХРАНЕНИЕ…' : 'СОЗДАТЬ САБОЙ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function qtyBtn(primary) {
  return {
    width: 42,
    height: 42,
    background: primary ? T.cta : T.surface,
    color: primary ? '#fff' : T.text,
    border: primary ? 'none' : `2px solid ${T.borderStrong}`,
    fontFamily: T.font,
    fontSize: 22,
    fontWeight: 900,
    cursor: 'pointer'
  }
}
