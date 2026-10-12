import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { useCampuses } from '../lib/discovery'
import { amenities } from '../lib/housing'
import { toCentavos } from '../lib/money'
import CampusSearch from './CampusSearch'
import { ErrorNotice, Loading } from './Feedback'

export default function HousingSearchForm({ home = false }) {
  const navigate = useNavigate()
  const campuses = useCampuses()
  const { data: user } = useCurrentUser()
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const campusId = selected ?? String(user?.preferred_campus_id || '')
  function find(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!campuses.data?.some(campus => String(campus.id) === campusId)) { setError('Choose a specific college or university campus.'); return }
    const type = form.get('inventory_type')
    const params = new URLSearchParams({ campus_id: campusId, radius_km: form.get('radius_km'), sort: 'recommended' })
    if (type) { params.set('inventory_type', type); params.set('price_basis', type === 'bedspace' ? 'per_person' : 'per_room') }
    if (form.get('budget').trim()) {
      if (!type) { setError('Choose bedspace or whole room so your budget uses a clear price basis.'); return }
      try { params.set('max_rent_centavos', String(toCentavos(form.get('budget')))) }
      catch { setError('Enter your budget as a nonnegative PHP amount with up to two decimal places.'); return }
    }
    if (form.get('available_only')) params.set('available_only', '1')
    for (const value of form.getAll('amenities[]')) params.append('amenities[]', value)
    navigate('/listings?' + params.toString())
  }
  return <form className={'housing-search-form panel ' + (home ? 'home-campus-form' : '')} onSubmit={find}>
    <div className="search-form-heading"><span className="eyebrow">START WITH YOUR CAMPUS</span><p>Where will you be studying?</p></div>
    <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
    {campuses.isPending ? <Loading>Loading campus directory…</Loading> : <CampusSearch campuses={campuses.data} value={campusId} onChange={value => { setSelected(value); setError('') }} />}
    <div className="housing-search-basics">
      <div><label className="form-label" htmlFor="finder-room">Room type and price basis</label><select className="form-select" id="finder-room" name="inventory_type" defaultValue={home ? '' : 'bedspace'}><option value="">Explore any room type</option><option value="bedspace">Bedspace — per person</option><option value="whole_room">Whole room — per room</option></select></div>
      <div><label className="form-label" htmlFor="finder-budget">Maximum monthly base rent (PHP)</label><input className="form-control" id="finder-budget" name="budget" inputMode="decimal" placeholder="Your budget, optional" /></div>
    </div>
    <details className="search-preferences" open={!home}><summary>Distance, amenities and availability</summary><div className="search-preferences-body"><label className="form-label" htmlFor="finder-radius">Distance from campus</label><select className="form-select mb-3" id="finder-radius" name="radius_km" defaultValue="2">{[0.5,1,2,5].map(km => <option key={km} value={km}>Within {km} km</option>)}</select><fieldset><legend className="h6">Required shared amenities</legend><div className="amenity-list">{Object.entries(amenities).map(([value,label]) => <label key={value}><input type="checkbox" name="amenities[]" value={value} /> {label}</label>)}</div></fieldset><label className="d-flex gap-2 mt-3"><input type="checkbox" name="available_only" defaultChecked={!home} /><span>Only show vacancies confirmed within 14 days</span></label></div></details>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <button className="btn btn-primary w-100" disabled={campuses.isPending || !!campuses.error}>{home ? 'Find housing near my campus' : 'Find my campus matches'}<span aria-hidden="true"> →</span></button>
    <p className="search-footnote">Start within 2 km, or adjust your distance. Fixed fees and move-in costs are shown separately.</p>
  </form>
}
