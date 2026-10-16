import { useEffect, useRef, useState } from 'react'
import { preferredOption } from '../lib/housing'
import { pesos } from '../lib/money'
import { mapClusters } from '../lib/mapClusters'
import { campusIcon } from '../lib/mapMarkers'
import { mapLabelLayout } from '../lib/mapLabelLayout'
import { useWalkingRoute, drawWalkingRoute } from '../lib/walking'
import WalkingRouteControl from './WalkingRouteControl'
import 'leaflet/dist/leaflet.css'

export default function CampusMap({ properties, campus, selectedId, onSelect, onAreaSearch, radius, bounds, viewport, onViewportChange, children }) {
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
  const selectedProperty = properties.find(property => property.id === selectedId)
  const selectedLatitude = selectedProperty?.latitude
  const selectedLongitude = selectedProperty?.longitude
  const walking = useWalkingRoute(selectedProperty, campus)
  const initialBounds = useRef({ bounds, viewport, campusId:campus?.id })
  const previousSelection = useRef(viewport?.campusId === campusId ? selectedId : null)
  useEffect(() => { callbacks.current = { onSelect, onAreaSearch, onViewportChange } }, [onSelect, onAreaSearch, onViewportChange])
  useEffect(() => {
    if (latitude == null || longitude == null) return
    let cancelled = false
    let map
    let observer
    async function load() {
      const L = await import('leaflet')
      if (cancelled) return
      map = L.map(element.current, { scrollWheelZoom: false }).setView([latitude, longitude], 15)
      const remembered = initialBounds.current.viewport
      const restore = remembered?.campusId === campusId
      if (restore) map.setView(remembered.center, remembered.zoom)
      else if (initialBounds.current.bounds && initialBounds.current.campusId === campusId) map.fitBounds(initialBounds.current.bounds)
      setMoved(restore && remembered.needsSearch)
      setFailed(false)
      const tile = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
      tile.on('tileerror', () => { if (!cancelled) setFailed(true) }).addTo(map)
      const label = document.createElement('span'); label.textContent = campusName + ' — approximate campus reference'
      L.marker([latitude, longitude], { icon: campusIcon(L), title: campusName + ' — selected campus', zIndexOffset: 2000 }).addTo(map).bindPopup(label)
      map.on('moveend', () => {
        if (cancelled) return
        setMoved(true)
        const center = map.getCenter()
        callbacks.current.onViewportChange?.({ center: [center.lat, center.lng], zoom: map.getZoom(), campusId, needsSearch: true })
      })
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
      const groups = mapClusters(JSON.parse(pins), property => map.project([property.latitude, property.longitude], map.getZoom()))
      const positions = groups.map(group => {
        const center = [group.reduce((sum, p) => sum + p.latitude, 0) / group.length, group.reduce((sum, p) => sum + p.longitude, 0) / group.length]
        return { center, ...map.project(center, map.getZoom()), width: group.some(p => p.id === selectedId) && group.length > 1 ? 120 : group.length > 1 ? 84 : 104, height: 42 }
      })
      const offsets = mapLabelLayout(positions, map.project([latitude, longitude], map.getZoom()))
      for (const [index, group] of groups.entries()) {
        const [dx, dy] = offsets[index]
        const position = positions[index]
        if (dx || dy) {
          L.polyline([position.center, map.unproject([position.x + dx, position.y + dy], map.getZoom())], { color: '#52627a', weight: 1.5, interactive: false, className: 'map-label-leader' }).addTo(layer)
          L.circleMarker(position.center, { radius: 3, color: '#2558e5', fillOpacity: 1, interactive: false }).addTo(layer)
        }
        if (group.length > 1) {
          const lat = group.reduce((sum, p) => sum + p.latitude, 0) / group.length
          const lon = group.reduce((sum, p) => sum + p.longitude, 0) / group.length
          const selected = group.find(p => p.id === selectedId)
          const option = selected && (selected.room_options.find(o => o.id === selected.selected_room_option_id) || preferredOption(selected.room_options))
          const price = option ? pesos(option.monthly_rent_centavos) : null
          const basis = option?.price_basis === 'per_person' ? '/person' : '/room'
          const marker = L.marker([lat, lon], { title: (selected ? selected.title + ' — ' + price + basis + ' · ' : '') + group.length + ' listings — zoom to explore', icon: L.divIcon({ className: selected ? 'price-marker is-selected selected-price-cluster' : 'price-cluster', html: selected && price ? '<span>' + price + '<small>' + basis + ' · ' + group.length + ' places</small></span>' : '<span>' + group.length + ' places</span>', iconSize: selected ? [120, 42] : [84, 34], iconAnchor: selected ? [60 - dx, 21 - dy] : [42 - dx, 17 - dy] }) }).addTo(layer)
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
          L.marker([p.latitude, p.longitude], { title: p.title + ' — ' + text + basis, icon: L.divIcon({ className: 'price-marker' + (p.id === selectedId ? ' is-selected' : ''), html: '<span>' + text + '<small>' + basis + '</small></span>', iconSize: [104, 38], iconAnchor: [52 - dx, 19 - dy] }) }).addTo(layer).on('click', () => callbacks.current.onSelect?.(p.id))
        }
      }
    }
    const selected = JSON.parse(pins).find(p => p.id === selectedId)
    if (selectedId !== previousSelection.current && selected && !map.getBounds().contains([selected.latitude, selected.longitude])) map.panTo([selected.latitude, selected.longitude])
    previousSelection.current = selectedId
    draw(); map.on('zoomend', draw)
    return () => { map.off('zoomend', draw); layer.remove() }
  }, [engine, pins, selectedId, campusId, latitude, longitude])
  useEffect(() => {
    if (!engine || engine.campusId !== campusId || !walking.route || selectedLatitude == null || selectedLongitude == null) return
    return drawWalkingRoute(engine.L, engine.map, walking.route, { latitude: selectedLatitude, longitude: selectedLongitude }, { latitude, longitude }, true)
  }, [engine, campusId, walking.route, selectedLatitude, selectedLongitude, latitude, longitude])
  useEffect(() => {
    if (!engine || engine.campusId !== campusId || !radius) return
    const color = getComputedStyle(element.current).getPropertyValue('--accent').trim() || '#2558e5'
    const circle = engine.L.circle([latitude, longitude], { radius: Number(radius) * 1000, color, fillOpacity: 0.04, weight: 1 }).addTo(engine.map)
    return () => circle.remove()
  }, [engine, radius, latitude, longitude, campusId])
  function searchArea() {
    const area = engine.map.getBounds()
    const center = engine.map.getCenter()
    callbacks.current.onViewportChange?.({ center: [center.lat, center.lng], zoom: engine.map.getZoom(), campusId, needsSearch: false })
    callbacks.current.onAreaSearch?.({ south: area.getSouth(), north: area.getNorth(), west: area.getWest(), east: area.getEast() })
    setMoved(false)
  }
  return <section className={'map-workspace' + (walking.route ? ' has-walking-route' : '')} aria-label="Campus housing map">
    <div className="map-canvas">
    <div className="map-tools">
      {onAreaSearch && moved && engine && <button className="btn btn-primary btn-sm" onClick={searchArea}>Search this area</button>}
      {engine && <button className="btn btn-light btn-sm" onClick={() => engine.map.setView([latitude, longitude], 15)}>Back to campus</button>}
    </div>
    {failed && <p role="status" className="map-failure">Map imagery is unavailable. Listing addresses and search remain usable.</p>}
    <div className="campus-map" ref={element} role="region" aria-label="Listing map" />
    {children}
    </div>
    <WalkingRouteControl walking={walking} property={selectedProperty} campus={campus} />
    <p className="small map-note">{properties.some(property => property.is_demo) ? 'Demo pins are fictional; other pins are owner-supplied.' : 'Owner-supplied property pins.'} Campus is an approximate reference. Distances are straight lines. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
  </section>
}
