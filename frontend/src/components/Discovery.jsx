import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { distanceLabel } from '../lib/discovery'
import { useComparison, comparisonItems } from '../lib/comparison'
import { pesos } from '../lib/money'
import { preferredOption } from '../lib/housing'
import { detailedMatches } from '../lib/practical'
import FavoriteButton from './SavePlaceButton'
import AvailabilityStatus from './AvailabilityStatus'
export { FavoriteButton }
import 'leaflet/dist/leaflet.css'
import './housing-presentation.css'

export function ComparisonTray() {
  const [params] = useSearchParams()
  const { selections, clear } = useComparison()
  if (!selections.length) return null
  return <div className="comparison-tray" role="region" aria-label="Your comparison selection"><span aria-live="polite" aria-atomic="true">{selections.length} of 3 selected</span>{selections.length >= 2 ? <Link className="btn btn-primary" to={'/compare?items=' + comparisonItems(selections) + (params.get('campus_id') ? '&campus_id=' + encodeURIComponent(params.get('campus_id')) : '')}>Compare {selections.length} listings</Link> : <button className="btn btn-primary" disabled>Select one more</button>}<button className="comparison-clear" aria-label="Clear selection" title="Clear selection" onClick={clear}><span aria-hidden="true">×</span></button></div>
}

export { default as SearchFilters } from './SearchFilters'
export { default as PhotoGallery } from './PhotoGallery'

export function ListingCard({ property, campus, chosenOptionId, selectedId, onSelect, onOptionChange }) {
  const [params] = useSearchParams()
  const { data: user } = useCurrentUser()
  const { selections, choose } = useComparison()
  const [choice, setChoice] = useState('')
  const selected = selections.find(item => item.property_id === property.id)
  const option = property.room_options.find(item => item.id === Number(chosenOptionId || choice || selected?.room_option_id)) || preferredOption(property.room_options)
  const checked = !!selected
  const destination = '/listings/' + property.id + '?option=' + (option?.id || '') + (campus ? '&campus_id=' + campus.id : '')
  const distance = campus ? property.distance_from_campus?.meters : null
  const shortDistance = Number.isFinite(distance) ? (distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(2)} km`) + ' · straight line to campus' : null
  const match = detailedMatches(property, params, option).find(reason => reason.startsWith('Base rent') || reason.startsWith('Required amenities'))
  return <article id={'listing-card-' + property.id} className={'property-card h-100 ' + (selectedId === property.id ? 'is-selected' : '')}>
    <Link className="property-cover-link" aria-label={'Open listing: ' + property.title} to={destination} state={{ browse: '/listings?' + params.toString() }}><div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} loading="lazy" /> : <span aria-hidden="true">⌂</span>}</div></Link>
    <div className="listing-card-body">
      <div className="listing-card-heading"><h2><Link to={destination} state={{ browse: '/listings?' + params.toString() }}>{property.title}</Link></h2>
      <p className="card-location" title={campus ? distanceLabel(property.distance_from_campus, campus) : undefined}>{property.city}{shortDistance && <> · {shortDistance}</>}</p>
      </div><div className="listing-card-options">{option && <>
        {property.room_options.length > 1 ? <div className="card-room-picker"><label className="form-label" htmlFor={'option-' + property.id}>Room option<span className="visually-hidden"> for {property.title}</span></label><select className="form-select" id={'option-' + property.id} value={option.id} onChange={event => { setChoice(event.target.value); onOptionChange?.(property.id, Number(event.target.value)); if (checked) choose(property.id, event.target.value) }}>{property.room_options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div> : <div className="card-room-picker card-single-room"><span className="form-label">Room option</span><p className="card-room-value">{option.name}</p></div>}
        <div className="card-price-line"><p className="room-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p></div>
        {option.monthly_fixed_total_centavos !== option.monthly_rent_centavos && <p className="card-monthly-total" aria-label={'Known monthly charges: ' + pesos(option.monthly_fixed_total_centavos)}>{pesos(option.monthly_fixed_total_centavos)} incl. fixed monthly fees</p>}
        <AvailabilityStatus option={option} askHref={destination + "#confirm-availability"} browse={"/listings?" + params.toString()} /><p className="card-room-meta"><span>{option.capacity}-person room</span><span className={option.available_units === 0 || option.availability_stale ? 'room-caution' : ''}>{option.available_units} {option.inventory_type === 'bedspace' ? (option.available_units === 1 ? 'bed' : 'beds') : (option.available_units === 1 ? 'room' : 'rooms')} available</span></p>
      </>}
      {match && <p className="card-match">{match}</p>}
      <div className="card-actions">{(!user || user.role === 'student') && option && <label><input type="checkbox" checked={checked} disabled={!checked && selections.length >= 3} onChange={event => choose(property.id, option.id, event.target.checked)} /><span>Compare<span className="visually-hidden"> {property.title}</span></span></label>}{onSelect && <button className="btn btn-link btn-sm" onClick={() => onSelect(property.id)}>Show on map</button>}<FavoriteButton compact propertyId={property.id} optionId={option?.id} title={property.title} /></div>
    </div></div>
  </article>
}

export { default as ListingMap } from './ListingLocationMap'
