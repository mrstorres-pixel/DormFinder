export const editorSteps = [['photos', 'Photos'], ['rooms', 'Rooms & costs'], ['location', 'Location & details'], ['preview', 'Preview & review']]

export function hasLocationPin(property) {
  return property?.location_check?.can_map !== false && [['latitude', 4, 22], ['longitude', 116, 127.5]].every(([key, min, max]) => property?.[key] != null && String(property[key]).trim() !== '' && Number.isFinite(Number(property[key])) && Number(property[key]) >= min && Number(property[key]) <= max)
}

export function listingReadiness(property) {
  return [
    { label: 'Add at least one ready photo', step: 'photos', ready: !!property.photos?.some(photo => !photo.status || photo.status === 'ready') && !property.photos.some(photo => ['uploading', 'pending_deletion'].includes(photo.status)) },
    { label: 'Add room options and charges', step: 'rooms', ready: property.room_options?.length > 0 },
    { label: 'Confirm availability for every room', step: 'rooms', ready: property.room_options?.length > 0 && property.room_options.every(option => option.availability_stale === false) },
    { label: 'Describe the property in at least 40 characters', step: 'location', ready: [...(property.description || '').trim()].length >= 40 },
    { label: 'Add the street address', step: 'location', ready: !!property.address?.trim() },
    { label: 'Place the property pin', step: 'location', ready: hasLocationPin(property) },
  ]
}

export function nextEditorStep(property) {
  if (['pending_review', 'rejected', 'archived', 'suspended'].includes(property.status)) return 'preview'
  if (property.status === 'approved') return 'rooms'
  return listingReadiness(property).find(item => !item.ready)?.step || 'preview'
}
