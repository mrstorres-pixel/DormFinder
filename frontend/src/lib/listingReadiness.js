export const editorSteps = [['photos', 'Photos'], ['rooms', 'Rooms & costs'], ['location', 'Location & details'], ['preview', 'Preview & review']]

export function listingReadiness(property) {
  const located = [['latitude', 90], ['longitude', 180]].every(([key, limit]) => property[key] != null && String(property[key]).trim() !== '' && Number.isFinite(Number(property[key])) && Math.abs(Number(property[key])) <= limit)
  return [
    { label: 'Add at least one ready photo', step: 'photos', ready: property.photos?.some(photo => !photo.status || photo.status === 'ready') || false },
    { label: 'Add room options and charges', step: 'rooms', ready: property.room_options?.length > 0 },
    { label: 'Confirm availability for every room', step: 'rooms', ready: property.room_options?.length > 0 && property.room_options.every(option => option.availability_stale === false) },
    { label: 'Describe the property in at least 40 characters', step: 'location', ready: [...(property.description || '').trim()].length >= 40 },
    { label: 'Add the street address', step: 'location', ready: !!property.address?.trim() },
    { label: 'Place the property pin', step: 'location', ready: located },
  ]
}

export function nextEditorStep(property) {
  if (['pending_review', 'rejected', 'archived', 'suspended'].includes(property.status)) return 'preview'
  if (property.status === 'approved') return 'rooms'
  return listingReadiness(property).find(item => !item.ready)?.step || 'preview'
}
