import { describe, expect, it } from 'vitest'
import { ownerDetailsFingerprint, ownerInventory, ownerListingState, ownerReturnPath, ownerRoomFingerprint } from './ownerWorkspace'

const option = { id: 1, name: 'Twin beds', inventory_type: 'bedspace', available_units: 2, total_units: 4, availability_stale: false }
const property = { id: 8, title: 'Campus Rooms', status: 'draft', room_options: [option], photos: [], city: 'Manila' }

describe('owner workspace decisions', () => {
  it('distinguishes hidden, taken, published and review states without claiming drafts are public', () => {
    expect(ownerListingState(property)).toMatchObject({ step: 'photos', action: 'Continue draft', label: 'Draft · not publicly listed' })
    expect(ownerListingState({ ...property, status: 'approved', availability: { status: 'hidden' } })).toMatchObject({ action: 'Refresh availability', tone: 'attention' })
    expect(ownerListingState({ ...property, status: 'approved', room_options: [{ ...option, available_units: 0 }], availability: { status: 'current' } })).toMatchObject({ action: 'Update availability', label: 'Fully occupied' })
    expect(ownerListingState({ ...property, status: 'approved', owner_paused: true, availability: { status: 'hidden' } })).toMatchObject({ action: 'Resume listing', label: 'Paused' })
    expect(ownerListingState({ ...property, status: 'approved', availability: { status: 'current' } }).label).toBe('Live')
    expect(ownerListingState({ ...property, status: 'pending_review' }).action).toBe('View submission')
    expect(ownerListingState({ ...property, status: 'rejected', moderation_reason: 'Correct the address.' }).note).toBe('Correct the address.')
  })

  it('keeps beds and whole rooms separate and does not sum different inventory units', () => {
    expect(ownerInventory({ room_options: [option, { ...option, id: 2, inventory_type: 'whole_room', available_units: 1 }] })).toBe('2 beds · 1 room')
    expect(ownerInventory({ room_options: [{ ...option, available_units: 0 }] })).toBe('No current vacancies')
    expect(ownerInventory({ room_options: [] })).toBe('No room options yet')
  })

  it('accepts only a property-directory return path', () => {
    expect(ownerReturnPath('/landlord?q=rooms&page=2')).toBe('/landlord?q=rooms&page=2')
    for (const value of ['https://example.test', '//example.test', '/admin', '/landlord/properties/4', '/landlord#rooms', null]) expect(ownerReturnPath(value)).toBe('/landlord')
  })

  it('detects conflicting location content while allowing unrelated room and photo updates', () => {
    const snapshot = ownerDetailsFingerprint(property)
    expect(ownerDetailsFingerprint({ ...property, revision: 9, photos: [{ id: 2 }], room_options: [] })).toBe(snapshot)
    expect(ownerDetailsFingerprint({ ...property, city: 'Malolos' })).not.toBe(snapshot)
    expect(ownerDetailsFingerprint({ ...property, latitude: 14.6 })).not.toBe(snapshot)
  })

  it('distinguishes room terms and vacancy edits from calculated age metadata', () => {
    const snapshot = ownerRoomFingerprint(option)
    expect(ownerRoomFingerprint({ ...option, availability_age_days: 14, availability_stale: true })).toBe(snapshot)
    expect(ownerRoomFingerprint({ ...option, available_units: 0 })).not.toBe(snapshot)
    expect(ownerRoomFingerprint({ ...option, monthly_rent_centavos: 400000 })).not.toBe(snapshot)
  })
})
