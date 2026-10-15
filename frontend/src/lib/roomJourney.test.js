import { describe, expect, it } from 'vitest'
import { roomJourney } from './roomJourney'

describe('scroll-driven room entrance', () => {
  it('opens the door fully before the camera starts entering', () => {
    expect(roomJourney(0).door).toBeCloseTo(.14)
    expect(roomJourney(.25).door).toBeCloseTo(Math.PI / 2, 2)
    expect(roomJourney(.25).travel).toBe(0)
    expect(roomJourney(.5).travel).toBeCloseTo(.5)
    expect(roomJourney(.75).travel).toBe(1)
  })
  it('keeps the ending separate from the opening and clamps overscroll', () => {
    expect(roomJourney(-1)).toEqual(roomJourney(0))
    expect(roomJourney(2)).toEqual(roomJourney(1))
    expect(roomJourney(0)).toMatchObject({ intro: 1, ending: 0 })
    expect(roomJourney(.5)).toMatchObject({ intro: 0, ending: 0 })
    expect(roomJourney(1)).toMatchObject({ intro: 0, ending: 1 })
  })
})
