import { useEffect, useState, useCallback } from 'react'
import { T, fmt } from '../../lib/theme'

export default function AdvancesPage() {
  const [advances, setAdvances] = useState([])
  const [waiters, setWaiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ waiterId: '', amount: '', description: '', paymentType: 'cash' })

  const load = useCallback(async () => {
    const shiftRes = await window.pos.hub.request('GET', '/api/shifts/active')
    const shiftId = shiftRes.success ? shiftRes.data?.data?._id : null
    const [advRes, staffRes] = await Promise.all([
      window.pos.hub.request('GET', '/api/advances' + (shiftId ? `?shiftId=${shiftId}` : '')),
      window.pos.hub.request('GET', '/api/staff')
    ])
    setAdvances(advRes.success ? advRes.data?.data || [] : [])
    const staff = staffRes.success ? staffRes.data?.data || [] : []
    setWaiters(
      staff
        .filter((s) => String(s.role || '').toLowerCase() === 'waiter')
        .map((s) => ({ _id: s._id, name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.phone || 'Официант' }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fmtInput = (v) => v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const parseAmount = (v) => parseFloat(String(v).replace(/\s/g, '')) || 0

  const submit = async () => {
    const amount = parseAmount(form.amount)
    if (!form.waiterId || !amount || amount <= 0) {
      alert('Выберите официанта и введите сумму')
      return
    }
    const w = waiters.find((x) => x._id === form.waiterId)
    setBusy(true)
    try {
      const res = await window.pos.hub.request('POST', '/api/advances', {
        waiterId: form.waiterId,
        waiterName: w?.name || '',
        amount,
        description: form.description,
        paymentType: form.paymentType
      })
      if (res.success) {
        setForm({ waiterId: '', amount: '', description: '', paymentType: 'cash' })
        setShowForm(false)
        load()
      } else {
        alert('Ошибка: ' + (res.error || 'не удалось сохранить'))
      }
    } finally {
      setBusy(false)
    }
  }

  const cashTotal = advances.filter((a) => (a.paymentType || 'cash') === 'cash').reduce((s, a) => s + a.amount, 0)
  const clickTotal = advances.filter((a) => a.paymentType === 'click').reduce((s, a) => s + a.amount, 0)

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
        <span style={{ fontSize: 24, fontWeight: 900 }}>Авансы официантам</span>
        <button onClick={() => setShowForm(true)} style={btn(T.cta, '#fff')}>
          + ВЫДАТЬ АВАНС
        </button>
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
            <Stat label="Наличными" value={fmt(cashTotal)} color={T.ready} />
            <Stat label="Переводом" value={fmt(clickTotal)} color={T.served} />
            <Stat label="Всего авансов" value={fmt(cashTotal + clickTotal)} color={T.hourly} />
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Список (офлайн)
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Загрузка…</div>
            ) : advances.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Авансы не найдены</div>
            ) : (
              advances.map((a) => {
                const cash = (a.paymentType || 'cash') === 'cash'
                return (
                  <div
                    key={a._id}
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
                      {new Date(a.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{a.waiterName || 'Официант'}</div>
                      <div style={{ fontSize: 13, color: T.textMuted }}>{a.description || '—'}</div>
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
                        color: T.cancelled
                      }}
                    >
                      −{fmt(a.amount)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {showForm && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Новый аванс</div>
            <Field label="Официант *">
              <select
                value={form.waiterId}
                onChange={(e) => setForm({ ...form, waiterId: e.target.value })}
                style={{ ...inp, height: 52 }}
              >
                <option value="">Выберите официанта</option>
                {waiters.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
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
                style={{ ...btn(T.cta, '#fff'), flex: 1, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Сохранение…' : 'Выдать'}
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
