import { useEffect, useId, useRef, useState } from 'react'
import { useCampuses } from '../lib/discovery'
import { campusIcon } from '../lib/mapMarkers'
import { mapLabelLayout } from '../lib/mapLabelLayout'
import { useWalkingRoute, drawWalkingRoute } from '../lib/walking'
import { ErrorNotice } from './Feedback'
import WalkingRouteControl from './WalkingRouteControl'
import CampusSearch from './CampusSearch'
import 'leaflet/dist/leaflet.css'
import './listing-location-map.css'

const hasPin = place => place.latitude != null && place.longitude != null && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))

export default function ListingLocationMap({ properties, campus }) {
  const [shown, setShown] = useState(false)
  const [destination, setDestination] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const campuses = useCampuses()
  const id = useId()
  const context = properties.map(property => property.id).join(',') + ':' + (campus?.id || '')
  const selectedCampus = destination?.context === context ? campuses.data?.find(item => String(item.id) === destination.id) : campus
  const pinned = properties.filter(hasPin)
  const reference = pinned[0]
  return <section className="panel mb-4 listing-location" aria-label="Property location">
    <div className="listing-location-heading"><h2>{selectedCampus ? 'Location and campus' : 'Location'}</h2>{reference && <button type="button" className="btn btn-outline-primary" aria-expanded={shown} aria-controls={id + '-map'} onClick={() => setShown(value => !value)}>{shown ? 'Hide map' : 'Show map'}</button>}</div>
    {!reference ? <p className="small text-secondary">A location pin is not available for this property. Use the listing address or ask the owner for directions.</p> : shown && <div id={id + '-map'}>
      <div className="listing-map-destination"><CampusSearch campuses={campuses.data || []} value={String(selectedCampus?.id || '')} onChange={id => setDestination({ context, id })} label="Walking destination" requireQuery disabled={campuses.isPending || !!campuses.error} helper="Type a university, campus or city, then choose a suggestion for walking directions." />
        {campuses.isPending && <p role="status" className="form-text">Loading campuses…</p>}
        <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
      </div>
      <LocationCanvas key={context + ':' + (selectedCampus?.id || 'none') + ':' + attempt} properties={pinned} campus={selectedCampus} retry={() => setAttempt(value => value + 1)} />
      {properties.length !== pinned.length && <p className="small text-secondary">{properties.length - pinned.length} compared listing(s) have no location pin.</p>}
      <p className="listing-location-note">{properties.some(property => property.is_demo) ? 'Demo locations are fictional. ' : 'Property pins are supplied by the owner. '}{selectedCampus ? 'The campus pin is an approximate reference.' : 'No campus selected.'}</p>
      <p className="listing-location-links"><a href={`https://www.openstreetmap.org/?mlat=${reference.latitude}&mlon=${reference.longitude}#map=16/${reference.latitude}/${reference.longitude}`} target="_blank" rel="noreferrer">Open {pinned.length === 1 ? 'property' : 'area'} in OpenStreetMap</a><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
    </div>}
  </section>
}

function LocationCanvas({ properties, campus, retry }) {
  const element = useRef(null)
  const [error, setError] = useState(false)
  const [engine, setEngine] = useState(null)
  const [moved, setMoved] = useState(false)
  const [routeView, setRouteView] = useState(0)
  const property = properties.length === 1 ? properties[0] : null
  const latitude = property?.latitude
  const longitude = property?.longitude
  const campusId = campus?.id
  const campusLatitude = campus?.latitude
  const campusLongitude = campus?.longitude
  const campusName = campus?.name
  const walking = useWalkingRoute(property, campus)
  const markerData = JSON.stringify(properties.map(({ id, title, latitude, longitude }) => ({ id, title, latitude, longitude })))
  useEffect(() => {
    let cancelled = false
    let map
    let observer
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      const pins = JSON.parse(markerData)
      map = L.map(element.current, { scrollWheelZoom: false })
      const locations = pins.map(pin => [pin.latitude, pin.longitude])
      if (campusId != null) locations.push([campusLatitude, campusLongitude])
      function fitLocations() { map.fitBounds(locations, { paddingTopLeft: [40, 65], paddingBottomRight: [40, 85], maxZoom: 16, animate: false }); setMoved(false) }
      fitLocations()
      const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
      tiles.on('tileerror', () => { if (!cancelled) setError(true) }).addTo(map)
      if (campusId != null) {
        const label = document.createElement('span'); label.textContent = campusName + ' — selected walking destination'
        L.marker([campusLatitude, campusLongitude], { title: campusName + ' — selected campus', icon: campusIcon(L), zIndexOffset: 2000 }).addTo(map).bindPopup(label)
      }
      const layer = L.layerGroup().addTo(map)
      function draw() {
        layer.clearLayers()
        const points = pins.map(pin => ({ ...map.project([pin.latitude, pin.longitude], map.getZoom()), width: 30, height: 30 }))
        const offsets = mapLabelLayout(points, campusId == null ? null : map.project([campusLatitude, campusLongitude], map.getZoom()))
        for (const [index, pin] of pins.entries()) {
          const [dx, dy] = offsets[index], origin = [pin.latitude, pin.longitude]
          if (dx || dy) L.polyline([origin, map.unproject([points[index].x + dx, points[index].y + dy], map.getZoom())], { color: '#52627a', weight: 1.5, interactive: false, className: 'map-label-leader' }).addTo(layer)
          const label = document.createElement('a'); label.textContent = pin.title; label.href = '/listings/' + pin.id + (campusId == null ? '' : '?campus_id=' + campusId)
          L.marker(origin, { title: pin.title, icon: L.divIcon({ className: 'listing-marker', html: '<span>⌂</span>', iconSize: [30, 30], iconAnchor: [15 - dx, 15 - dy] }) }).addTo(layer).bindPopup(label)
        }
      }
      draw(); map.on('zoomend', draw)
      map.on('dragend zoomend', () => setMoved(true))
      observer = new ResizeObserver(() => { map.invalidateSize({ pan: false }); if (!element.current?.querySelector('.walking-route-path')) fitLocations() })
      observer.observe(element.current)
      setEngine({ L, map, fitLocations })
    }
    load().catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; observer?.disconnect(); map?.remove() }
  }, [markerData, campusId, campusLatitude, campusLongitude, campusName])
  useEffect(() => {
    if (!engine || !walking.route || latitude == null || longitude == null) return
    return drawWalkingRoute(engine.L, engine.map, walking.route, { latitude, longitude }, { latitude: campusLatitude, longitude: campusLongitude })
  }, [engine, walking.route, latitude, longitude, campusLatitude, campusLongitude, routeView])
  return <>
    <div className="listing-location-canvas"><div className="listing-map" ref={element} role="region" aria-label="Listing map" aria-busy={!engine && !error} />
      {!engine && !error && <p role="status" className="listing-map-loading">Loading map…</p>}
      {engine && moved && <button type="button" className="btn btn-light btn-sm listing-map-reset" onClick={() => walking.route ? setRouteView(value => value + 1) : engine.fitLocations()}>{walking.route ? 'Recenter route' : campus ? 'Show both locations' : property ? 'Back to property' : 'Fit compared places'}</button>}
    </div>
    {error && <div role="status" className="listing-map-error"><p>Map imagery is unavailable. You can still use the address and the OpenStreetMap link below.</p><button type="button" className="btn btn-outline-primary btn-sm" onClick={retry}>Retry map</button></div>}
    <WalkingRouteControl walking={walking} property={property} campus={campus} />
    {campus && !property && <p className="small text-secondary">Open a listing to calculate its walking route to {campus.name}.</p>}
  </>
}
