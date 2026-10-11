import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export default function MapPinPicker({ latitude, longitude, onChange }) {
  const [shown, setShown] = useState(false)
  return <section className="mb-3"><button type="button" className="btn btn-outline-primary" aria-expanded={shown} onClick={() => setShown(value => !value)}>{shown ? 'Hide pin picker' : 'Choose location on map'}</button>{shown && <PinCanvas latitude={latitude} longitude={longitude} onChange={onChange} />}</section>
}

function PinCanvas({ latitude, longitude, onChange }) {
  const element = useRef(null)
  const initial = useRef({ latitude, longitude })
  const callback = useRef(onChange)
  const [error, setError] = useState(false)
  useEffect(() => { callback.current = onChange }, [onChange])
  useEffect(() => {
    let cancelled = false
    let map
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      const value = initial.current
      const position = value.latitude !== '' && value.longitude !== '' ? [Number(value.latitude), Number(value.longitude)] : [14.5953363,120.9881329]
      map = L.map(element.current, { scrollWheelZoom: false }).setView(position, 16)
      L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom:19 }).on('tileerror', () => { if (!cancelled) setError(true) }).addTo(map)
      let marker
      function update(point) {
        if (!marker) { marker = L.marker(point, { draggable:true }).addTo(map); marker.on('dragend', () => update(marker.getLatLng())) }
        else marker.setLatLng(point)
        callback.current({ latitude:point.lat.toFixed(6), longitude:point.lng.toFixed(6) })
      }
      if (value.latitude !== '' && value.longitude !== '') { marker = L.marker(position, { draggable:true }).addTo(map); marker.on('dragend', () => update(marker.getLatLng())) }
      map.on('click', event => update(event.latlng))
    }
    load().catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; map?.remove() }
  }, [])
  return <><p className="small mt-2">Click your property location or drag the pin. Check the coordinates before saving. You can enter coordinates directly.</p>{error && <p role="status">Map imagery could not load. Enter latitude and longitude below.</p>}<div ref={element} className="pin-picker" role="region" aria-label="Property location picker" /></>
}
