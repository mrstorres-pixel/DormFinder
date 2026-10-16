import { describe, expect, it } from 'vitest'
import { savedDetails, savedDraft } from './savedPlaces'

const row = { property_id: 5, room_option_id: null, note: '', saved_details: { room_option_id: null, note: '' }, contexts: [
  { collection_id: 3, room_option_id: 8, note: 'Twin room by campus' },
  { collection_id: 4, room_option_id: 9, note: 'Solo option for later' },
] }

describe('saved place details', () => {
  it('keeps each collection room and private note separate', () => {
    expect(savedDetails(row, '3')).toMatchObject({ room_option_id: 8, note: 'Twin room by campus' })
    expect(savedDraft(row, '4')).toEqual({ room: '9', note: 'Solo option for later', collections: [3, 4] })
    expect(savedDetails(row, '')).toBe(row)
  })
  it('opens a sole legacy context without copying its note into the uncollected save', () => {
    const single = { ...row, default_context: 3, room_option_id: 8, note: 'Twin room by campus', contexts: row.contexts.slice(0, 1) }
    expect(savedDetails(single, '')).toBe(single.contexts[0])
    expect(savedDraft(single, '')).toEqual({ room: '', note: '', collections: [3] })
    expect(savedDraft(single, 3).note).toBe('Twin room by campus')
  })
})
