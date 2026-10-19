import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { distanceLabel } from '../lib/discovery'
import { useComparison, comparisonItems } from '../lib/comparison'
import { pesos } from '../lib/money'
import { preferredOption } from '../lib/housing'
import { detailedMatches } from '../lib/practical'
import { campusIcon } from '../lib/mapMarkers'
import { mapLabelLayout } from '../lib/mapLabelLayout'
import { useWalkingRoute, drawWalkingRoute } from '../lib/walking'
import WalkingRouteControl from './WalkingRouteControl'
import FavoriteButton from './SavePlaceButton'
export { FavoriteButton }
import 'leaflet/dist/leaflet.css'
import './housing-presentation.css'
import CampusMap from './CampusMap'

export function ComparisonTray() {
  const [params] = useSearchParams()
  const { selections, clear } = useComparison()
  if (!selections.length) return null
  return <div className="comparison-tray" role="region" aria-label="Your comparison selection"><span aria-live="polite" aria-atomic="true">{selections.length} of 3 selected</span><Link className="btn btn-primary" to={'/compare?items=' + comparisonItems(selections) + (params.get('campus_id') ? '&campus_id=' + encodeURIComponent(params.get('campus_id')) : '')}>Compare {selections.length} {selections.length === 1 ? 'listing' : 'listings'}</Link><button className="comparison-clear" aria-label="Clear selection" title="Clear selection" onClick={clear}><span aria-hidden="true">×</span></button></div>
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
    <Link className="property-cover-link" aria-label={'Open listing: ' + property.title} to={destination} state={{ browse: '/listings?' + params.toString() }}><div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} loading="lazy" /> : <span aria-hidden="true">⌂</span>}{property.is_demo && <span className="status-badge">Synthetic demo</span>}</div></Link>
    <div className="listing-card-body">
      <div className="listing-card-heading"><h2><Link to={destination} state={{ browse: '/listings?' + params.toString() }}>{property.title}</Link></h2>
      <p className="card-location" title={campus ? distanceLabel(property.distance_from_campus, campus) : undefined}>{property.city}{shortDistance && <> · {shortDistance}</>}</p>
      </div><div className="listing-card-options">{option && <>
        {property.room_options.length > 1 ? <div className="card-room-picker"><label className="form-label" htmlFor={'option-' + property.id}>Room option<span className="visually-hidden"> for {property.title}</span></label><select className="form-select" id={'option-' + property.id} value={option.id} onChange={event => { setChoice(event.target.value); onOptionChange?.(property.id, Number(event.target.value)); if (checked) choose(property.id, event.target.value) }}>{property.room_options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div> : <p className="small text-secondary">{option.name}</p>}
        <div className="card-price-line"><p className="room-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p></div>
        {option.monthly_fixed_total_centavos !== option.monthly_rent_centavos && <p className="card-monthly-total" aria-label={'Known monthly charges: ' + pesos(option.monthly_fixed_total_centavos)}>{pesos(option.monthly_fixed_total_centavos)} incl. fixed monthly fees</p>}
        <p className="card-room-meta"><span>{option.capacity}-person room</span><span className={option.available_units === 0 || option.availability_stale ? 'room-caution' : ''}>{option.available_units} {option.inventory_type === 'bedspace' ? (option.available_units === 1 ? 'bed' : 'beds') : (option.available_units === 1 ? 'room' : 'rooms')} available{option.availability_stale ? ' · Needs confirmation' : ''}</span></p>
      </>}
      {match && <p className="card-match">{match}</p>}
      <div className="card-actions">{(!user || user.role === 'student') && option && <label><input type="checkbox" checked={checked} disabled={!checked && selections.length >= 3} onChange={event => choose(property.id, option.id, event.target.checked)} /><span>Compare<span className="visually-hidden"> {property.title}</span></span></label>}{onSelect && <button className="btn btn-link btn-sm" onClick={() => onSelect(property.id)}>Show on map</button>}<FavoriteButton compact propertyId={property.id} optionId={option?.id} title={property.title} /></div>
    </div></div>
  </article>
}

export function ListingMap({ properties, campus }) {
  const [shown, setShown] = useState(false)
  const pinned = properties.filter(property => property.latitude != null && property.longitude != null)
  if (!campus) return <section className="panel mb-4"><h2>Location</h2><button className="btn btn-outline-primary mb-3" onClick={() => setShown(value => !value)}>{shown ? 'Hide map' : 'Show map'}</button>{shown && <CampusMap properties={pinned} />}</section>
  return <section className="panel mb-4"><h2>Location and campus</h2><p className="small">Campus pins are approximate references; demo locations are fictional. Search distances are straight lines. {properties.length === 1 ? 'Open the map to estimate a walking route for this listing.' : 'Open a listing to estimate its walking route.'}</p><p className="small">{campus.name} · {campus.address} · <a href={campus.source_url} target="_blank" rel="noreferrer">Campus reference source</a></p>
    <button className="btn btn-outline-primary mb-3" onClick={() => setShown(value => !value)}>{shown ? 'Hide map' : 'Show map'}</button>{shown && <LoadedMap properties={pinned} campus={campus} />}
    {properties.length !== pinned.length && <p className="small">{properties.length - pinned.length} listing(s) have no location pin and are not shown on the map.</p>}
    <p className="small mb-0"><a href={`https://www.openstreetmap.org/?mlat=${campus.latitude}&mlon=${campus.longitude}#map=16/${campus.latitude}/${campus.longitude}`} target="_blank" rel="noreferrer">Open campus in OpenStreetMap</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
  </section>
}

function LoadedMap({ properties, campus }) {
  const element = useRef(null)
  const [error, setError] = useState(false)
  const [engine, setEngine] = useState(null)
  const property = properties.length === 1 ? properties[0] : null
  const latitude = property?.latitude
  const longitude = property?.longitude
  const campusLatitude = campus.latitude
  const campusLongitude = campus.longitude
  const walking = useWalkingRoute(property, campus)
  const markerData = JSON.stringify(properties.map(({ id, title, latitude, longitude }) => ({ id, title, latitude, longitude })))
  useEffect(() => {
    let cancelled = false
    let map
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      map = L.map(element.current, { scrollWheelZoom: false }).setView([campus.latitude, campus.longitude], 15)
      const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
      tiles.on('tileerror', () => { if (!cancelled) setError(true) }).addTo(map)
      const campusLabel = document.createElement('span'); campusLabel.textContent = campus.name + ' — approximate center'
      L.marker([campus.latitude, campus.longitude], { title: campus.name + ' — selected campus', icon: campusIcon(L), zIndexOffset: 2000 }).addTo(map).bindPopup(campusLabel)
      const pins = JSON.parse(markerData)
      const layer = L.layerGroup().addTo(map)
      function draw() {
        layer.clearLayers()
        const points = pins.map(property => ({ ...map.project([property.latitude, property.longitude], map.getZoom()), width: 30, height: 30 }))
        const offsets = mapLabelLayout(points, map.project([campus.latitude, campus.longitude], map.getZoom()))
        for (const [index, property] of pins.entries()) {
          const [dx, dy] = offsets[index], origin = [property.latitude, property.longitude]
          if (dx || dy) L.polyline([origin, map.unproject([points[index].x + dx, points[index].y + dy], map.getZoom())], { color: '#52627a', weight: 1.5, interactive: false, className: 'map-label-leader' }).addTo(layer)
          const label = document.createElement('a'); label.textContent = property.title; label.href = '/listings/' + property.id + '?campus_id=' + campus.id
          L.marker(origin, { title: property.title, icon: L.divIcon({ className: 'listing-marker', html: '<span>⌂</span>', iconSize: [30, 30], iconAnchor: [15 - dx, 15 - dy] }) }).addTo(layer).bindPopup(label)
        }
      }
      map.fitBounds([[campus.latitude, campus.longitude], ...pins.map(property => [property.latitude, property.longitude])], { padding: [30, 30], maxZoom: 16 })
      draw(); map.on('zoomend', draw)
      setEngine({ L, map })
    }
    load().catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; map?.remove() }
  }, [markerData, campus])
  useEffect(() => {
    if (!engine || !walking.route || latitude == null || longitude == null) return
    return drawWalkingRoute(engine.L, engine.map, walking.route, { latitude, longitude }, { latitude: campusLatitude, longitude: campusLongitude })
  }, [engine, walking.route, latitude, longitude, campusLatitude, campusLongitude])
  return <>{error && <p role="status" className="small">Map imagery is unavailable. Use the address or the OpenStreetMap link below.</p>}<div className="listing-map mb-3" ref={element} role="region" aria-label="Listing map" /><WalkingRouteControl walking={walking} property={property} campus={campus} /></>
}
