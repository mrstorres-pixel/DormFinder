import { useEffect, useRef, useState } from 'react'
import { hasLocationPin } from '../lib/listingReadiness'
import AddressSearch from './AddressSearch'
import { lookupAddress } from '../lib/geocoding'
import 'leaflet/dist/leaflet.css'
import './landlord-workspace.css'

export default function MapPinPicker({ latitude, longitude, onChange, onAddressSelected, addressLabel = '', resetToken = 0, onLookupStateChange }) {
  const [version, setVersion] = useState(0)
  return <section className="mb-3 owner-pin-picker"><PinCanvas key={version + ':' + resetToken} latitude={latitude} longitude={longitude} onChange={onChange} onAddressSelected={onAddressSelected} addressLabel={addressLabel} onLookupStateChange={onLookupStateChange} onRetry={() => setVersion(current => current + 1)} /></section>
}

function PinCanvas({ latitude, longitude, onChange, onAddressSelected, addressLabel, onLookupStateChange, onRetry }) {
  const element = useRef(null)
  const initial = useRef({ latitude, longitude })
  const callback = useRef(onChange)
  const addressCallback = useRef(onAddressSelected)
  const lookupCallback = useRef(onLookupStateChange)
  const moveCallback = useRef(null)
  const reverse = useRef({ controller: null, timer: null, version: 0 })
  const lastEmitted = useRef(null)
  const externalChange = useRef(null)
  const [error, setError] = useState(false)
  const [engine, setEngine] = useState(null)
  const [query, setQuery] = useState(addressLabel)
  const [lookupVersion, setLookupVersion] = useState(0)
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  useEffect(() => { callback.current = onChange }, [onChange])
  useEffect(() => { addressCallback.current = onAddressSelected; lookupCallback.current = onLookupStateChange })
  function cancelReverse() { clearTimeout(reverse.current.timer); reverse.current.controller?.abort(); reverse.current.version++; setLocating(false); lookupCallback.current?.(false) }
  function moved(point) {
    cancelReverse()
    setQuery(''); setLookupVersion(current => current + 1); setLocationMessage(''); setLocating(true); lookupCallback.current?.(true)
    const controller = new AbortController(), version = reverse.current.version
    reverse.current.controller = controller
    reverse.current.timer = setTimeout(async () => {
      try {
        const response = await lookupAddress('/landlord/address-reverse', { latitude: Number(point.lat).toFixed(6), longitude: Number(point.lng).toFixed(6) }, controller.signal)
        if (controller.signal.aborted || reverse.current.version !== version) return
        const place = response.data.data[0]
        if (place) { setQuery(place.label); addressCallback.current?.(place); setLocationMessage('Nearest mapped address. Check the street address and building number below; your entrance pin stays where you placed it.') }
        else setLocationMessage('No mapped address found at this pin. Your pin is kept. Enter the street address and city below.')
      } catch {
        if (!controller.signal.aborted && reverse.current.version === version) setLocationMessage('The address lookup could not load. Your pin is kept. Check or enter the street address and city below.')
      } finally {
        if (!controller.signal.aborted && reverse.current.version === version) { setLocating(false); lookupCallback.current?.(false) }
      }
    }, 450)
  }
  useEffect(() => { moveCallback.current = moved })
  useEffect(() => { externalChange.current = () => { cancelReverse(); setQuery(''); setLookupVersion(current => current + 1); setLocationMessage('Coordinates changed. Check the street address and city before saving.') } })
  useEffect(() => () => { clearTimeout(reverse.current.timer); reverse.current.controller?.abort(); lookupCallback.current?.(false) }, [])
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
      function update(point, notify = true, lookup = true) {
        if (!marker) { marker = L.marker(point, { icon, draggable:true, title: 'Property location — drag to adjust' }).addTo(map); marker.on('dragend', () => update(marker.getLatLng())) }
        else marker.setLatLng(point)
        if (notify) { lastEmitted.current = Number(point.lat).toFixed(6) + ':' + Number(point.lng).toFixed(6); callback.current({ latitude:Number(point.lat).toFixed(6), longitude:Number(point.lng).toFixed(6) }); if (lookup) moveCallback.current?.(point) }
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
    const fingerprint = Number(latitude).toFixed(6) + ':' + Number(longitude).toFixed(6)
    if (lastEmitted.current !== null && lastEmitted.current !== fingerprint) externalChange.current?.()
    lastEmitted.current = fingerprint
    if (hasLocationPin({ latitude, longitude })) {
      const point = { lat: Number(latitude), lng: Number(longitude) }
      engine.update(point, false)
      if (!engine.map.getBounds().contains(point)) engine.map.panTo(point)
    } else engine.clear()
  }, [engine, latitude, longitude])
  function choose(place) {
    if (!engine) return
    cancelReverse()
    engine.map.setView([place.latitude, place.longitude], 17)
    engine.update({ lat: place.latitude, lng: place.longitude }, true, false)
    onAddressSelected?.(place)
    setQuery(place.label); setLocationMessage('Address selected. Check the entrance pin and the editable street address below.')
  }
  return <><AddressSearch key={lookupVersion} value={query} onQueryChange={value => { cancelReverse(); setQuery(value); setLocationMessage('') }} onSelect={choose} disabled={!engine} locating={locating} locationMessage={locationMessage} /><p className="small mt-2">Click the property location, then drag the pin to its entrance. Moving the pin updates the nearest mapped address; check it before saving.</p>{error && <div role="status" className="alert alert-warning">Map imagery could not load. You can enter coordinates below.<button type="button" className="btn btn-outline-primary btn-sm ms-2" onClick={onRetry}>Reload map</button></div>}<div ref={element} className="pin-picker" role="region" aria-label="Property location picker" /><p className="pin-status" role="status">{hasLocationPin({ latitude, longitude }) ? 'Location pin placed. Check that it matches the street address.' : 'No property pin yet. Search for an address or click the map to place it.'}</p></>
}
