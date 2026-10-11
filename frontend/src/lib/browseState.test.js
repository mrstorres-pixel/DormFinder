import { describe, expect, it } from 'vitest'
import { browseKey, readBrowseState, saveBrowseState } from './browseState'

describe('browse continuity', () => {
  it('shares context across result pages and equivalent filter ordering, but separates campuses and bounds', () => {
    const first = new URLSearchParams('campus_id=1&page=1&amenities[]=wifi&amenities[]=laundry')
    const second = new URLSearchParams('amenities[]=laundry&campus_id=1&page=2&amenities[]=wifi')
    expect(browseKey(first)).toBe(browseKey(second))
    expect(browseKey(first)).not.toBe(browseKey(new URLSearchParams('campus_id=2')))
    expect(browseKey(first)).not.toBe(browseKey(new URLSearchParams(first.toString() + '&south=14')))
  })

  it('retains map position and room choices while discarding invalid state', () => {
    sessionStorage.clear()
    const value = { showMap: false, selectedId: 20, choices: { 20: 7, 21: -1 }, viewport: { center: [14.6, 121], zoom: 16, campusId: 1, needsSearch: true } }
    saveBrowseState('campus_id=1', value)
    expect(readBrowseState('campus_id=1')).toEqual({ ...value, choices: { 20: 7 } })
    expect(readBrowseState('campus_id=2')).toBeNull()
    saveBrowseState('bad', { ...value, viewport: { ...value.viewport, center: [999, 121] } })
    expect(readBrowseState('bad').viewport).toBeNull()
  })

  it('bounds stored searches and works with unavailable storage', () => {
    sessionStorage.clear()
    for (let index = 0; index < 14; index++) saveBrowseState(String(index), { showMap: true })
    expect(readBrowseState('0')).toBeNull()
    expect(readBrowseState('13').showMap).toBe(true)
    const unavailable = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
    expect(readBrowseState('anything', unavailable)).toBeNull()
    expect(() => saveBrowseState('anything', {}, unavailable)).not.toThrow()
  })
})
