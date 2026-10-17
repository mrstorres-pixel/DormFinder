import { describe, expect, it } from 'vitest'
import { listingReadiness, nextEditorStep } from './listingReadiness'

const ready = { status: 'draft', description: 'A'.repeat(40), address: 'Sample street', latitude: 0, longitude: 0, photos: [{ status: 'ready' }], room_options: [{ availability_stale: false }] }
describe('listing review readiness', () => {
  it('accepts zero coordinates and counts Unicode characters consistently with review validation', () => {
    expect(listingReadiness(ready).every(item => item.ready)).toBe(true)
    const checks = listingReadiness({ ...ready, description: '🏠'.repeat(20), latitude: '' })
    expect(checks.filter(item => !item.ready).map(item => item.label)).toEqual(['Describe the property in at least 40 characters', 'Place the property pin'])
    expect(listingReadiness({ ...ready, longitude: 181 }).at(-1).ready).toBe(false)
  })
  it('requires a ready photo and affirmative current availability instead of assuming missing values', () => {
    const checks = listingReadiness({ ...ready, photos: [{ status: 'uploading' }], room_options: [{}] })
    expect(checks.filter(item => !item.ready).map(item => item.step)).toEqual(['photos', 'rooms'])
  })
  it('returns owners to feedback, availability or the first unfinished step according to listing state', () => {
    expect(nextEditorStep({ ...ready, status: 'rejected' })).toBe('preview')
    expect(nextEditorStep({ ...ready, status: 'approved' })).toBe('rooms')
    expect(nextEditorStep({ ...ready, photos: [] })).toBe('photos')
    expect(nextEditorStep(ready)).toBe('preview')
  })
})
