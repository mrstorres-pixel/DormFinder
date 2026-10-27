import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../lib/api'

export default function AddressSearch({ onSelect, disabled = false }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ results: [], pending: false, searched: false, error: '' })
  const request = useRef({ version: 0, controller: null })
  useEffect(() => () => request.current.controller?.abort(), [])
  function edit(value) {
    request.current.controller?.abort()
    request.current.version++
    setQuery(value)
    setState({ results: [], pending: false, searched: false, error: '' })
  }
  async function search() {
    const term = query.trim()
    if (term.length < 3) { setState({ results: [], pending: false, searched: false, error: 'Enter at least three characters of a street, address or place.' }); return }
    request.current.controller?.abort()
    const controller = new AbortController(), version = ++request.current.version
    request.current.controller = controller
    setState({ results: [], pending: true, searched: false, error: '' })
    try {
      const response = await api.get('/landlord/address-search', { params: { q: term }, signal: controller.signal })
      if (version === request.current.version && !controller.signal.aborted) setState({ results: response.data.data, pending: false, searched: true, error: '' })
    } catch (error) {
      if (version === request.current.version && !controller.signal.aborted) setState({ results: [], pending: false, searched: false, error: error.response?.data?.message || 'Address search could not load. Try again, or click the map to place your pin.' })
    }
  }
  return <div className="owner-address-search"><label className="form-label" htmlFor={id}>Find the property address</label><div className="owner-address-search-row"><input id={id} className="form-control" type="search" value={query} maxLength={200} disabled={disabled} placeholder="Street, building or address, followed by city" aria-describedby={id + '-hint'} onChange={event => { event.stopPropagation(); edit(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (!state.pending) void search() } }} /><button type="button" className="btn btn-primary" disabled={disabled || state.pending} onClick={search}>{state.pending ? 'Searching…' : 'Find address'}</button></div><p id={id + '-hint'} className="owner-fine-print">Search Philippine addresses and places. Choose a result to place the pin, then adjust it to the property entrance.</p>
    <div aria-live="polite">{state.error && <p className="alert alert-warning">{state.error}</p>}{state.searched && !state.results.length && <p className="owner-address-empty">No matching addresses found. Include the city or a nearby landmark, or click the map to place the pin.</p>}</div>
    {state.results.length > 0 && <ul className="owner-address-results" aria-label="Address search results">{state.results.map((place, index) => <li key={place.latitude + ':' + place.longitude + ':' + index}><button type="button" disabled={disabled} onClick={() => { onSelect(place); setState(current => ({ ...current, results: [], searched: false })); setQuery(place.label) }}>{place.label}<span>Place pin here</span></button></li>)}</ul>}
    <p className="owner-map-attribution">Address search: Photon · © OpenStreetMap contributors</p>
  </div>
}
