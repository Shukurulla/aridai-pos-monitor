import { useEffect, useState } from 'react'
import { T, fmt } from '../../lib/theme'

export default function MenuPage() {
  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [foodsRes, catsRes] = await Promise.all([
        window.pos.hub.request('GET', '/api/foods'),
        window.pos.hub.request('GET', '/api/categories')
      ])
      if (cancelled) return
      setFoods(foodsRes.success ? (foodsRes.data?.data || []) : [])
      setCategories(catsRes.success ? (catsRes.data?.data || []) : [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = activeCat === 'all' ? foods : foods.filter((f) => {
    const cid = typeof f.categoryId === 'object' ? f.categoryId?._id : f.categoryId
    return String(cid) === String(activeCat)
  })

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Меню</h1>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 22px' }}>
        Локальная копия меню (синхронизировано с VPS)
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <CategoryChip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
          Все ({foods.length})
        </CategoryChip>
        {categories.map((c) => (
          <CategoryChip key={c._id} active={activeCat === c._id} onClick={() => setActiveCat(c._id)}>
            {c.title}
          </CategoryChip>
        ))}
      </div>

      {loading ? (
        <div style={{ color: T.textMuted, padding: 40, textAlign: 'center' }}>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <EmptyMenu />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {filtered.map((f) => (
            <div
              key={f._id}
              style={{
                background: T.surface,
                border: `2px solid ${T.border}`,
                padding: 16,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.borderStrong)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, minHeight: 44 }}>{f.foodName}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: f.isHourly ? T.hourly : T.text, fontVariantNumeric: 'tabular-nums' }}>
                {f.isHourly ? `${fmt(f.hourlyPrice)}/ч` : fmt(f.price)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryChip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px',
        background: active ? T.text : T.surface,
        color: active ? '#fff' : T.text,
        border: `2px solid ${active ? T.borderStrong : T.border}`,
        fontFamily: T.font,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}

function EmptyMenu() {
  return (
    <div style={{ padding: 60, textAlign: 'center', background: T.surface, border: `1px dashed ${T.border}`, color: T.textMuted }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Меню пусто</div>
      <div style={{ fontSize: 14 }}>Локальный сервер ещё не получил меню с VPS</div>
    </div>
  )
}
