export const amenities = {
  wifi: 'Wi-Fi', shared_kitchen: 'Shared kitchen', laundry: 'Laundry access',
  parking: 'Parking', study_area: 'Study area', security_personnel: 'Security personnel',
}

export function preferredOption(options = []) {
  return options.find(option => option.available_units > 0 && !option.availability_stale)
    || options.find(option => option.available_units > 0) || options[0]
}

export function searchParameters(params) {
  const data = Object.fromEntries(params)
  delete data.items
  const values = params.getAll('amenities[]')
  if (values.length) { delete data['amenities[]']; data.amenities = values }
  return data
}

export function campusSearchText(campus) {
  return [campus.name, campus.institution_name, campus.city, ...(campus.aliases || [])].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function campusResults(campuses, query) {
  const terms = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  return campuses.filter(campus => terms.every(term => campusSearchText(campus).includes(term))).slice(0, 12)
}

export function browseLink(campusId) {
  return '/listings?campus_id=' + campusId + '&radius_km=2&sort=recommended'
}

export function recommendationReasons(property, params) {
  const reasons = []
  const option = preferredOption(property.room_options)
  if (option?.available_units > 0 && !option.availability_stale) reasons.push('Availability recently confirmed')
  if (params.has('min_rent_centavos') || params.has('max_rent_centavos')) reasons.push('Matches your base-rent budget')
  if (property.distance_from_campus?.meters != null && params.has('campus_id')) reasons.push('Near your selected campus')
  return reasons
}
