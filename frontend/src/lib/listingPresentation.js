export const listingTitle = value => typeof value === 'string' ? value.replace(/^\[DEMO\]\s*/i, '') : value

const catalogMessages = new Map([
  ['Campus demo v2 complete. Fictional rental; AI-generated image.', 'Listing content review completed.'],
  ['Replaced by the campus demo catalog. Private messages, saved places and viewing history retained.', 'Catalog refreshed. Private messages, saved places and viewing history retained.'],
  ['Sample set dormfinder-v1 complete.', 'Listing details saved.'],
  ['Synthetic demo content approved for software demonstration only. This is not a real rental offer.', 'Listing content approved.'],
  ['Demo review feedback: this fictional example illustrates a listing returned for correction.', 'Please review the listing details and submit corrections.'],
  ['A demo listing is ready for content review.', 'A listing is ready for content review.'],
])

function description(value) {
  if (typeof value !== 'string' || !value.startsWith('FICTIONAL DEMO LISTING — not a real rental offer.')) return value
  const room = value.match(/A sample ([\s\S]+?) The room options represent/)
  return (room ? room[1] + ' ' : '') + 'Room options represent separate, nonoverlapping inventory. Check each room option for availability, rent and charges.'
}

function caption(value) {
  if (typeof value !== 'string' || !/^(AI-generated demo interior|Synthetic (room|study-space) layout)/.test(value)) return value
  const capacity = value.match(/\b\d+-person room\b/)
  return capacity?.[0] || (value.startsWith('Synthetic study-space') ? 'Study area' : 'Room interior')
}

function address(value) {
  if (typeof value !== 'string') return value
  const street = value.match(/^Demo pin near (.+) \(fictional rental\)$/)
  if (street) return 'Near ' + street[1]
  return /^Fictional sample address \d+, Demo Zone [A-D]$/.test(value) ? 'Address not provided' : value
}

// Keep transport/storage values intact; normalize only known listing presentation fields.
// IDs, inventory, prices, private message bodies and owner-authored descriptions are preserved.
export function presentListingData(value, inheritedSample = false) {
  if (Array.isArray(value)) return value.map(item => presentListingData(item, inheritedSample))
  if (!value || typeof value !== 'object') return value
  const sample = typeof value.is_demo === 'boolean' ? value.is_demo : inheritedSample
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (key === 'geometry') return [key, item]
    if (key === 'title' || key === 'listing_title' || (key === 'label' && value.kind === 'Listing')) return [key, listingTitle(catalogMessages.get(item) || item)]
    if (key === 'reason' || key === 'moderation_reason') return [key, catalogMessages.get(item) || item]
    if (key === 'address') return [key, address(item)]
    if (sample && key === 'description') return [key, description(item)]
    if (sample && key === 'caption') return [key, caption(item)]
    if (sample && key === 'utilities_notes' && typeof item === 'string') return [key, item.replace(/^Illustrative terms:\s*/i, '')]
    return [key, presentListingData(item, sample)]
  }))
}
