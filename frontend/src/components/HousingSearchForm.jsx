import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { useCampuses } from '../lib/discovery'
import { amenities } from '../lib/housing'
import { toCentavos } from '../lib/money'
import DiscoverySearch from './DiscoverySearch'
import { ErrorNotice, Loading } from './Feedback'

export default function HousingSearchForm({ home = false }) {
  const navigate = useNavigate()
  const campuses = useCampuses()
  const { data: user } = useCurrentUser()
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const preferences = useRef(null)
  const campusId = selected ?? String(user?.preferred_campus_id || '')
  function find(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const type = form.get('inventory_type')
    const params = new URLSearchParams(campusId ? { campus_id: campusId, radius_km: form.get('radius_km'), sort: 'recommended' } : {})
    if (query.trim()) params.set('q', query.trim())
    if (type) { params.set('inventory_type', type); params.set('price_basis', type === 'bedspace' ? 'per_person' : 'per_room') }
    if (form.get('budget').trim()) {
      if (!type) { setError('Choose bedspace or whole room so your budget uses a clear price basis.'); preferences.current.open = true; preferences.current.querySelector('[name=inventory_type]').focus(); return }
      try { params.set('max_rent_centavos', String(toCentavos(form.get('budget')))) }
      catch { setError('Enter your budget as a nonnegative PHP amount with up to two decimal places.'); preferences.current.open = true; preferences.current.querySelector('[name=budget]').focus(); return }
    }
    if (form.get('available_only')) params.set('available_only', '1')
    for (const value of form.getAll('amenities[]')) params.append('amenities[]', value)
    navigate('/listings?' + params.toString())
  }
  return <form className={'housing-search-form panel ' + (home ? 'home-campus-form' : '')} onSubmit={find}>
    {!home && <div className="search-form-heading"><span className="eyebrow">FIND YOUR NEXT PLACE</span><p>Search a campus, neighborhood or dorm.</p></div>}
    <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
    <div className="search-entry"><div>{campuses.isPending ? <Loading>Loading campus directory…</Loading> : <DiscoverySearch campuses={campuses.data} value={{ campusId, query }} onChange={value => { setSelected(value.campusId); setQuery(value.query); setError('') }} />}</div><button className="btn btn-primary">Find housing<span aria-hidden="true"> →</span></button></div>
    <details ref={preferences} className="search-preferences" open={!home}><summary>{home ? 'Set a rent budget or preferences' : 'Room, budget and preferences'}</summary><div className="search-preferences-body"><div className="housing-search-basics">
      <div><label className="form-label" htmlFor="finder-room">Room type and price basis</label><select className="form-select" id="finder-room" name="inventory_type" defaultValue={home ? '' : 'bedspace'}><option value="">Explore any room type</option><option value="bedspace">Bedspace — per person</option><option value="whole_room">Whole room — per room</option></select></div>
      <div><label className="form-label" htmlFor="finder-budget">Maximum monthly base rent (PHP)</label><input className="form-control" id="finder-budget" name="budget" inputMode="decimal" placeholder="Your budget, optional" /></div>
    </div><label className="form-label mt-3" htmlFor="finder-radius">Distance from campus</label><select className="form-select mb-3" id="finder-radius" name="radius_km" defaultValue="2" disabled={!campusId}>{[0.5,1,2,5].map(km => <option key={km} value={km}>Within {km} km</option>)}</select><fieldset><legend className="h6">Required shared amenities</legend><div className="amenity-list">{Object.entries(amenities).map(([value,label]) => <label key={value}><input type="checkbox" name="amenities[]" value={value} /> {label}</label>)}</div></fieldset><label className="d-flex gap-2 mt-3"><input type="checkbox" name="available_only" defaultChecked={!home} /><span>Only show vacancies confirmed within 14 days</span></label></div></details>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <p className="search-footnote">Distances are approximate straight lines. Fixed fees and move-in costs are shown separately.</p>
  </form>
}
