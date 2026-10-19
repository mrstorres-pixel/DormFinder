import { describe, expect, it } from 'vitest'
import { availabilityInfo, confirmationQuestion } from './availability'

const now = Date.parse('2026-10-19T04:00:00Z')
const room = { name: 'Twin room', available_units: 2, availability_confirmed_at: '2026-10-19T00:00:00Z' }

describe('availability freshness', () => {
  it('shows explicit dates without claiming unknown availability was recently confirmed', () => {
    expect(availabilityInfo(room, now).label).toBe('Confirmed today')
    expect(availabilityInfo({ ...room, availability_confirmed_at: '2026-10-18T00:00:00Z' }, now).label).toBe('Confirmed yesterday')
    expect(availabilityInfo({ ...room, availability_confirmed_at: null }, now).label).toBe('Availability not confirmed')
    expect(availabilityInfo({ ...room, available_units: 0 }, now).label).toBe('Vacancies updated today')
  })
  it('uses the server age and flags, with exact fourteen- and thirty-day fallback boundaries', () => {
    expect(availabilityInfo({ ...room, availability_age_days: 18, availability_stale: true }, now)).toMatchObject({ label: 'Last confirmed 18 days ago', stale: true })
    expect(availabilityInfo(room, Date.parse(room.availability_confirmed_at) + 14 * 86400000).stale).toBe(true)
    expect(availabilityInfo(room, Date.parse(room.availability_confirmed_at) + 30 * 86400000)).toMatchObject({ label: 'Last confirmed 30 days ago', expired: true })
    expect(availabilityInfo({ ...room, availability_age_days: 0, availability_stale: false, availability_expired: false }, now + 50 * 86400000)).toMatchObject({ label: 'Confirmed today', expired: false })
  })
  it('suggests a room-specific question without sending it', () => {
    expect(confirmationQuestion(room)).toContain('is Twin room still available?')
  })
})
