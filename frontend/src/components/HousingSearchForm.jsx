import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { useCampuses } from '../lib/discovery'
import { amenities } from '../lib/housing'
import { toCentavos } from '../lib/money'
import DiscoverySearch from './DiscoverySearch'
import { ErrorNotice } from './Feedback'

export default function HousingSearchForm({ home = false }) {
  const navigate = useNavigate()
  const campuses = useCampuses()
  const { data: user } = useCurrentUser()
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const preferences = useRef(null)
  const preferencesId = useId()
  const [preferencesOpen, setPreferencesOpen] = useState(!home)
  const [filterCount, setFilterCount] = useState(home ? 0 : 2)
  function reveal(name) { setPreferencesOpen(true); requestAnimationFrame(() => preferences.current?.querySelector('[name=' + name + ']')?.focus()) }
  function countFilters(event) { const form = new FormData(event.target.form); setFilterCount(Number(!!form.get('inventory_type')) + Number(!!form.get('budget')?.trim()) + Number(!!form.get('available_only')) + form.getAll('amenities[]').length + Number(!!campusId && form.get('radius_km') !== '2')) }
  const campusId = selected ?? String(user?.preferred_campus_id || '')
  function find(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const type = form.get('inventory_type')
    const params = new URLSearchParams(campusId ? { campus_id: campusId, radius_km: form.get('radius_km'), sort: 'recommended' } : {})
    if (query.trim()) params.set('q', query.trim())
    if (type) { params.set('inventory_type', type); params.set('price_basis', type === 'bedspace' ? 'per_person' : 'per_room') }
    if (form.get('budget').trim()) {
      if (!type) { setError('Choose bedspace or whole room so your budget uses a clear price basis.'); reveal('inventory_type'); return }
      try { params.set('max_rent_centavos', String(toCentavos(form.get('budget')))) }
      catch { setError('Enter your budget as a nonnegative PHP amount with up to two decimal places.'); reveal('budget'); return }
    }
    if (form.get('available_only')) params.set('available_only', '1')
    for (const value of form.getAll('amenities[]')) params.append('amenities[]', value)
    navigate('/listings?' + params.toString())
  }
  return <form className={'housing-search-form panel ' + (home ? 'home-campus-form' : '')} onSubmit={find}>
    {!home && <div className="search-form-heading"><span className="eyebrow">FIND YOUR NEXT PLACE</span><p>Search a campus, neighborhood or dorm.</p></div>}
    <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
    <div className="search-entry"><div><DiscoverySearch campuses={campuses.data || []} value={{ campusId, query }} onChange={value => { setSelected(value.campusId); setQuery(value.query); setError('') }} />{campuses.isPending && <p className="small text-secondary" role="status">Loading campus suggestions… You can already search for a place.</p>}</div><button className="btn btn-primary">Find housing<span aria-hidden="true"> →</span></button></div>
    <div className="search-preferences"><div className="home-filter-heading"><button type="button" className="btn btn-outline-primary home-filter-toggle" aria-expanded={preferencesOpen} aria-controls={preferencesId} onClick={() => setPreferencesOpen(value => !value)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-8 0v6" /></svg>{preferencesOpen ? 'Hide filters' : 'Filters'}{filterCount > 0 && <span className="home-filter-count">{filterCount}</span>}</button><span>Room type, budget and amenities</span></div><div id={preferencesId} ref={preferences} hidden={!preferencesOpen} onChange={countFilters} className="search-preferences-body"><div className="housing-search-basics">
      <div><label className="form-label" htmlFor="finder-room">Room type and price basis</label><select className="form-select" id="finder-room" name="inventory_type" defaultValue={home ? '' : 'bedspace'}><option value="">Explore any room type</option><option value="bedspace">Bedspace — per person</option><option value="whole_room">Whole room — per room</option></select></div>
      <div><label className="form-label" htmlFor="finder-budget">Maximum monthly base rent (PHP)</label><input className="form-control" id="finder-budget" name="budget" inputMode="decimal" placeholder="Your budget, optional" /></div>
    </div><label className="form-label mt-3" htmlFor="finder-radius">Distance from campus</label><select className="form-select mb-3" id="finder-radius" name="radius_km" defaultValue="2" disabled={!campusId}>{[0.5,1,2,5].map(km => <option key={km} value={km}>Within {km} km</option>)}</select><fieldset><legend className="h6">Required shared amenities</legend><div className="amenity-list">{Object.entries(amenities).map(([value,label]) => <label key={value}><input type="checkbox" name="amenities[]" value={value} /> {label}</label>)}</div></fieldset><label className="d-flex gap-2 mt-3"><input type="checkbox" name="available_only" defaultChecked={!home} /><span>Only show vacancies confirmed within 14 days</span></label></div></div>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <p className="search-footnote">Distances are approximate straight lines. Fixed fees and move-in costs are shown separately.</p>
  </form>
}
