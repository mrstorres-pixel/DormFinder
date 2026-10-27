import { useState } from 'react'
import { Link } from 'react-router-dom'
import { pesos } from '../lib/money'
import { walkingLabel } from '../lib/walking'
import AvailabilityStatus from './AvailabilityStatus'
import SavePlaceButton from './SavePlaceButton'
import './map-preview.css'

export default function MapListingPreview({ property, option, campus, browse, walking, onClose, onOptionChange, onCompare, compareDisabled }) {
  const [photo, setPhoto] = useState(0)
  const [failedUrl, setFailedUrl] = useState('')
  const photos = property.photos || []
  const current = photos[photo % (photos.length || 1)]
  const destination = '/listings/' + property.id + '?' + (campus ? 'campus_id=' + campus.id + '&' : '') + 'option=' + (option?.id || '')
  return <article className="map-preview panel map-place-card" aria-label="Selected map listing" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="map-place-photo">
      <Link to={destination} state={{ browse }} aria-label={'Open listing: ' + property.title}>{current && failedUrl !== current.url ? <img src={current.url} alt={current.caption || property.title} onError={() => setFailedUrl(current.url)} /> : <span className="map-place-no-photo">Photo unavailable</span>}</Link>
      <button type="button" className="map-preview-close" aria-label="Close listing preview" onClick={onClose}>×</button>
      <div className="map-place-save"><SavePlaceButton propertyId={property.id} optionId={option?.id} title={property.title} compact iconOnly /></div>
      {photos.length > 1 && <><button type="button" className="map-photo-arrow previous" aria-label="Previous preview photo" onClick={() => setPhoto(value => (value - 1 + photos.length) % photos.length)}>‹</button><button type="button" className="map-photo-arrow next" aria-label="Next preview photo" onClick={() => setPhoto(value => (value + 1) % photos.length)}>›</button><div className="map-photo-dots" aria-label={'Preview photo ' + ((photo % photos.length) + 1) + ' of ' + photos.length}>{photos.map((item, index) => <button type="button" key={item.id || index} aria-label={'Preview photo ' + (index + 1)} aria-pressed={photo % photos.length === index} onClick={() => setPhoto(index)} />)}</div></>}
    </div>
    <div className="map-place-copy"><p className="map-place-city">{property.city}</p><h3><Link to={destination} state={{ browse }}>{property.title}</Link></h3>
      {option && <><p className="map-preview-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><p className="map-preview-room-name">{option.name} · {option.capacity}-person room</p><AvailabilityStatus option={option} />
      {property.room_options.length > 1 && <fieldset className="map-room-options"><legend>Room options</legend>{property.room_options.map(room => <button type="button" key={room.id} aria-pressed={option.id === room.id} onClick={() => onOptionChange(room.id)}>{room.name}</button>)}</fieldset>}</>}
      {walking?.route && <p className="map-preview-walk">{walkingLabel(walking.route)}</p>}
    </div>
    <div className="map-preview-links"><Link className="btn btn-primary" to={destination} state={{ browse }}>View listing <span aria-hidden="true">→</span></Link>{option && <button type="button" className="btn btn-outline-primary" disabled={compareDisabled} onClick={onCompare}>Compare</button>}</div>
  </article>
}
