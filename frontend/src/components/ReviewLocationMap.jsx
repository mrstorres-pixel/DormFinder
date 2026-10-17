import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export default function ReviewLocationMap({ latitude, longitude }) {
  const [shown, setShown] = useState(false)
  const valid = latitude != null && longitude != null && String(latitude).trim() !== '' && String(longitude).trim() !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180
  if (!valid) return <p className="review-location-missing">No valid location pin provided.</p>
  return <><button type="button" className="btn btn-outline-primary" aria-expanded={shown} onClick={() => setShown(value => !value)}>{shown ? 'Hide location map' : 'Show location map'}</button>{shown && <ReadOnlyPin latitude={Number(latitude)} longitude={Number(longitude)} />}<details className="review-coordinates"><summary>Coordinates</summary><p>{latitude}, {longitude}</p></details></>
}

function ReadOnlyPin({ latitude, longitude }) {
  const element = useRef(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false, map, observer
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      map = L.map(element.current, { scrollWheelZoom: false }).setView([latitude, longitude], 17)
      L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => { if (!cancelled) setFailed(true) }).addTo(map)
      const label = document.createElement('span'); label.textContent = 'Owner-supplied property pin'
      L.circleMarker([latitude, longitude], { radius: 10, color: '#fff', weight: 3, fillColor: '#2558e5', fillOpacity: 1 }).addTo(map).bindTooltip(label, { permanent: true, direction: 'top' })
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
      observer.observe(element.current)
    }
    load().catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; observer?.disconnect(); map?.remove() }
  }, [latitude, longitude])
  return <>{failed && <p role="status" className="review-map-error">Map imagery could not load. Use the address and coordinates to review the location.</p>}<div ref={element} className="review-location-map" role="region" aria-label="Owner-supplied property location" /></>
}
