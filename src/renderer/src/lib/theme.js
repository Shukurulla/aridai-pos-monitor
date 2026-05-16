// AridaiPOS theme tokens (variant B — warm/status-coded)
export const T = {
  bg: '#f4f1ea',
  surface: '#ffffff',
  panel: '#faf7f0',
  panelStrong: '#ece7da',
  border: '#d8d2c2',
  borderSoft: '#e6e1d2',
  borderStrong: '#0a0a0a',
  text: '#0a0a0a',
  textMuted: '#6b6657',
  textDim: '#a39d8c',
  brand: '#d72121',
  brandDeep: '#a51616',
  brandSoft: '#fbe5e5',
  cta: '#d72121',
  ctaHover: '#a51616',
  ctaText: '#ffffff',
  ready: '#1f7a3a',
  readyBg: '#dcecdb',
  preparing: '#a86a14',
  preparingBg: '#f3e6c8',
  served: '#22588c',
  servedBg: '#d8e3ef',
  pending: '#6c6759',
  pendingBg: '#e6e2d5',
  paid: '#1f7a3a',
  paidBg: '#d6ecd2',
  cancelled: '#a8302a',
  cancelledBg: '#f1d8d6',
  saboy: '#8a5a14',
  saboyBg: '#f5e6c8',
  hourly: '#6a2f8e',
  hourlyBg: '#e6d5ef',
  font: '"Manrope", "Helvetica Neue", Helvetica, Arial, sans-serif'
}

export const STATUS = {
  pending: { label: 'ОЖИДАЕТ', color: T.pending, bg: T.pendingBg },
  preparing: { label: 'ГОТОВИТСЯ', color: T.preparing, bg: T.preparingBg },
  ready: { label: 'ГОТОВ', color: T.ready, bg: T.readyBg },
  served: { label: 'ПОДАНО', color: T.served, bg: T.servedBg },
  paid: { label: 'ОПЛАЧЕНО', color: T.paid, bg: T.paidBg },
  cancelled: { label: 'ОТМЕНЁН', color: T.cancelled, bg: T.cancelledBg }
}

export const fmt = (n) => Number(n || 0).toLocaleString('ru-RU') + ' ₸'
export const fmtN = (n) => Number(n || 0).toLocaleString('ru-RU')
