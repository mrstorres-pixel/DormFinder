import { describe, expect, it, vi } from 'vitest'
import { calendarMonth, loadViewingMonth, monthDays, philippineDate, shiftMonth } from './viewingCalendar'

describe('viewing calendar', () => {
  it('uses Philippine dates at UTC day and month boundaries', () => {
    expect(philippineDate('2026-10-31T15:59:59Z')).toBe('2026-10-31')
    expect(philippineDate('2026-10-31T16:00:00Z')).toBe('2026-11-01')
    expect(monthDays('2028-02').days).toHaveLength(29)
    expect(monthDays('2026-11').offset).toBe(0)
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(calendarMonth('2026-11')).toBe('2026-11')
    expect(calendarMonth('2026-13')).not.toBe('2026-13')
  })

  it('loads every server page and orders active appointments without presenting cancellations as visits', async () => {
    const api = { get: vi.fn().mockResolvedValueOnce({ data: { data: [{ id: 1, status: 'requested', starts_at: '2026-11-02T04:00:00Z' }, { id: 2, status: 'cancelled', starts_at: '2026-11-01T04:00:00Z' }], meta: { last_page: 2 } } }).mockResolvedValueOnce({ data: { data: [{ id: 3, status: 'accepted', starts_at: '2026-11-01T04:00:00Z' }], meta: { last_page: 2 } } }) }
    const signal = new AbortController().signal
    expect((await loadViewingMonth(api, '2026-11', signal)).map(row => row.id)).toEqual([3, 1])
    expect(api.get).toHaveBeenNthCalledWith(2, '/viewings', { params: { month: '2026-11', page: 2 }, signal })
  })

  it('rejects an incomplete month rather than displaying partial appointments as a complete calendar', async () => {
    const api = { get: vi.fn().mockResolvedValueOnce({ data: { data: [], meta: { last_page: 2 } } }).mockRejectedValueOnce(new Error('network unavailable')) }
    await expect(loadViewingMonth(api, '2026-11')).rejects.toThrow('network unavailable')
  })
})
