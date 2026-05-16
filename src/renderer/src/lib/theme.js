// AridaiPOS theme tokens (variant B — warm/status-coded)
export const T = {
  bg: '#f4f2ed',
  surface: '#ffffff',
  panel: '#faf8f3',
  panelStrong: '#ece8de',
  border: '#a89c7e',
  borderSoft: '#c9c1ab',
  borderStrong: '#1f1c17',
  text: '#1a1814',
  textMuted: '#736d5e',
  textDim: '#a8a294',
  cta: '#c75a1a',
  ctaHover: '#a44612',
  ctaText: '#ffffff',
  ready: '#2f7a3a',
  readyBg: '#e3eddc',
  preparing: '#a9701a',
  preparingBg: '#f4e7cd',
  served: '#2b5b91',
  servedBg: '#dde7f1',
  pending: '#6c6759',
  pendingBg: '#e9e5d9',
  paid: '#2f7a3a',
  paidBg: '#dfeed6',
  cancelled: '#a8302a',
  cancelledBg: '#f1d8d6',
  saboy: '#8a5a14',
  saboyBg: '#f5e6c8',
  hourly: '#7a2f8e',
  hourlyBg: '#ead5ef',
  font: '"Helvetica Neue", Helvetica, Arial, sans-serif'
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
