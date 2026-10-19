export function philippineDate(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function calendarMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2199 ? value : philippineDate(Date.now()).slice(0, 7)
}

export function shiftMonth(month, amount) {
  const date = new Date(month + '-01T12:00:00Z')
  date.setUTCMonth(date.getUTCMonth() + amount)
  return date.toISOString().slice(0, 7)
}

export function monthDays(month) {
  const first = new Date(month + '-01T12:00:00Z')
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return { offset: first.getUTCDay(), days: Array.from({ length: count }, (_, i) => month + '-' + String(i + 1).padStart(2, '0')) }
}

export async function loadViewingMonth(api, month, signal) {
  const rows = []
  let page = 1
  let last
  do {
    const { data } = await api.get('/viewings', { params: { month, page }, signal })
    rows.push(...data.data)
    last = data.meta?.last_page || 1
    page++
  } while (page <= last)
  return rows.filter(row => ['accepted', 'requested', 'proposed'].includes(row.status)).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at) || a.id - b.id)
}
