import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { pesos } from '../lib/money'
import { ErrorNotice, Field, Loading } from './Feedback'
import { RoomCharges } from './RoomOptions'

export function Listings() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const search = params.get('q') || ''
  const { data: user } = useCurrentUser()
  const [choices, setChoices] = useState({})
  const [selected, setSelected] = useState([])
  const query = useQuery({ queryKey: ['listings', search, page], queryFn: async () => (await api.get('/listings', { params: { q: search, page } })).data, refetchInterval: 240_000 })
  function toggle(property, checked) {
    setSelected(current => checked ? [...current.filter(item => item.property_id !== property.id), { property_id: property.id, room_option_id: Number(choices[property.id] || property.room_options[0].id) }] : current.filter(item => item.property_id !== property.id))
  }
  function choose(propertyId, optionId) {
    setChoices(current => ({ ...current, [propertyId]: optionId }))
    setSelected(current => current.map(item => item.property_id === propertyId ? { ...item, room_option_id: Number(optionId) } : item))
  }
  const compareItems = selected.map(item => `${item.property_id}:${item.room_option_id}`).join(',')
  return <section className="container page-space"><div className="page-heading"><div><span className="eyebrow">NEAR TIP MANILA</span><h1>Find your place</h1><p>Explore reviewed listings. Confirm availability and terms with the owner.</p></div>{user?.role === 'student' && selected.length > 0 && <Link className="btn btn-primary" to={'/compare?items=' + compareItems}>Compare {selected.length} {selected.length === 1 ? 'listing' : 'listings'}</Link>}</div>
    <form className="listing-search" onSubmit={event => { event.preventDefault(); setParams({ q: new FormData(event.currentTarget).get('q') || '' }) }}><label className="visually-hidden" htmlFor="listing-search">Search property or city</label><input className="form-control" id="listing-search" name="q" key={search} defaultValue={search} placeholder="Search property or city" maxLength={100} /><button className="btn btn-outline-primary">Search</button></form>
    <p className="small text-secondary mt-3">Content review is not a safety inspection or ownership certification. Prices are labeled per person or per room; compare the same basis.</p>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? <div className="row g-4 mt-1">{query.data.data.map(property => {
      const selectedOption = property.room_options.find(option => option.id === Number(choices[property.id])) || property.room_options[0]
      const checked = selected.some(item => item.property_id === property.id)
      return <div className="col-md-6 col-xl-4" key={property.id}><article className="property-card h-100"><div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} /> : <span aria-hidden="true">⌂</span>}{property.is_demo && <span className="status-badge">Synthetic demo</span>}</div><div className="p-4"><p className="small text-secondary text-uppercase">{property.property_type.replaceAll('_', ' ')}</p><h2><Link to={'/listings/' + property.id}>{property.title}</Link></h2><p>{property.address}, {property.city}</p>
        {selectedOption && <><label className="form-label" htmlFor={'option-' + property.id}>Room option for {property.title}</label><select className="form-select mb-3" id={'option-' + property.id} value={selectedOption.id} onChange={event => choose(property.id, event.target.value)}>{property.room_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><p className="room-price">{pesos(selectedOption.monthly_rent_centavos)} <span>/ month · {selectedOption.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><p className="small">{selectedOption.available_units} {selectedOption.inventory_type === 'bedspace' ? 'beds' : 'rooms'} available{selectedOption.availability_stale ? ' · Needs confirmation' : ''}</p></>}
        {user?.role === 'student' && selectedOption && <label className="d-flex gap-2"><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 3} onChange={event => toggle(property, event.target.checked)} /><span>Compare {property.title}</span></label>}
      </div></article></div>
    })}</div> : <div className="panel empty-state"><h2>No reviewed listings yet.</h2><p>{search ? 'Try a different property name or city.' : 'Property owners are preparing their listings. Please check back soon.'}</p></div>}
    {query.data?.meta.last_page > 1 && <nav className="d-flex gap-3 align-items-center mt-4" aria-label="Listing pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setParams({ q: search, page: String(page - 1) })}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setParams({ q: search, page: String(page + 1) })}>Next</button></nav>}
  </section>
}

export function ListingDetails() {
  const { id } = useParams()
  const { data: user } = useCurrentUser()
  const [choice, setChoice] = useState('')
  const query = useQuery({ queryKey: ['listing', id], queryFn: async () => (await api.get('/listings/' + id)).data.data, refetchInterval: 240_000 })
  if (query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /><Link to="/listings">Browse other listings</Link></div>
  const property = query.data
  const option = property.room_options.find(item => item.id === Number(choice)) || property.room_options[0]
  return <section className="container page-space"><Link className="back-link" to="/listings">← Browse listings</Link><div className="page-heading mt-4"><div><span className="eyebrow">{property.property_type.replaceAll('_', ' ')}</span><h1>{property.title}</h1><p>{property.address}, {property.city}</p></div>{property.is_demo && <span className="badge text-bg-warning">Synthetic demo listing</span>}</div>
    <div className="public-photos mb-4">{property.photos.map(photo => <figure key={photo.id}><img src={photo.url} alt={photo.caption} /><figcaption>{photo.caption}</figcaption></figure>)}</div>
    <div className="row g-4"><div className="col-lg-7"><section className="panel"><h2>About this property</h2><p className="preserve-lines">{property.description}</p><p className="small text-secondary">Location pin: {property.latitude}, {property.longitude}. Confirm directions with the owner.</p><p className="small text-secondary">Reviewed for listing content. This does not certify safety, legal compliance or ownership.</p></section></div><div className="col-lg-5"><section className="panel"><h2>Rooms and costs</h2>{option ? <><label htmlFor="selected-room" className="form-label">Choose a room option</label><select id="selected-room" className="form-select mb-3" value={option.id} onChange={event => setChoice(event.target.value)}>{property.room_options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><RoomCharges option={option} />{user?.role === 'student' ? <><Link className="btn btn-outline-primary mb-4" to={`/compare?items=${property.id}:${option.id}`}>Compare this option</Link><NewInquiry key={option.id} property={property} option={option} /></> : !user ? <Link to="/login" className="btn btn-primary">Sign in to ask the owner</Link> : <p className="small text-secondary">Students can send private inquiries from this page.</p>}</> : <p>No room options currently available.</p>}</section></div></div>
  </section>
}

function NewInquiry({ property, option }) {
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [identity, setIdentity] = useState({ body: '', id: '' })
  const mutation = useMutation({ mutationFn: data => writeApi('post', `/listings/${property.id}/inquiries`, data), onSuccess: data => navigate('/inquiries/' + data.id) })
  function send(event) {
    event.preventDefault()
    const clientId = identity.body === body && identity.id ? identity.id : crypto.randomUUID()
    setIdentity({ body, id: clientId })
    mutation.mutate({ room_option_id: option.id, body, client_id: clientId })
  }
  return <form onSubmit={send}><h3>Ask the owner</h3><p className="small">Only you and this property’s owner can read the conversation. Do not send identity documents, passwords or payment details.</p><ErrorNotice error={mutation.error} /><Field name="inquiry-body" label="Your question" as="textarea" rows={4} maxLength={3000} required value={body} onChange={event => setBody(event.target.value)} /><button className="btn btn-primary w-100" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : 'Send private inquiry'}</button></form>
}

export function Comparison() {
  const [params] = useSearchParams()
  const selections = (params.get('items') || '').split(',').filter(Boolean).map(value => { const [propertyId, optionId] = value.split(':'); return { property_id: Number(propertyId), room_option_id: Number(optionId) } })
  const valid = selections.length > 0 && selections.length <= 3 && selections.every(item => Number.isSafeInteger(item.property_id) && Number.isSafeInteger(item.room_option_id) && item.property_id > 0 && item.room_option_id > 0)
  const query = useQuery({ queryKey: ['comparison', params.get('items')], enabled: valid, queryFn: async () => (await writeApi('post', '/compare', { selections })), retry: false })
  return <section className="container page-space"><Link to="/listings">← Choose listings</Link><h1 className="mt-4">Compare your options</h1><p>Compare up to three reviewed properties using one room option from each.</p><p className="alert alert-info">Per-person and per-room amounts describe different things. Variable utilities are additional; confirm final terms with each owner.</p>
    {!valid ? <div className="panel"><p>Select one to three listings and their room options.</p><Link to="/listings">Browse listings</Link></div> : query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : <div className="row g-4">{query.data.map(property => <div className="col-md-6 col-xl-4" key={property.id}><article className="panel h-100"><h2><Link to={'/listings/' + property.id}>{property.title}</Link></h2><p>{property.address}, {property.city}</p><h3>{property.room_options[0].name}</h3><RoomCharges option={property.room_options[0]} /><Link className="btn btn-outline-primary" to={'/listings/' + property.id}>View and ask owner</Link></article></div>)}</div>}
  </section>
}
