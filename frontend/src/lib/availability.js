const day = 86_400_000

export function availabilityInfo(option, now = Date.now()) {
  const confirmed = new Date(option?.availability_confirmed_at || '').getTime()
  if (!Number.isFinite(confirmed)) return { label: 'Availability not confirmed', stale: true, expired: !!option?.availability_expired, date: null }
  const age = Number.isInteger(option.availability_age_days) ? Math.max(0, option.availability_age_days) : Math.max(0, Math.floor((now - confirmed) / day))
  const expired = option.availability_expired ?? (now - confirmed >= 30 * day)
  const stale = option.availability_stale ?? age >= 14
  const when = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`
  return { label: expired ? `Last confirmed ${when}` : option.available_units === 0 ? `Vacancies updated ${when}` : `${stale ? 'Last confirmed' : 'Confirmed'} ${when}`, stale, expired, date: new Date(confirmed).toISOString() }
}

export function confirmationQuestion(option) {
  return `Hi, is ${option.name} still available? Could you confirm the current vacancies and when I could visit?`
}
