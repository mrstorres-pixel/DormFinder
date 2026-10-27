import { describe, expect, it } from 'vitest'
import { presentListingData } from './listingPresentation'

describe('listing presentation', () => {
  it('cleans known catalog wording throughout a listing without changing its identity, costs or inventory', () => {
    const source = { data: { id: 70, is_demo: true, title: '[DEMO] Arlegui Shared Dorm', description: 'FICTIONAL DEMO LISTING — not a real rental offer. A sample 4-person student rooms for TIP Manila — P. Casal. The room options represent separate, nonoverlapping inventory. Interior images are AI-generated examples. [Campus demo v2/test]', photos: [{ id: 2, url: '/private-photo?token=unchanged', caption: 'AI-generated demo interior — illustrative 4-person room, not an actual property photo' }], room_options: [{ id: 21, monthly_rent_centavos: 320000, available_units: 3, utilities_notes: 'Illustrative terms: water included.' }] } }
    const result = presentListingData(source)
    expect(result.data.title).toBe('Arlegui Shared Dorm')
    expect(result.data.description).toContain('4-person student rooms for TIP Manila — P. Casal.')
    expect(result.data.description).not.toMatch(/demo|fictional|illustrative/i)
    expect(result.data.photos[0]).toEqual({ ...source.data.photos[0], caption: '4-person room' })
    expect(result.data.room_options[0]).toEqual({ ...source.data.room_options[0], utilities_notes: 'water included.' })
    expect(source.data.title).toBe('[DEMO] Arlegui Shared Dorm')
    expect(result.data.is_demo).toBe(true)
  })

  it('keeps owner-authored descriptions, private messages and ordinary text unchanged', () => {
    const source = { data: { is_demo: false, title: 'Demonstration House', description: 'A demonstration space with a study room.', photos: [{ caption: 'Owner-provided room photo' }], utilities_notes: 'Illustrative terms: ask the owner.', messages: [{ body: '[DEMO] Keep this private message exactly as written.' }], reason: 'Fictional issue reported by a user.' } }
    expect(presentListingData(source)).toEqual(source)
  })

  it('normalizes historical listing titles and search labels without changing location names or missing values', () => {
    const source = [{ listing_snapshot: { title: '[DEMO] Saved residence' }, listing_title: '[DEMO] Saved residence', property_preview: null }, { kind: 'Listing', label: '[DEMO] Student rooms' }, { kind: 'Location', label: '[DEMO] Location' }]
    expect(presentListingData(source)).toEqual([{ listing_snapshot: { title: 'Saved residence' }, listing_title: 'Saved residence', property_preview: null }, { kind: 'Listing', label: 'Student rooms' }, { kind: 'Location', label: '[DEMO] Location' }])
  })

  it('retains walking geometry and supports older catalog descriptions and image captions', () => {
    const geometry = { type: 'LineString', coordinates: [[120.9, 14.6], [121, 14.7]] }
    const source = { is_demo: true, description: 'FICTIONAL DEMO LISTING — not a real rental offer. These sample rooms exist only to demonstrate DormFinder.', photos: [{ caption: 'Synthetic study-space layout — not an actual property photo' }], geometry }
    const result = presentListingData(source)
    expect(result.geometry).toBe(geometry)
    expect(result.description).not.toMatch(/demo|fictional/i)
    expect(result.photos[0].caption).toBe('Study area')
  })
})
