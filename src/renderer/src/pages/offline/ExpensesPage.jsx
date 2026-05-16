import { useEffect, useState, useCallback } from 'react'
import { T, fmt } from '../../lib/theme'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('expense') // expense | income
  const [form, setForm] = useState({ categoryName: '', amount: '', description: '', paymentType: 'cash' })

  const load = useCallback(async () => {
    const shiftRes = await window.pos.hub.request('GET', '/api/shifts/active')
    const shiftId = shiftRes.success ? shiftRes.data?.data?._id : null
    const res = await window.pos.hub.request('GET', '/api/expenses' + (shiftId ? `?shiftId=${shiftId}` : ''))
    setExpenses(res.success ? res.data?.data || [] : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fmtInput = (v) => v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const parseAmount = (v) => parseFloat(String(v).replace(/\s/g, '')) || 0

  const submit = async () => {
    const amount = parseAmount(form.amount)
    if (!amount || amount <= 0) {
      alert('Введите сумму')
      return
    }
    setBusy(true)
    try {
      const res = await window.pos.hub.request('POST', '/api/expenses', {
        amount,
        description: form.description,
        categoryName: form.categoryName,
        type: formType,
        paymentType: form.paymentType
      })
      if (res.success) {
        setForm({ categoryName: '', amount: '', description: '', paymentType: 'cash' })
        setShowForm(false)
        setFormType('expense')
        load()
      } else {
        alert('Ошибка: ' + (res.error || 'не удалось сохранить'))
      }
    } finally {
      setBusy(false)
    }
  }

  const cashTotal = expenses
    .filter((e) => (e.type || 'expense') === 'expense' && (e.paymentType || 'cash') === 'cash')
    .reduce((s, e) => s + e.amount, 0)
  const clickTotal = expenses
    .filter((e) => (e.type || 'expense') === 'expense' && e.paymentType === 'click')
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 900 }}>Расходы за смену</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              setFormType('income')
              setForm({ categoryName: '', amount: '', description: '', paymentType: 'cash' })
              setShowForm(true)
            }}
            style={btn(T.readyBg, T.ready)}
          >
            + Приход
          </button>
          <button
            onClick={() => {
              setFormType('expense')
              setForm({ categoryName: '', amount: '', description: '', paymentType: 'cash' })
              setShowForm(true)
            }}
            style={btn(T.cta, '#fff')}
          >
            + ДОБАВИТЬ РАСХОД
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: showForm ? '1fr 440px' : '1fr',
          gap: 18,
          padding: 22,
          minHeight: 0
        }}
      >
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Stat label="Наличные" value={fmt(cashTotal)} color={T.ready} />
            <Stat label="Перевод" value={fmt(clickTotal)} color={T.served} />
            <Stat label="Всего расход" value={fmt(cashTotal + clickTotal)} color={T.cancelled} />
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Список (офлайн)
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Загрузка…</div>
            ) : expenses.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Расходы не найдены</div>
            ) : (
              expenses.map((e) => {
                const income = e.type === 'income'
                const cash = (e.paymentType || 'cash') === 'cash'
                return (
                  <div
                    key={e._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr 120px 120px',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 6px',
                      borderBottom: `1px solid ${T.borderSoft}`
                    }}
                  >
                    <span style={{ fontSize: 13, color: T.textMuted }}>
                      {new Date(e.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {e.categoryName || (income ? 'Приход' : 'Расход')}
                      </div>
                      <div style={{ fontSize: 13, color: T.textMuted }}>{e.description || '—'}</div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: 'center',
                        background: cash ? T.readyBg : '#f8d9c0',
                        color: cash ? T.ready : T.cta
                      }}
                    >
                      {cash ? 'НАЛИЧНЫЕ' : 'ПЕРЕВОД'}
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: income ? T.ready : T.cancelled
                      }}
                    >
                      {income ? '+' : '−'}
                      {fmt(e.amount)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {showForm && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>
              {formType === 'income' ? 'Новый приход' : 'Новый расход'}
            </div>
            <Field label="Тип оплаты">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['cash', 'Наличные'],
                  ['click', 'Перевод']
                ].map(([id, label]) => {
                  const a = form.paymentType === id
                  return (
                    <button
                      key={id}
                      onClick={() => setForm({ ...form, paymentType: id })}
                      style={{
                        padding: 14,
                        background: a ? (id === 'cash' ? T.ready : T.served) : T.panel,
                        color: a ? '#fff' : T.text,
                        border: `2px solid ${a ? (id === 'cash' ? T.ready : T.served) : T.border}`,
                        fontFamily: T.font,
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Категория (необязательно)">
              <input
                value={form.categoryName}
                onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                placeholder="Напр.: продукты"
                style={inp}
              />
            </Field>
            <Field label="Сумма *">
              <input
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: fmtInput(e.target.value) })}
                placeholder="0"
                style={{ ...inp, fontSize: 24, fontWeight: 800, textAlign: 'right' }}
              />
            </Field>
            <Field label="Комментарий">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ ...inp, minHeight: 60, resize: 'none', paddingTop: 12 }}
              />
            </Field>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ ...btn(T.surface, T.text), flex: 1, border: `2px solid ${T.borderStrong}` }}
              >
                Отмена
              </button>
              <button
                onClick={submit}
                disabled={busy}
                style={{ ...btn(formType === 'income' ? T.ready : T.cta, '#fff'), flex: 1, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: T.panel, padding: '14px 16px', borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = {
  height: 52,
  padding: '0 14px',
  background: T.panel,
  border: `2px solid ${T.border}`,
  fontFamily: T.font,
  fontSize: 16,
  fontVariantNumeric: 'tabular-nums'
}

function btn(bg, color) {
  return {
    height: 48,
    padding: '0 22px',
    background: bg,
    color,
    border: 'none',
    fontFamily: T.font,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer'
  }
}
