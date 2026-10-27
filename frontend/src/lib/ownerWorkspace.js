import { listingReadiness, nextEditorStep } from './listingReadiness'

export const ownerSorts = [['newest', 'Newest properties first'], ['updated', 'Recently updated first'], ['oldest', 'Oldest properties first'], ['title_asc', 'Name: A–Z'], ['title_desc', 'Name: Z–A']]
export const ownerStatuses = [['', 'All listing statuses'], ['draft', 'Draft'], ['pending_review', 'In review'], ['approved', 'Approved'], ['rejected', 'Changes requested'], ['suspended', 'Suspended'], ['archived', 'Removed']]

export function ownerReturnPath(value) {
  return typeof value === 'string' && /^\/landlord(?:\?[^#]*)?$/.test(value) ? value : '/landlord'
}

export function ownerDetailsFingerprint(property = {}) {
  return JSON.stringify(['title', 'description', 'property_type', 'address', 'city', 'latitude', 'longitude', 'amenities', 'house_rules'].map(key => property?.[key] ?? null))
}

export function ownerRoomFingerprint(option) {
  return JSON.stringify(option && ['name', 'inventory_type', 'price_basis', 'capacity', 'total_units', 'available_units', 'monthly_rent_centavos', 'deposit_centavos', 'advance_months', 'utilities_notes', 'fees'].map(key => option[key] ?? null))
}

export function ownerListingState(property) {
  const options = property.room_options || []
  const taken = options.length > 0 && options.every(option => option.available_units === 0)
  const visibility = property.availability?.status
  if (property.status === 'approved') {
    if (visibility === 'hidden') return { label: 'Hidden · confirm availability', tone: 'attention', step: 'rooms', action: 'Refresh availability', note: 'Availability expired. Confirm each room’s actual vacancies to show it again.' }
    if (taken) return { label: 'All taken', tone: 'quiet', step: 'rooms', action: 'Update vacancies', note: 'Every room option is currently taken. Update the count when spaces become available.' }
    if (visibility === 'needs_confirmation') return { label: 'Availability update due', tone: 'attention', step: 'rooms', action: 'Refresh availability', note: 'Confirm the actual vacancies, including rooms whose count has not changed.' }
    return { label: 'Published', tone: 'live', step: 'rooms', action: 'Update availability', note: 'Confirm the vacancies in each room, even when the count is unchanged. Changes to prices, photos or property details need another review.' }
  }
  if (property.status === 'pending_review') return { label: 'In review', tone: 'review', step: 'preview', action: 'View submission', note: 'Your submission is awaiting administrator review. Editing is paused.' }
  if (property.status === 'rejected') return { label: 'Changes requested', tone: 'attention', step: 'preview', action: 'Read review feedback', note: property.moderation_reason || 'Read the feedback, make the requested changes and resubmit.' }
  if (property.status === 'archived') return { label: 'Removed', tone: 'quiet', step: 'preview', action: 'Review and restore', note: 'Your photos and conversation history are retained. Restoration creates a draft.' }
  if (property.status === 'suspended') return { label: 'Suspended', tone: 'attention', step: 'preview', action: 'View listing status', note: property.moderation_reason || 'This listing is restricted. Read the administrator’s explanation in its details.' }
  const missing = listingReadiness(property).filter(item => !item.ready)
  return { label: 'Draft · not publicly listed', tone: 'draft', step: nextEditorStep(property), action: missing.length ? 'Continue draft' : 'Preview and submit', note: missing.length ? `Next: ${missing[0].label.toLowerCase()}.` : 'Your saved details are ready. Preview the listing and send it for review.' }
}

export function ownerInventory(property) {
  const options = property.room_options || []
  const beds = options.filter(option => option.inventory_type === 'bedspace').reduce((total, option) => total + option.available_units, 0)
  const rooms = options.filter(option => option.inventory_type === 'whole_room').reduce((total, option) => total + option.available_units, 0)
  return [beds > 0 && `${beds} ${beds === 1 ? 'bed' : 'beds'}`, rooms > 0 && `${rooms} ${rooms === 1 ? 'room' : 'rooms'}`].filter(Boolean).join(' · ') || (options.length ? 'No current vacancies' : 'No room options yet')
}
