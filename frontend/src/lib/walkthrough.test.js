import { describe, expect, it } from 'vitest'
import { coachPosition, readWalkthrough, spotlightBounds, walkthroughKey, walkthroughSteps } from './walkthrough'

describe('walkthrough progress and screen positioning', () => {
  it('isolates progress by account and role and discards expired or malformed progress', () => {
    const owner = walkthroughKey({ id: 5, role: 'student' })
    expect(owner).not.toBe(walkthroughKey({ id: 5, role: 'landlord' }))
    expect(walkthroughKey({ id: 7, role: 'student' })).not.toBe(owner)
    const stored = { owner, status: 'paused', index: 2, updated: Date.now(), started: true, context: { listingPath: '/listings/55', propertyPath: '//example.test/steal' } }
    const storage = { getItem: () => JSON.stringify(stored) }
    expect(readWalkthrough(owner, storage)).toMatchObject({ status: 'paused', index: 2, context: { listingPath: '/listings/55', propertyPath: null } })
    stored.updated = Date.now() - 43_200_001
    expect(readWalkthrough(owner, storage).status).toBe('idle')
    stored.updated = Date.now(); stored.index = 30
    expect(readWalkthrough(owner, storage).status).toBe('idle')
    expect(readWalkthrough(owner, { getItem() { throw Error('Storage blocked') } }).status).toBe('idle')
  })

  it('adapts to real records without asking a new landlord to create tutorial data', () => {
    const fresh = walkthroughSteps('landlord')
    expect(fresh.some(step => step.key === 'private-draft')).toBe(true)
    expect(fresh.some(step => step.key === 'photos')).toBe(false)
    const existing = walkthroughSteps('landlord', { propertyPath: '/landlord/properties/55', propertyStatus: 'approved' })
    expect(existing.find(step => step.key === 'photos').path).toBe('/landlord/properties/55#photos')
    expect(existing.find(step => step.key === 'availability').body).toContain('Set available units to 0')
    expect(walkthroughSteps('student').some(step => step.key === 'contact')).toBe(false)
    expect(walkthroughSteps('student', { listingPath: '/listings/55' }).find(step => step.key === 'contact').path).toBe('/listings/55')
  })

  it('clips oversized highlights and keeps coach controls inside narrow and short viewports', () => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 480 }]) {
      const target = spotlightBounds({ left: -10, top: -20, right: viewport.width + 10, bottom: viewport.height + 200 }, viewport)
      expect(target.left).toBeGreaterThanOrEqual(0)
      expect(target.bottom).toBeLessThanOrEqual(viewport.height)
      for (const rect of [target, null, { left: 10, top: 80, right: 140, bottom: 120, width: 130, height: 40 }]) {
        const coach = coachPosition(rect, viewport, { height: 330 })
        expect(coach.left).toBeGreaterThanOrEqual(16)
        expect(coach.top).toBeGreaterThanOrEqual(16)
        expect(coach.left + coach.width).toBeLessThanOrEqual(viewport.width - 16)
        expect(coach.top + 330).toBeLessThanOrEqual(viewport.height - 16)
      }
    }
  })
})
