import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { pesos } from '../lib/money'
import { useCampuses, distanceLabel } from '../lib/discovery'
import { useComparison, parseSelections, comparisonItems, cleanSelections } from '../lib/comparison'
import { ErrorNotice, Field, Loading } from './Feedback'
import { RoomCharges } from './RoomOptions'
import { FavoriteButton, ComparisonTray, SearchFilters, ListingCard, PhotoGallery, ListingMap } from './Discovery'

export function Listings({ favorites = false }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const campuses = useCampuses()
  const query = useQuery({ queryKey: [favorites ? 'favorites' : 'listings', params.toString()], queryFn: async () => (await api.get(favorites ? '/favorites' : '/listings', { params: favorites ? { page } : Object.fromEntries(params) })).data, retry: false, refetchInterval: 240_000 })
  const rows = query.data?.data || []
  const campus = campuses.data?.find(item => item.id === rows[0]?.distance_from_campus?.campus_id) || campuses.data?.find(item => item.slug === 'tip-manila-casal')
  function turnPage(next) { setParams(current => { const result = new URLSearchParams(current); result.set('page', String(next)); return result }) }
  return <section className="container page-space"><div className="page-heading"><div><span className="eyebrow">NEAR TIP MANILA</span><h1>{favorites ? 'Your favorites' : 'Find your place'}</h1><p>{favorites ? 'Your saved listings. Confirm availability and terms with the owner.' : 'Explore reviewed listings. Confirm availability and terms with the owner.'}</p></div>{favorites && <Link to="/listings" className="btn btn-outline-primary">Browse listings</Link>}</div>
    {!favorites && <SearchFilters params={params} onSearch={setParams} campuses={campuses.data} />}
    <ComparisonTray />
    <p className="small text-secondary mt-3">Content review is not a safety inspection or ownership certification. Prices are labeled per person or per room; compare the same basis.</p>
    {favorites && query.data?.meta.unavailable_ids?.length > 0 && <div className="alert alert-info"><p role="status">{query.data.meta.unavailable_ids.length} saved listing(s) are currently unpublished. They remain saved and will return here if approved again.</p><div className="d-flex gap-2 flex-wrap">{query.data.meta.unavailable_ids.map(id => <FavoriteButton key={id} propertyId={id} title={'unpublished listing ' + id} />)}</div></div>}
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rows.length ? <><p className="small" role="status">{query.data.meta.total} {query.data.meta.total === 1 ? 'listing' : 'listings'} found · Page {page} of {query.data.meta.last_page}</p><ListingMap properties={rows} campus={campus} /><div className="row g-4 mt-1">{rows.map(property => <div className="col-md-6 col-xl-4" key={property.id}><ListingCard property={property} campus={campus} /></div>)}</div></> : <div className="panel empty-state"><h2>{favorites ? 'No published favorites to show.' : 'No listings match your search.'}</h2><p>{favorites ? 'Save a reviewed listing to find it here later.' : 'Try a wider budget or reset your filters. Owners may still be preparing their listings.'}</p></div>}
    {query.data?.meta.last_page > 1 && <nav className="d-flex gap-3 align-items-center mt-4" aria-label="Listing pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => turnPage(page - 1)}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => turnPage(page + 1)}>Next</button></nav>}
  </section>
}

export function ListingDetails() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data: user } = useCurrentUser()
  const { selections, choose } = useComparison()
  const campuses = useCampuses()
  const [choice, setChoice] = useState('')
  const query = useQuery({ queryKey: ['listing', id, params.get('campus_id')], queryFn: async () => (await api.get('/listings/' + id, { params: { campus_id: params.get('campus_id') || undefined } })).data.data, retry: false, refetchInterval: 240_000 })
  if (query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /><Link to="/listings">Browse other listings</Link></div>
  const property = query.data
  const option = property.room_options.find(item => item.id === Number(choice || params.get('option'))) || property.room_options[0]
  const campus = campuses.data?.find(item => item.id === property.distance_from_campus?.campus_id)
  const checked = selections.some(item => item.property_id === property.id)
  return <section className="container page-space"><Link className="back-link" to="/listings">← Browse listings</Link><div className="page-heading mt-4"><div><span className="eyebrow">{property.property_type.replaceAll('_', ' ')}</span><h1>{property.title}</h1><p>{property.address}, {property.city}</p></div>{property.is_demo && <span className="badge text-bg-warning">Synthetic demo listing</span>}</div>
    <FavoriteButton propertyId={property.id} title={property.title} /><ComparisonTray /><PhotoGallery key={property.id} photos={property.photos} refresh={() => query.refetch()} />
    <div className="row g-4"><div className="col-lg-7"><section className="panel mb-4"><h2>About this property</h2><p className="preserve-lines">{property.description}</p><p className="small text-secondary">{distanceLabel(property.distance_from_campus, campus)}</p><p className="small text-secondary">Location pin: {property.latitude}, {property.longitude}. Confirm directions with the owner.</p><p className="small text-secondary">Reviewed for listing content. This does not certify safety, legal compliance or ownership.</p></section><ListingMap properties={[property]} campus={campus} /></div><div className="col-lg-5"><section className="panel"><h2>Rooms and costs</h2>{option ? <><label htmlFor="selected-room" className="form-label">Choose a room option</label><select id="selected-room" className="form-select mb-3" value={option.id} onChange={event => { setChoice(event.target.value); if (checked) choose(property.id, event.target.value) }}>{property.room_options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><RoomCharges option={option} />{user?.role === 'student' ? <><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={checked} disabled={!checked && selections.length >= 3} onChange={event => choose(property.id, option.id, event.target.checked)} /><span>Add {property.title} to comparison</span></label><Link className="btn btn-outline-primary mb-4" to={`/compare?items=${property.id}:${option.id}`}>Compare this option</Link><NewInquiry key={option.id} property={property} option={option} /></> : !user ? <Link to="/login" className="btn btn-primary">Sign in to ask the owner</Link> : <p className="small text-secondary">Students can send private inquiries from this page.</p>}</> : <p>No room options currently available.</p>}</section></div></div>
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
  return <form onSubmit={send}><h3>Ask the owner</h3><p className="small">Only you and this property's owner can read the conversation. Do not send identity documents, passwords or payment details.</p><ErrorNotice error={mutation.error} /><Field name="inquiry-body" label="Your question" as="textarea" rows={4} maxLength={3000} required value={body} onChange={event => setBody(event.target.value)} /><button className="btn btn-primary w-100" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : 'Send private inquiry'}</button></form>
}

export function Comparison() {
  const [params, setParams] = useSearchParams()
  const { choose } = useComparison()
  const campuses = useCampuses()
  const selections = parseSelections(params.get('items'))
  const valid = selections.length > 0 && selections.length <= 3 && cleanSelections(selections).length === selections.length
  const query = useQuery({ queryKey: ['comparison', params.toString()], enabled: valid, queryFn: async () => writeApi('post', '/compare', { selections, campus_id: params.get('campus_id') || undefined }), retry: false, refetchInterval: 240_000 })
  const rows = query.data || []
  const campus = campuses.data?.find(item => item.id === rows[0]?.distance_from_campus?.campus_id)
  function change(propertyId, optionId) {
    const next = selections.map(item => item.property_id === propertyId ? { ...item, room_option_id: Number(optionId) } : item)
    choose(propertyId, optionId)
    setParams(current => { const result = new URLSearchParams(current); result.set('items', comparisonItems(next)); return result })
  }
  function remove(propertyId) {
    choose(propertyId, 0, false)
    setParams(current => { const result = new URLSearchParams(current); result.set('items', comparisonItems(selections.filter(item => item.property_id !== propertyId))); return result })
  }
  const cells = [
    ['Property type', property => property.property_type.replaceAll('_', ' ')],
    ['Address', property => `${property.address}, ${property.city}`],
    ['Campus distance', property => distanceLabel(property.distance_from_campus, campus)],
    ['Price basis', (_, option) => option.price_basis === 'per_person' ? 'Per person' : 'Per room'],
    ['Monthly base rent', (_, option) => pesos(option.monthly_rent_centavos)],
    ['Known monthly charges', (_, option) => pesos(option.monthly_fixed_total_centavos)],
    ['Deposit', (_, option) => pesos(option.deposit_centavos)],
    ['Advance rent', (_, option) => `${option.advance_months} month(s)`],
    ['Deposit, advance and one-time fees', (_, option) => pesos(option.move_in_fixed_total_centavos)],
    ['Fixed fees', (_, option) => option.fees.map(fee => `${fee.name}: ${pesos(fee.amount_centavos)} (${fee.frequency.replaceAll('_', ' ')})`).join('; ') || 'None stated'],
    ['Utilities and other terms', (_, option) => option.utilities_notes],
    ['Room capacity', (_, option) => `${option.capacity} people`],
    ['Available inventory', (_, option) => `${option.available_units} of ${option.total_units} ${option.inventory_type === 'bedspace' ? 'beds' : 'rooms'}`],
    ['Availability confirmation', (_, option) => `${new Date(option.availability_confirmed_at).toLocaleDateString('en-PH')}${option.availability_stale ? ' · Needs confirmation' : ''}`],
  ]
  return <section className="container page-space"><Link to="/listings">← Choose listings</Link><h1 className="mt-4">Compare your options</h1><p>Compare up to three reviewed properties using one room option from each.</p><p className="alert alert-info">Per-person and per-room amounts describe different things. Variable utilities are additional; confirm final terms with each owner.</p>
    {!valid ? <div className="panel"><p>Select one to three distinct listings and their room options.</p><Link to="/listings">Browse listings</Link></div> : query.isPending ? <Loading /> : query.error ? <><ErrorNotice error={query.error} retry={() => query.refetch()} /><p>A selected listing or option may no longer be public. Remove it or choose another listing.</p><div className="d-flex gap-2 flex-wrap">{selections.map(item => <button key={item.property_id} className="btn btn-outline-secondary" onClick={() => remove(item.property_id)}>Remove listing {item.property_id}</button>)}</div></> : <>
      <div className="comparison-scroll" role="region" aria-label="Listing comparison table" tabIndex={0}><table className="table comparison-table"><caption>Room costs, inventory, terms and approximate campus distance</caption><thead><tr><th scope="col">Compare</th>{rows.map(property => <th scope="col" key={property.id}><h2><Link to={'/listings/' + property.id}>{property.title}</Link></h2>{property.photos[0] && <img className="comparison-photo" src={property.photos[0].url} alt={property.photos[0].caption} />}<label className="d-block">Room option for {property.title}<select aria-label={'Room option for ' + property.title} className="form-select mt-2" value={property.room_options[0].id} onChange={event => change(property.id, event.target.value)}>{property.alternative_room_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><p className="small mt-2">{pesos(property.room_options[0].monthly_rent_centavos)} / month · {property.room_options[0].price_basis === 'per_person' ? 'per person' : 'per room'}</p><button className="btn btn-link btn-sm" onClick={() => remove(property.id)}>Remove {property.title}</button></th>)}</tr></thead><tbody>{cells.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{rows.map(property => <td key={property.id}>{value(property, property.room_options[0])}</td>)}</tr>)}<tr><th scope="row">Next step</th>{rows.map(property => <td key={property.id}><Link className="btn btn-outline-primary" to={`/listings/${property.id}?option=${property.room_options[0].id}${campus ? '&campus_id=' + campus.id : ''}`}>View and ask owner</Link><FavoriteButton propertyId={property.id} title={property.title} /></td>)}</tr></tbody></table></div>
      <ListingMap properties={rows} campus={campus} />
    </>}
  </section>
}
