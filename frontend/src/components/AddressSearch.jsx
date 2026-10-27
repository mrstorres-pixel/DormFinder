import { useEffect, useId, useRef, useState } from 'react'
import { lookupAddress } from '../lib/geocoding'

export default function AddressSearch({ value, onQueryChange, onSelect, disabled = false, locating = false, locationMessage = '' }) {
  const id = useId()
  const [state, setState] = useState({ results: [], pending: false, searched: false, error: '' })
  const [active, setActive] = useState(-1)
  const request = useRef({ version: 0, controller: null, timer: null })
  function cancel() { clearTimeout(request.current.timer); request.current.controller?.abort(); request.current.version++ }
  useEffect(() => () => { clearTimeout(request.current.timer); request.current.controller?.abort() }, [])
  async function search(term = value.trim()) {
    cancel()
    if (term.length < 3) { setState({ results: [], pending: false, searched: false, error: 'Enter at least three characters of a street, address or place.' }); return }
    const controller = new AbortController(), version = request.current.version
    request.current.controller = controller
    setActive(-1)
    setState({ results: [], pending: true, searched: false, error: '' })
    try {
      const response = await lookupAddress('/landlord/address-search', { q: term }, controller.signal)
      if (version === request.current.version && !controller.signal.aborted) setState({ results: response.data.data, pending: false, searched: true, error: '' })
    } catch (error) {
      if (version === request.current.version && !controller.signal.aborted) setState({ results: [], pending: false, searched: false, error: error.response?.data?.message || 'Address search could not load. Try again, or click the map to place your pin.' })
    }
  }
  function edit(text) {
    cancel(); onQueryChange(text); setActive(-1)
    setState({ results: [], pending: false, searched: false, error: '' })
    if (text.trim().length >= 3) request.current.timer = setTimeout(() => void search(text.trim()), 800)
  }
  function choose(place) { cancel(); setState({ results: [], pending: false, searched: false, error: '' }); setActive(-1); onSelect(place) }
  function keyboard(event) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) event.stopPropagation()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (state.results.length) setActive(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + state.results.length) % state.results.length)
    } else if (event.key === 'Enter') { event.preventDefault(); if (active >= 0 && state.results[active]) choose(state.results[active]); else if (!state.pending) void search() }
    else if (event.key === 'Escape') { event.preventDefault(); cancel(); setState({ results: [], pending: false, searched: false, error: '' }); setActive(-1) }
  }
  return <div className="owner-address-search"><label className="form-label" htmlFor={id}>Find the property address</label><div className="owner-address-search-row"><input id={id} className="form-control" type="search" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={state.results.length > 0} aria-controls={id + '-results'} aria-activedescendant={active >= 0 ? id + '-option-' + active : undefined} value={value} maxLength={300} disabled={disabled} placeholder={locating ? 'Finding the address at your pin…' : 'Street, building or address, followed by city'} aria-describedby={id + '-hint'} onBlur={event => { if (!event.currentTarget.parentElement.parentElement.contains(event.relatedTarget)) { cancel(); setState(current => ({ ...current, results: [], pending: false })); setActive(-1) } }} onChange={event => { event.stopPropagation(); edit(event.target.value) }} onKeyDown={keyboard} /><button type="button" className="btn btn-primary" disabled={disabled || state.pending || locating} onClick={() => search()}>{state.pending ? 'Searching…' : 'Find address'}</button></div><p id={id + '-hint'} className="owner-fine-print">Type at least three characters for address suggestions. Choose a result, then adjust the pin to the property entrance.</p>
    <div aria-live="polite">{state.pending && <p className="owner-fine-print">Finding matching addresses…</p>}{locating && <p className="owner-fine-print">Finding the address at your pin…</p>}{locationMessage && <p className="owner-fine-print">{locationMessage}</p>}{state.error && <p className="alert alert-warning">{state.error}</p>}{state.searched && !state.results.length && <p className="owner-address-empty">No matching addresses found. Include the city or a nearby landmark, or click the map to place the pin.</p>}</div>
    {state.results.length > 0 && <ul id={id + '-results'} role="listbox" className="owner-address-results" aria-label="Address search results">{state.results.map((place, index) => <li role="option" id={id + '-option-' + index} aria-selected={active === index} key={place.latitude + ':' + place.longitude + ':' + index}><button type="button" tabIndex={-1} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => choose(place)}>{place.label}<span>Place pin here</span></button></li>)}</ul>}
    <p className="owner-map-attribution">Address search: Photon · © OpenStreetMap contributors</p>
  </div>
}
