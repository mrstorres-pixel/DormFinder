import { useEffect, useRef, useState } from 'react'
import { hasLocationPin } from '../lib/listingReadiness'
import { useCampuses } from '../lib/discovery'
import CampusSearch from './CampusSearch'
import { ErrorNotice } from './Feedback'
import 'leaflet/dist/leaflet.css'

export default function MapPinPicker({ latitude, longitude, onChange }) {
  const [shown, setShown] = useState(false)
  return <section className="mb-3 owner-pin-picker"><button type="button" className="btn btn-outline-primary" aria-expanded={shown} onClick={() => setShown(value => !value)}>{shown ? 'Hide pin picker' : 'Choose location on map'}</button>{shown && <PinCanvas latitude={latitude} longitude={longitude} onChange={onChange} />}</section>
}

function PinCanvas({ latitude, longitude, onChange }) {
  const element = useRef(null)
  const initial = useRef({ latitude, longitude })
  const callback = useRef(onChange)
  const [error, setError] = useState(false)
  const [engine, setEngine] = useState(null)
  const [nearby, setNearby] = useState('')
  const campuses = useCampuses()
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
  function jump(id) {
    setNearby(id)
    const campus = campuses.data?.find(item => String(item.id) === id)
    if (campus && engine) engine.map.setView([campus.latitude, campus.longitude], 16)
  }
  return <><div className="owner-pin-search"><CampusSearch campuses={campuses.data || []} value={nearby} onChange={jump} label="Find a nearby campus or city" helper="This moves the map only. Click your property's exact location to place its pin." requireQuery disabled={campuses.isPending || !!campuses.error} /><ErrorNotice error={campuses.error} retry={() => campuses.refetch()} /></div><p className="small mt-2">Click the property location, then drag the pin to adjust it. The coordinates below update automatically.</p>{error && <p role="status" className="alert alert-warning">Map imagery could not load. Enter latitude and longitude below, or reopen the pin picker to retry.</p>}<div ref={element} className="pin-picker" role="region" aria-label="Property location picker" /><p className="pin-status" role="status">{hasLocationPin({ latitude, longitude }) ? 'Location pin placed. Check that it matches the street address.' : 'No property pin yet. Click the map to place it.'}</p></>
}
