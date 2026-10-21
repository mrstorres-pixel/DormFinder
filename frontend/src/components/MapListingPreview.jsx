import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { pesos } from '../lib/money'
import { walkingLabel } from '../lib/walking'
import './map-preview.css'
import AvailabilityStatus from './AvailabilityStatus'

export default function MapListingPreview({ property, option, campus, browse, walking, onClose, onOptionChange, onCompare, compareDisabled }) {
  const [expanded, setExpanded] = useState(false)
  const details = useId()
  const destination = '/listings/' + property.id + '?' + (campus ? 'campus_id=' + campus.id + '&' : '') + 'option=' + (option?.id || '')
  return <article className={'map-preview panel compact-map-preview' + (expanded ? ' is-expanded' : '')} aria-label="Selected map listing" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <button className="map-preview-close" aria-label="Close listing preview" onClick={onClose}>×</button>
    <div className="map-preview-summary">
      {property.photos?.[0] && <Link className="map-preview-image" aria-label={'Open listing: ' + property.title} to={destination} state={{ browse }}><img src={property.photos[0].url} alt={property.photos[0].caption} /></Link>}
      <div className="map-preview-copy"><strong><Link to={destination} state={{ browse }}>{property.title}</Link></strong>{option && <><p className="map-preview-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><p className="map-preview-room-name">{option.name}</p><AvailabilityStatus option={option} /></>}{walking?.route && <p className="map-preview-walk">{walkingLabel(walking.route)}</p>}</div>
    </div>
    <div className="map-preview-links"><button type="button" aria-expanded={expanded} aria-controls={details} onClick={() => setExpanded(value => !value)}><span>{expanded ? 'Less detail' : 'Room details'}</span><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={expanded ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'} /></svg></button><Link to={destination} state={{ browse }}><span>View listing</span><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10m-4-4 4 4-4 4" /></svg></Link></div>
    <div id={details} hidden={!expanded} className="map-preview-expanded">{option && <>
      <label className="form-label" htmlFor="map-preview-room">Room in map preview</label><select className="form-select form-select-sm" id="map-preview-room" value={option.id} onChange={event => onOptionChange(Number(event.target.value))}>{property.room_options.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
      <p>{pesos(option.monthly_fixed_total_centavos)} known monthly · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</p><p>{option.capacity}-person room · {option.available_units} available{option.available_units === 0 ? ' · Sold out' : option.availability_stale ? ' · Needs confirmation' : ' · Recently confirmed'}</p>
      <button className="btn btn-outline-primary btn-sm" disabled={compareDisabled} onClick={onCompare}>Add to comparison</button>
    </>}</div>
  </article>
}
