import { useEffect, useMemo, useState } from 'react'
import { T, fmt } from '../../lib/theme'

export default function NewOrderPage({ auth, onCancel, onCreated }) {
  const [step, setStep] = useState('category') // 'category' | 'table' | 'menu'
  const [tableCategories, setTableCategories] = useState([])
  const [tables, setTables] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [waiters, setWaiters] = useState([])
  const [selectedWaiter, setSelectedWaiter] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [menuCart, setMenuCart] = useState([]) // #13: tanlangan taomlar (orqaga → create)

  useEffect(() => {
    window.pos.hub.request('GET', '/api/table-categories').then((res) => {
      setTableCategories(res.success ? (res.data?.data || []) : [])
    })
    // #4: filial ofitsiantlari (online → VPS proxy, offline → local mirror).
    window.pos.hub.request('GET', '/api/staff').then((res) => {
      const all = res.success ? (res.data?.data || res.data || []) : []
      setWaiters(all.filter((s) => String(s.role || '').toLowerCase() === 'waiter'))
    })
  }, [])

  const openCategory = async (cat) => {
    setSelectedCategory(cat)
    const res = await window.pos.hub.request('GET', `/api/tables?categoryId=${cat._id}`)
    setTables(res.success ? (res.data?.data || []) : [])
    setStep('table')
  }

  const handleSubmit = async (cartItems) => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const items = cartItems.map((c) => ({
        foodId: c._id,
        foodName: c.foodName,
        quantity: c.quantity,
        price: c.price
      }))
      const res = await window.pos.hub.request('POST', '/api/orders', {
        tableId: selectedTable._id,
        waiterId: selectedWaiter?._id,
        waiterName: selectedWaiter
          ? `${selectedWaiter.firstName || ''} ${selectedWaiter.lastName || ''}`.trim()
          : undefined,
        items
      })
      if (res.success) {
        onCreated()
      } else {
        setError(res.error || 'Не удалось создать заказ')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        padding: '16px 24px',
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <button
          onClick={() => {
            // #13: menu bosqichida tanlangan taomlar bo'lsa — orqaga bosilsa
            // ham yo'qotmaymiz, balki o'sha taomlar bilan zakaz yaratamiz.
            if (step === 'menu') {
              if (!submitting && menuCart.length > 0) handleSubmit(menuCart)
              else setStep('waiter')
            } else if (step === 'waiter') setStep('table')
            else if (step === 'table') setStep('category')
            else onCancel()
          }}
          style={{
            padding: '10px 18px',
            background: T.surface,
            color: T.text,
            border: `2px solid ${T.borderStrong}`,
            fontFamily: T.font,
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          ← Назад
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          {step === 'category' && 'Выберите зону / папку'}
          {step === 'table' && `${selectedCategory?.title || 'Стол'} — выберите стол`}
          {step === 'waiter' && `${selectedTable?.title || `Стол ${selectedTable?.number}`} — выберите официанта`}
          {step === 'menu' && `Заказ · ${selectedTable?.title || `Стол ${selectedTable?.number}`} · ${selectedWaiter ? `${selectedWaiter.firstName || ''} ${selectedWaiter.lastName || ''}`.trim() : ''}`}
        </h2>
        {/* Breadcrumb на правой стороне */}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: T.textMuted, display: 'flex', gap: 6 }}>
          <BreadStep label="Зона" active={step === 'category'} done={step !== 'category'} />
          <span>›</span>
          <BreadStep label="Стол" active={step === 'table'} done={step === 'waiter' || step === 'menu'} />
          <span>›</span>
          <BreadStep label="Официант" active={step === 'waiter'} done={step === 'menu'} />
          <span>›</span>
          <BreadStep label="Меню" active={step === 'menu'} done={false} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 24px', background: T.cancelledBg, color: T.cancelled, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {step === 'category' && (
        <CategorySelect categories={tableCategories} onSelect={openCategory} />
      )}
      {step === 'table' && (
        <TableSelect
          tables={tables}
          category={selectedCategory}
          onSelect={(t) => { setSelectedTable(t); setStep('waiter') }}
        />
      )}
      {step === 'waiter' && (
        <WaiterSelect
          waiters={waiters}
          onSelect={(w) => { setSelectedWaiter(w); setStep('menu') }}
        />
      )}
      {step === 'menu' && (
        <MenuAndCart auth={auth} onSubmit={handleSubmit} submitting={submitting} onCartChange={setMenuCart} />
      )}
    </div>
  )
}

function BreadStep({ label, active, done }) {
  const color = active ? T.cta : done ? T.text : T.textDim
  return (
    <span style={{ color, fontWeight: active ? 800 : 600 }}>{label}</span>
  )
}

function CategorySelect({ categories, onSelect }) {
  if (!categories.length) {
    return (
      <div style={{ flex: 1, padding: 40, textAlign: 'center', color: T.textMuted }}>
        Категории не найдены. Подождите синхронизацию или создайте их в админ-панели.
      </div>
    )
  }
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 20px' }}>
        Всего папок: <strong>{categories.length}</strong>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            style={{
              background: T.surface,
              border: `2px solid ${T.borderStrong}`,
              padding: '28px 20px',
              cursor: 'pointer',
              fontFamily: T.font,
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minHeight: 130
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.panel }}
            onMouseLeave={(e) => { e.currentTarget.style.background = T.surface }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                background: T.panel,
                border: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"
                      stroke={T.cta} strokeWidth="2" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{c.title}</div>
            <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
              Открыть →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// =================== Table Select ===================
function TableSelect({ tables, category, onSelect }) {
  if (!tables.length) {
    return (
      <div style={{ flex: 1, padding: 40, textAlign: 'center', color: T.textMuted }}>
        В папке «{category?.title || ''}» нет столов
      </div>
    )
  }
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 20px' }}>
        Столов в папке «{category?.title || ''}»: <strong>{tables.length}</strong>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {tables.map((t) => {
          const occupied = t.status === 'occupied' || t.activeOrderId
          return (
            <button
              key={t._id}
              onClick={() => onSelect(t)}
              disabled={occupied}
              style={{
                background: occupied ? T.panelStrong : T.surface,
                border: `2px solid ${occupied ? T.cancelled : T.borderStrong}`,
                padding: '24px 16px',
                cursor: occupied ? 'not-allowed' : 'pointer',
                fontFamily: T.font,
                textAlign: 'left',
                opacity: occupied ? 0.7 : 1
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                {t.title || `Стол ${t.number}`}
              </div>
              <div style={{ fontSize: 13, color: occupied ? T.cancelled : T.textMuted, fontWeight: 700 }}>
                {occupied ? '● ЗАНЯТ' : '○ Свободен'}
              </div>
              {t.tableNumber && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>№ {t.tableNumber}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// =================== Waiter Select (#4/#5) ===================
function WaiterSelect({ waiters, onSelect }) {
  if (!waiters.length) {
    return (
      <div style={{ flex: 1, padding: 40, textAlign: 'center', color: T.textMuted }}>
        Официанты этого филиала не найдены. Заказ будет без официанта.
        <div style={{ marginTop: 18 }}>
          <button
            onClick={() => onSelect(null)}
            style={{
              padding: '14px 26px',
              background: T.cta,
              color: '#fff',
              border: 'none',
              fontFamily: T.font,
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Продолжить без официанта →
          </button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 20px' }}>
        Кто принял заказ? Официантов: <strong>{waiters.length}</strong>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {waiters.map((w) => (
          <button
            key={w._id}
            onClick={() => onSelect(w)}
            style={{
              background: T.surface,
              border: `2px solid ${T.borderStrong}`,
              padding: '24px 16px',
              cursor: 'pointer',
              fontFamily: T.font,
              textAlign: 'left'
            }}
          >
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>
              {`${w.firstName || ''} ${w.lastName || ''}`.trim() || w.phone || 'Официант'}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 700 }}>{w.phone || ''}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// =================== Menu + Cart ===================
function MenuAndCart({ onSubmit, submitting, onCartChange }) {
  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // {_id, foodName, price, quantity}

  useEffect(() => {
    if (onCartChange) onCartChange(cart)
  }, [cart, onCartChange])

  useEffect(() => {
    Promise.all([
      window.pos.hub.request('GET', '/api/foods'),
      window.pos.hub.request('GET', '/api/categories')
    ]).then(([f, c]) => {
      setFoods(f.success ? (f.data?.data || []) : [])
      setCategories(c.success ? (c.data?.data || []) : [])
    })
  }, [])

  const filtered = useMemo(() => {
    let list = foods.filter((f) => f.isAvailable !== false)
    if (activeCat !== 'all') {
      list = list.filter((f) => {
        const cid = typeof f.categoryId === 'object' ? f.categoryId?._id : f.categoryId
        return String(cid) === String(activeCat)
      })
    }
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((f) => (f.foodName || '').toLowerCase().includes(q))
    return list
  }, [foods, activeCat, search])

  const addToCart = (food) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c._id === food._id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 }
        return copy
      }
      return [
        ...prev,
        { _id: food._id, foodName: food.foodName, price: food.price || 0, quantity: 1 }
      ]
    })
  }

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c._id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* LEFT: menu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Search + categories */}
        <div style={{ padding: '16px 24px 12px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск блюда…"
            style={{
              width: '100%',
              height: 44,
              padding: '0 14px',
              fontSize: 15,
              fontFamily: T.font,
              background: T.panel,
              border: `2px solid ${T.border}`,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 12
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CategoryChip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
              Все ({foods.length})
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c._id} active={activeCat === c._id} onClick={() => setActiveCat(c._id)}>
                {c.title}
              </CategoryChip>
            ))}
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gridAutoRows: 'min-content',
          gap: 10
        }}>
          {filtered.map((f) => (
            <button
              key={f._id}
              onClick={() => addToCart(f)}
              style={{
                background: T.surface,
                border: `2px solid ${T.border}`,
                padding: '14px 12px',
                cursor: 'pointer',
                fontFamily: T.font,
                textAlign: 'left'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.borderStrong)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
            >
              <div style={{ fontSize: 14, fontWeight: 700, minHeight: 38, marginBottom: 6 }}>{f.foodName}</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: f.isHourly ? T.hourly : T.text,
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {f.isHourly ? `${fmt(f.hourlyPrice || 0)}/ч` : fmt(f.price || 0)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: cart */}
      <div
        style={{
          width: 380,
          borderLeft: `1px solid ${T.border}`,
          background: T.surface,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Корзина</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
            Блюд: <strong>{cartCount}</strong>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {cart.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 14 }}>
              Корзина пуста.<br />Выберите блюда из меню.
            </div>
          ) : (
            cart.map((c) => (
              <div
                key={c._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 18px',
                  borderBottom: `1px solid ${T.borderSoft}`,
                  gap: 10
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{c.foodName}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{fmt(c.price)} × {c.quantity}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <QtyBtn onClick={() => changeQty(c._id, -1)}>−</QtyBtn>
                  <span style={{
                    minWidth: 28,
                    textAlign: 'center',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums'
                  }}>{c.quantity}</span>
                  <QtyBtn onClick={() => changeQty(c._id, +1)}>+</QtyBtn>
                </div>
                <div style={{ width: 90, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(c.price * c.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom: total + submit */}
        <div style={{ padding: '16px 18px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 700 }}>ИТОГО</span>
            <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(cartTotal)}
            </span>
          </div>
          <button
            onClick={() => onSubmit(cart)}
            disabled={submitting || cart.length === 0}
            style={{
              width: '100%',
              height: 60,
              background: cart.length === 0 || submitting ? T.panelStrong : T.cta,
              color: '#fff',
              border: 'none',
              fontFamily: T.font,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 0.4,
              cursor: cart.length === 0 || submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Создание…' : 'СОЗДАТЬ ЗАКАЗ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryChip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? T.text : T.surface,
        color: active ? '#fff' : T.text,
        border: `2px solid ${active ? T.borderStrong : T.border}`,
        fontFamily: T.font,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}

function QtyBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        background: T.surface,
        border: `2px solid ${T.borderStrong}`,
        fontFamily: T.font,
        fontSize: 16,
        fontWeight: 900,
        cursor: 'pointer',
        padding: 0,
        lineHeight: 1
      }}
    >
      {children}
    </button>
  )
}
