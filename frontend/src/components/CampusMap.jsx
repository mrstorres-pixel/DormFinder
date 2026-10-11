import { useEffect, useRef, useState } from 'react'
import { preferredOption } from '../lib/housing'
import { pesos } from '../lib/money'
import 'leaflet/dist/leaflet.css'

export default function CampusMap({ properties, campus, selectedId, onSelect, onAreaSearch, radius, bounds }) {
  const element = useRef(null)
  const callbacks = useRef({})
  const [engine, setEngine] = useState(null)
  const [failed, setFailed] = useState(false)
  const [moved, setMoved] = useState(false)
  const pins = JSON.stringify(properties.filter(p => p.latitude != null && p.longitude != null))
  const campusId = campus?.id
  const latitude = campus?.latitude
  const longitude = campus?.longitude
  const campusName = campus?.name
  const initialBounds = useRef({ bounds, campusId:campus?.id })
  useEffect(() => { callbacks.current = { onSelect, onAreaSearch } }, [onSelect, onAreaSearch])
  useEffect(() => {
    if (latitude == null || longitude == null) return
    let cancelled = false
    let map
    let observer
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      map = L.map(element.current, { scrollWheelZoom: false }).setView([latitude, longitude], 15)
      if (initialBounds.current.bounds && initialBounds.current.campusId === campusId) map.fitBounds(initialBounds.current.bounds)
      const tile = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
      tile.on('tileerror', () => { if (!cancelled) setFailed(true) }).addTo(map)
      const label = document.createElement('span'); label.textContent = campusName + ' — approximate campus reference'
      L.marker([latitude, longitude], { icon: L.divIcon({ className: 'campus-marker', html: '<span>C</span>', iconSize: [30, 30] }), title: campusName }).addTo(map).bindPopup(label)
      map.on('moveend', () => { if (!cancelled) setMoved(true) })
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
      observer.observe(element.current)
      setEngine({ L, map, campusId })
    }
    load().catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; observer?.disconnect(); map?.remove() }
  }, [campusId, latitude, longitude, campusName])
  useEffect(() => {
    if (!engine || engine.campusId !== campusId) return
    const { L, map } = engine
    const layer = L.layerGroup().addTo(map)
    function draw() {
      layer.clearLayers()
      const groups = new Map()
      for (const property of JSON.parse(pins)) {
        const point = map.project([property.latitude, property.longitude], map.getZoom())
        const key = Math.floor(point.x / 75) + ':' + Math.floor(point.y / 55)
        const group = groups.get(key) || []; group.push(property); groups.set(key, group)
      }
      for (const group of groups.values()) {
        if (group.length > 1) {
          const lat = group.reduce((sum, p) => sum + p.latitude, 0) / group.length
          const lon = group.reduce((sum, p) => sum + p.longitude, 0) / group.length
          const marker = L.marker([lat, lon], { title: group.length + ' listings — zoom to explore', icon: L.divIcon({ className: 'price-cluster' + (group.some(p => p.id === selectedId) ? ' is-selected' : ''), html: '<span>' + group.length + ' places</span>', iconSize: [84, 34] }) }).addTo(layer)
          marker.on('click', () => {
            if (map.getZoom() < 19) map.fitBounds(group.map(p => [p.latitude, p.longitude]), { maxZoom: Math.min(19, map.getZoom() + 2), padding: [30, 30] })
            else {
              const list = document.createElement('div')
              for (const p of group) { const button = document.createElement('button'); button.className = 'btn btn-link d-block'; button.textContent = p.title; button.onclick = () => callbacks.current.onSelect?.(p.id); list.append(button) }
              marker.bindPopup(list).openPopup()
            }
          })
        } else {
          const p = group[0]
          const option = p.room_options.find(o => o.id === p.selected_room_option_id) || preferredOption(p.room_options)
          const text = option ? pesos(option.monthly_rent_centavos) : 'Details'
          const basis = option?.price_basis === 'per_person' ? '/person' : '/room'
          L.marker([p.latitude, p.longitude], { title: p.title + ' — ' + text + basis, icon: L.divIcon({ className: 'price-marker' + (p.id === selectedId ? ' is-selected' : ''), html: '<span>' + text + '<small>' + basis + '</small></span>', iconSize: [104, 38] }) }).addTo(layer).on('click', () => callbacks.current.onSelect?.(p.id))
        }
      }
    }
    const selected = JSON.parse(pins).find(p => p.id === selectedId)
    if (selected && !map.getBounds().contains([selected.latitude, selected.longitude])) map.panTo([selected.latitude, selected.longitude])
    draw(); map.on('zoomend', draw)
    return () => { map.off('zoomend', draw); layer.remove() }
  }, [engine, pins, selectedId, campusId])
  useEffect(() => {
    if (!engine || engine.campusId !== campusId || !radius) return
    const circle = engine.L.circle([latitude, longitude], { radius: Number(radius) * 1000, color: '#9c3d15', fillOpacity: 0.04, weight: 1 }).addTo(engine.map)
    return () => circle.remove()
  }, [engine, radius, latitude, longitude, campusId])
  function searchArea() {
    const area = engine.map.getBounds()
    callbacks.current.onAreaSearch?.({ south: area.getSouth(), north: area.getNorth(), west: area.getWest(), east: area.getEast() })
    setMoved(false)
  }
  return <section className="map-workspace" aria-label="Campus housing map">
    <div className="map-tools">
      {onAreaSearch && moved && engine && <button className="btn btn-primary btn-sm" onClick={searchArea}>Search this area</button>}
      {engine && <button className="btn btn-light btn-sm" onClick={() => engine.map.setView([latitude, longitude], 15)}>Back to campus</button>}
    </div>
    {failed && <p role="status" className="map-failure">Map imagery is unavailable. Listing addresses and search remain usable.</p>}
    <div className="campus-map" ref={element} role="region" aria-label="Listing map" />
    <p className="small map-note">Campus reference and owner-supplied pins · straight-line distances, not walking routes. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
  </section>
}
