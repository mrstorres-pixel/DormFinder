import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useFavorites, distanceLabel } from '../lib/discovery'
import { useComparison, comparisonItems } from '../lib/comparison'
import { pesos, toCentavos } from '../lib/money'
import { ErrorNotice } from './Feedback'
import 'leaflet/dist/leaflet.css'

export function FavoriteButton({ propertyId, title = 'listing' }) {
  const { data: user } = useCurrentUser()
  const favorites = useFavorites()
  const client = useQueryClient()
  const saved = favorites.data?.includes(propertyId) || false
  const mutation = useMutation({ mutationFn: () => writeApi(saved ? 'delete' : 'put', '/favorites/' + propertyId), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['favorite-ids'] }); await client.invalidateQueries({ queryKey: ['favorites'] }) } })
  if (user?.role !== 'student') return null
  return <div className="mt-3"><ErrorNotice error={favorites.error || mutation.error} /><button className="btn btn-outline-primary btn-sm" aria-label={(saved ? 'Remove favorite ' : 'Save favorite ') + title} aria-pressed={saved} disabled={favorites.isPending || !!favorites.error || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : saved ? '♥ Saved' : '♡ Save favorite'}</button></div>
}

export function ComparisonTray() {
  const [params] = useSearchParams()
  const { data: user } = useCurrentUser()
  const { selections, clear } = useComparison()
  if (user?.role !== 'student' || !selections.length) return null
  return <div className="comparison-tray" role="region" aria-label="Your comparison selection"><span>{selections.length} of 3 selected</span><Link className="btn btn-primary" to={'/compare?items=' + comparisonItems(selections) + (params.get('campus_id') ? '&campus_id=' + encodeURIComponent(params.get('campus_id')) : '')}>Compare {selections.length} {selections.length === 1 ? 'listing' : 'listings'}</Link><button className="btn btn-link" onClick={clear}>Clear selection</button></div>
}

export function SearchFilters({ params, onSearch, campuses = [] }) {
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const next = {}
    for (const key of ['q', 'property_type', 'price_basis', 'sort', 'campus_id', 'available_only']) if (values[key]) next[key] = values[key]
    for (const name of ['min', 'max']) {
      if (values[name + '_rent']?.trim()) {
        let amount
        try { amount = toCentavos(values[name + '_rent']) } catch { setError('Enter rent as a nonnegative PHP amount with at most two decimal places.'); return }
        next[name + '_rent_centavos'] = String(amount)
      }
    }
    if ((next.min_rent_centavos || next.max_rent_centavos || next.sort?.startsWith('rent_')) && !next.price_basis) { setError('Choose a price basis before filtering or sorting rent.'); return }
    if (next.min_rent_centavos && next.max_rent_centavos && Number(next.min_rent_centavos) > Number(next.max_rent_centavos)) { setError('Maximum rent must be at least the minimum rent.'); return }
    setError('')
    onSearch(next)
  }
  return <form className="panel search-filters" key={params.toString()} onSubmit={submit}>
    <div className="filter-grid">
      <label>Search property or city<input className="form-control" name="q" defaultValue={params.get('q') || ''} placeholder="Property, address or city" maxLength={100} /></label>
      <label>Property type<select aria-label="Property type" className="form-select" name="property_type" defaultValue={params.get('property_type') || ''}><option value="">All property types</option>{['dormitory', 'apartment', 'boarding_house', 'rental_room'].map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Price basis<select aria-label="Price basis" className="form-select" name="price_basis" defaultValue={params.get('price_basis') || ''}><option value="">All price bases</option><option value="per_person">Per person</option><option value="per_room">Per room</option></select></label>
      <label>Minimum monthly rent (PHP)<input className="form-control" name="min_rent" inputMode="decimal" defaultValue={params.has('min_rent_centavos') ? (Number(params.get('min_rent_centavos')) / 100).toFixed(2) : ''} /></label>
      <label>Maximum monthly rent (PHP)<input className="form-control" name="max_rent" inputMode="decimal" defaultValue={params.has('max_rent_centavos') ? (Number(params.get('max_rent_centavos')) / 100).toFixed(2) : ''} /></label>
      <label>Sort listings<select aria-label="Sort listings" className="form-select" name="sort" defaultValue={params.get('sort') || 'newest'}><option value="newest">Recently approved</option><option value="rent_asc">Monthly rent: low to high</option><option value="rent_desc">Monthly rent: high to low</option><option value="distance">Nearest campus first</option></select></label>
      <label>Campus reference<select aria-label="Campus reference" className="form-select" name="campus_id" defaultValue={params.get('campus_id') || ''}><option value="">TIP Manila — P. Casal</option>{campuses.filter(campus => campus.slug !== 'tip-manila-casal').map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
    </div>
    <label className="d-flex gap-2 my-3"><input name="available_only" type="checkbox" value="1" defaultChecked={params.get('available_only') === '1'} />Available units confirmed within 14 days</label>
    <p className="small text-secondary">Rent filters use monthly base rent. Fixed fees and variable utilities are shown separately. Price and availability must match the same room option; only matching options appear in results.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <div className="d-flex gap-3 flex-wrap"><button className="btn btn-primary">Search</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setError(''); onSearch({}) }}>Reset filters</button></div>
  </form>
}

export function ListingCard({ property, campus }) {
  const { data: user } = useCurrentUser()
  const { selections, choose } = useComparison()
  const [choice, setChoice] = useState('')
  const selected = selections.find(item => item.property_id === property.id)
  const option = property.room_options.find(item => item.id === Number(choice || selected?.room_option_id)) || property.room_options[0]
  const checked = !!selected
  return <article className="property-card h-100"><div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} loading="lazy" /> : <span aria-hidden="true">⌂</span>}{property.is_demo && <span className="status-badge">Synthetic demo</span>}</div><div className="p-4"><p className="small text-secondary text-uppercase">{property.property_type.replaceAll('_', ' ')}</p><h2><Link to={'/listings/' + property.id + (campus ? '?campus_id=' + campus.id : '')}>{property.title}</Link></h2><p>{property.address}, {property.city}</p><p className="small text-secondary">{distanceLabel(property.distance_from_campus, campus)}</p>
    {option && <><label className="form-label" htmlFor={'option-' + property.id}>Room option for {property.title}</label><select className="form-select mb-3" id={'option-' + property.id} value={option.id} onChange={event => { setChoice(event.target.value); if (checked) choose(property.id, event.target.value) }}>{property.room_options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="room-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><p className="small">Known monthly charges: {pesos(option.monthly_fixed_total_centavos)}</p><p className="small">{option.available_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'} available{option.availability_stale ? ' · Needs confirmation' : ''}</p></>}
    {user?.role === 'student' && option && <label className="d-flex gap-2"><input type="checkbox" checked={checked} disabled={!checked && selections.length >= 3} onChange={event => choose(property.id, option.id, event.target.checked)} /><span>Compare {property.title}</span></label>}<FavoriteButton propertyId={property.id} title={property.title} />
  </div></article>
}

export function PhotoGallery({ photos, refresh }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState('')
  const current = photos[Math.min(index, photos.length - 1)]
  if (!current) return <p>No listing photos available.</p>
  function move(delta) { setIndex(value => (value + delta + photos.length) % photos.length) }
  return <section className="photo-gallery mb-4" aria-label="Property photo gallery" tabIndex={0} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1) } }}>
    <figure><img src={current.url} alt={current.caption} onError={() => setFailed(current.url)} /><figcaption>{current.caption}</figcaption></figure>
    {failed === current.url && <p role="alert">This photo could not load. <button className="btn btn-link" onClick={refresh}>Refresh photo links</button></p>}
    <div className="gallery-controls"><button className="btn btn-outline-primary btn-sm" disabled={photos.length < 2} onClick={() => move(-1)}>Previous photo</button><span aria-live="polite">Photo {Math.min(index + 1, photos.length)} of {photos.length}</span><button className="btn btn-outline-primary btn-sm" disabled={photos.length < 2} onClick={() => move(1)}>Next photo</button></div>
    <div className="gallery-thumbnails">{photos.map((photo, photoIndex) => <button key={photo.id} aria-label={'Show photo ' + (photoIndex + 1) + ': ' + photo.caption} aria-pressed={photoIndex === Math.min(index, photos.length - 1)} onClick={() => setIndex(photoIndex)}><img src={photo.url} alt="" loading="lazy" /></button>)}</div>
  </section>
}

export function ListingMap({ properties, campus }) {
  const [shown, setShown] = useState(false)
  const pinned = properties.filter(property => property.latitude != null && property.longitude != null)
  if (!campus) return <p className="small text-secondary">Campus reference is unavailable. Listing addresses remain visible.</p>
  return <section className="panel mb-4"><h2>Location and campus</h2><p className="small">Pins are supplied by property owners. Distances use the approximate campus center and are not walking distances. Confirm the address and route with the owner.</p><p className="small">{campus.name} · {campus.address} · <a href={campus.source_url} target="_blank" rel="noreferrer">Campus reference source</a></p>
    <button className="btn btn-outline-primary mb-3" onClick={() => setShown(value => !value)}>{shown ? 'Hide map' : 'Show map'}</button>{shown && <LoadedMap properties={pinned} campus={campus} />}
    {properties.length !== pinned.length && <p className="small">{properties.length - pinned.length} listing(s) have no location pin and are not shown on the map.</p>}
    <p className="small mb-0">The browse map shows results on the current page. <a href={`https://www.openstreetmap.org/?mlat=${campus.latitude}&mlon=${campus.longitude}#map=16/${campus.latitude}/${campus.longitude}`} target="_blank" rel="noreferrer">Open campus in OpenStreetMap</a></p>
  </section>
}

function LoadedMap({ properties, campus }) {
  const element = useRef(null)
  const [error, setError] = useState(false)
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
      L.marker([campus.latitude, campus.longitude], { title: campus.name, icon: L.divIcon({ className: 'campus-marker', html: '<span>C</span>', iconSize: [30, 30] }) }).addTo(map).bindPopup(campusLabel)
      const pins = JSON.parse(markerData)
      for (const property of pins) {
        const label = document.createElement('a'); label.textContent = property.title; label.href = '/listings/' + property.id
        L.marker([property.latitude, property.longitude], { title: property.title, icon: L.divIcon({ className: 'listing-marker', html: '<span>⌂</span>', iconSize: [30, 30] }) }).addTo(map).bindPopup(label)
      }
      map.fitBounds([[campus.latitude, campus.longitude], ...pins.map(property => [property.latitude, property.longitude])], { padding: [30, 30], maxZoom: 16 })
    }
    load().catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; map?.remove() }
  }, [markerData, campus])
  return <>{error && <p role="status" className="small">Map imagery is unavailable. Use the address or the OpenStreetMap link below.</p>}<div className="listing-map mb-3" ref={element} role="region" aria-label="Listing map" /></>
}
