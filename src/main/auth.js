const axios = require('axios')
const { makeStore } = require('./kv-store')

const store = makeStore('aridai-pos-auth')

const VPS_BASE_URL = process.env.VPS_BASE_URL || 'https://kz.kepket.uz/api'

async function loginCashier(phone, password) {
  try {
    const cleanPhone = '+' + String(phone).replace(/\D/g, '')
    const { data } = await axios.post(
      `${VPS_BASE_URL}/auth/login`,
      { phone: cleanPhone, password },
      { timeout: 15000 }
    )

    const payload = data.data || data
    const staff = payload.staff
    if (!staff) return { success: false, error: 'Не удалось получить данные сотрудника' }

    const role = String(staff.role || '').toLowerCase()
    // POS Monitor — кассирлар ва админлар кириши мумкин
    if (!['cashier', 'admin', 'owner'].includes(role)) {
      return { success: false, error: 'POS Monitor faqat kassir yoki admin kira oladi' }
    }

    const auth = {
      token: payload.token,
      staff: {
        _id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
        role: staff.role
      },
      restaurantId: payload.restaurant?._id || staff.restaurantId,
      restaurantName: payload.restaurant?.name,
      branchId: payload.branch?._id || staff.branchId,
      branchName: payload.branch?.name
    }

    store.set('auth', auth)
    return { success: true, data: auth }
  } catch (err) {
    const msg = err?.response?.data?.error?.message || err?.message || 'Сетевая ошибка'
    return { success: false, error: msg }
  }
}

function getStoredAuth() {
  return store.get('auth') || null
}

function clearAuth() {
  store.delete('auth')
}

module.exports = { loginCashier, getStoredAuth, clearAuth, VPS_BASE_URL }
