export const listingTitle = value => typeof value === 'string' ? value.replace(/^\[DEMO\]\s*/i, '') : value

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

// Keep transport/storage values intact; normalize only known listing presentation fields.
// IDs, inventory, prices, private message bodies and owner-authored descriptions are preserved.
export function presentListingData(value, inheritedSample = false) {
  if (Array.isArray(value)) return value.map(item => presentListingData(item, inheritedSample))
  if (!value || typeof value !== 'object') return value
  const sample = typeof value.is_demo === 'boolean' ? value.is_demo : inheritedSample
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (key === 'geometry') return [key, item]
    if (key === 'title' || key === 'listing_title' || (key === 'label' && value.kind === 'Listing')) return [key, listingTitle(item)]
    if (sample && key === 'description') return [key, description(item)]
    if (sample && key === 'caption') return [key, caption(item)]
    if (sample && key === 'utilities_notes' && typeof item === 'string') return [key, item.replace(/^Illustrative terms:\s*/i, '')]
    return [key, presentListingData(item, sample)]
  }))
}
