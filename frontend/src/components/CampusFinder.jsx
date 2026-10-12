import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { useCampuses } from '../lib/discovery'
import { amenities } from '../lib/housing'
import { toCentavos } from '../lib/money'
import CampusSearch from './CampusSearch'
import { ErrorNotice, Loading } from './Feedback'

export default function CampusFinder() {
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
    const params = new URLSearchParams({ campus_id: campusId, radius_km: form.get('radius_km'), sort: 'recommended', inventory_type: type, price_basis: type === 'bedspace' ? 'per_person' : 'per_room' })
    if (form.get('budget').trim()) {
      try { params.set('max_rent_centavos', String(toCentavos(form.get('budget')))) }
      catch { setError('Enter your budget as a nonnegative PHP amount with up to two decimal places.'); return }
    }
    if (form.get('available_only')) params.set('available_only', '1')
    for (const value of form.getAll('amenities[]')) params.append('amenities[]', value)
    navigate('/listings?' + params.toString())
  }
  return <section className="container page-space narrow-page"><span className="eyebrow">HOUSING THAT FITS YOUR STUDENT LIFE</span><h1>Campus housing finder</h1><p>Build a search around your actual campus and budget. Results explain their matches so you can compare and arrange a viewing.</p>
    <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
    {campuses.isPending ? <Loading /> : <form className="panel" onSubmit={find}>
      <h2>1. Choose your campus</h2><CampusSearch campuses={campuses.data} value={campusId} onChange={setSelected} />
      <label className="form-label" htmlFor="finder-radius">Distance from campus</label><select className="form-select mb-4" id="finder-radius" name="radius_km" defaultValue="2">{[0.5,1,2,5].map(km => <option key={km} value={km}>Within {km} km</option>)}</select>
      <h2>2. Set your room and budget</h2><label className="form-label" htmlFor="finder-room">Room type and price basis</label><select className="form-select mb-3" id="finder-room" name="inventory_type"><option value="bedspace">Bedspace — rent per person</option><option value="whole_room">Whole room — rent per room</option></select>
      <label className="form-label" htmlFor="finder-budget">Maximum monthly base rent (PHP)</label><input className="form-control mb-2" id="finder-budget" name="budget" inputMode="decimal" placeholder="e.g. 5000" /><p className="small text-secondary">Optional. Fixed monthly fees, deposit, advance rent and variable utilities are shown separately.</p>
      <h2>3. Pick what matters</h2><fieldset><legend className="h5">Required shared amenities</legend><div className="amenity-list">{Object.entries(amenities).map(([value,label]) => <label key={value}><input type="checkbox" name="amenities[]" value={value} /> {label}</label>)}</div></fieldset>
      <label className="d-flex gap-2 my-4"><input type="checkbox" name="available_only" defaultChecked /><span>Only show vacancies confirmed within 14 days</span></label>
      <p className="small">Distances are approximate straight lines. Results keep your chosen radius and filters, even when there are no matches.</p>{error && <p role="alert" className="text-danger">{error}</p>}
      <button className="btn btn-primary w-100" disabled={!!campuses.error}>Find my campus matches</button>
    </form>}<Link className="d-inline-block mt-3" to="/listings">Browse with all filters</Link>
  </section>
}
