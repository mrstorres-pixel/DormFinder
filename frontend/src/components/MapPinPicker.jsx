import { useEffect, useRef, useState } from 'react'
import { hasLocationPin } from '../lib/listingReadiness'
import AddressSearch from './AddressSearch'
import 'leaflet/dist/leaflet.css'

export default function MapPinPicker({ latitude, longitude, onChange }) {
  const [version, setVersion] = useState(0)
  return <section className="mb-3 owner-pin-picker"><PinCanvas key={version} latitude={latitude} longitude={longitude} onChange={onChange} onRetry={() => setVersion(current => current + 1)} /></section>
}

function PinCanvas({ latitude, longitude, onChange, onRetry }) {
  const element = useRef(null)
  const initial = useRef({ latitude, longitude })
  const callback = useRef(onChange)
  const [error, setError] = useState(false)
  const [engine, setEngine] = useState(null)
  const [selected, setSelected] = useState('')
  useEffect(() => { callback.current = onChange }, [onChange])
  useEffect(() => {
    let cancelled = false
    let map
    let observer
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      const value = initial.current
      const located = hasLocationPin(value)
      const position = located ? [Number(value.latitude), Number(value.longitude)] : [14.61, 121.02]
      map = L.map(element.current, { scrollWheelZoom: false }).setView(position, located ? 16 : 11)
      L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom:19 }).on('tileerror', () => { if (!cancelled) setError(true) }).addTo(map)
      let marker
      const icon = L.divIcon({ className: 'owner-property-pin', html: '<svg viewBox="0 0 38 46" width="38" height="46" aria-hidden="true"><path fill="#2558e5" stroke="white" stroke-width="2" d="M19 44S2 28 2 19a17 17 0 0 1 34 0c0 9-17 25-17 25Z"/><circle cx="19" cy="18" r="6" fill="white"/></svg>', iconSize: [38, 46], iconAnchor: [19, 44] })
      function update(point, notify = true) {
        if (!marker) { marker = L.marker(point, { icon, draggable:true, title: 'Property location — drag to adjust' }).addTo(map); marker.on('dragend', () => update(marker.getLatLng())) }
        else marker.setLatLng(point)
        if (notify) callback.current({ latitude:Number(point.lat).toFixed(6), longitude:Number(point.lng).toFixed(6) })
      }
      if (located) update({ lat: position[0], lng: position[1] }, false)
      map.on('click', event => update(event.latlng))
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
      observer.observe(element.current)
      setEngine({ map, update, clear: () => { marker?.remove(); marker = null } })
    }
    load().catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; observer?.disconnect(); map?.remove() }
  }, [])
  useEffect(() => {
    if (!engine) return
    if (hasLocationPin({ latitude, longitude })) {
      const point = { lat: Number(latitude), lng: Number(longitude) }
      engine.update(point, false)
      if (!engine.map.getBounds().contains(point)) engine.map.panTo(point)
    } else engine.clear()
  }, [engine, latitude, longitude])
  function choose(place) {
    if (!engine) return
    engine.map.setView([place.latitude, place.longitude], 17)
    engine.update({ lat: place.latitude, lng: place.longitude })
    setSelected(place.label)
  }
  return <><AddressSearch onSelect={choose} disabled={!engine} /><p className="small mt-2">Click the property location, then drag the pin to its entrance. Search results are approximate; check the pin before saving.</p>{error && <div role="status" className="alert alert-warning">Map imagery could not load. You can enter coordinates below.<button type="button" className="btn btn-outline-primary btn-sm ms-2" onClick={onRetry}>Reload map</button></div>}<div ref={element} className="pin-picker" role="region" aria-label="Property location picker" /><p className="pin-status" role="status">{hasLocationPin({ latitude, longitude }) ? 'Location pin placed. Check that it matches the street address.' : 'No property pin yet. Search for an address or click the map to place it.'}{selected && <span className="owner-selected-address">Search result: {selected}</span>}</p></>
}
