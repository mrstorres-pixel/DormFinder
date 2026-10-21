import { amenities } from './housing'
import { pesos } from './money'

export function comparisonHighlights(rows, walkingRoutes) {
  const result = Object.fromEntries(rows.map(row => [row.id, []]))
  if (rows.length < 2) return result
  const eligible = rows.filter(row => row.room_options[0]?.available_units > 0 && row.room_options[0]?.availability_stale === false)
  for (const basis of ['per_person', 'per_room']) {
    const group = eligible.filter(row => row.room_options[0].price_basis === basis)
    if (group.length < 2) continue
    for (const [field,label] of [['monthly_fixed_total_centavos','Lowest known monthly charges'],['move_in_fixed_total_centavos','Lowest stated move-in charges']]) {
      if (!group.every(row => Number.isSafeInteger(row.room_options[0][field]))) continue
      const lowest = Math.min(...group.map(row => row.room_options[0][field]))
      const winners = group.filter(row => row.room_options[0][field] === lowest)
      if (winners.length === group.length) continue
      for (const row of winners) result[row.id].push(label + (winners.length > 1 ? ' (tie)' : ''))
    }
  }
  if (walkingRoutes) {
    const located = eligible.filter(row => Number.isFinite(walkingRoutes[row.id]?.route?.distance_meters))
    if (located.length >= 2 && located.length === rows.length) {
      const closest = Math.min(...located.map(row => walkingRoutes[row.id].route.distance_meters))
      const winners = located.filter(row => walkingRoutes[row.id].route.distance_meters === closest)
      if (winners.length < located.length) for (const row of winners) result[row.id].push('Shortest walk to campus' + (winners.length > 1 ? ' (tie)' : ''))
    }
    return result
  }
  const located = eligible.filter(row => Number.isFinite(row.distance_from_campus?.meters))
  if (located.length > 1 && located.every(row => row.distance_from_campus.campus_id === located[0].distance_from_campus.campus_id)) {
    const closest = Math.min(...located.map(row => row.distance_from_campus.meters))
    const winners = located.filter(row => row.distance_from_campus.meters === closest)
    if (winners.length < located.length) for (const row of winners) result[row.id].push('Closest to selected campus' + (winners.length > 1 ? ' (tie)' : ''))
  }
  return result
}

export function detailedMatches(property, params, option) {
  const reasons = []
  if (!option) return reasons
  if (option.available_units > 0 && option.availability_stale === false) reasons.push('Availability recently confirmed')
  const budgeted = params.has('min_rent_centavos') || params.has('max_rent_centavos')
  const rent = option.monthly_rent_centavos
  if (budgeted && Number.isSafeInteger(rent) && (!params.has('min_rent_centavos') || rent >= Number(params.get('min_rent_centavos'))) && (!params.has('max_rent_centavos') || rent <= Number(params.get('max_rent_centavos'))) && (!params.has('price_basis') || option.price_basis === params.get('price_basis'))) {
    reasons.push('Base rent ' + pesos(rent) + ' fits your budget')
  }
  if (params.get('inventory_type') === option.inventory_type) reasons.push(option.inventory_type === 'bedspace' ? 'Your chosen bedspace type' : 'Your chosen whole-room type')
  const required = params.getAll('amenities[]')
  if (required.length && property.amenities && required.every(key => property.amenities.includes(key))) reasons.push('Required amenities: ' + required.map(key => amenities[key] || key).join(', '))
  const meters = property.distance_from_campus?.meters
  if (Number.isFinite(meters) && params.has('campus_id')) {
    const radius = Number(params.get('radius_km'))
    if (radius > 0 && meters <= radius * 1000) reasons.push('Within your ' + radius + ' km campus radius')
    else reasons.push((meters / 1000).toFixed(2) + ' km from your campus (straight line)')
  }
  return reasons
}

export function viewingIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid Philippine date and time.')
  const time = new Date(value + ':00+08:00')
  if (!Number.isFinite(time.getTime()) || new Date(time.getTime() + 8 * 3600000).toISOString().slice(0,16) !== value) throw new Error('Choose a valid Philippine date and time.')
  return time.toISOString()
}
export function viewingLabel(value) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' PHT'
}
