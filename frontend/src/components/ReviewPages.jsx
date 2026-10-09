import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { ErrorNotice, Field, Loading } from './Feedback'
import { RoomCharges } from './RoomOptions'

export function ReviewQueue() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['reviews', page], queryFn: async () => (await api.get('/admin/reviews', { params: { page } })).data })
  return <section className="container page-space"><span className="eyebrow">ADMINISTRATOR WORKSPACE</span><h1>Listing review queue</h1><p>Review listing content, charges and completeness. Approval does not certify safety or ownership.</p>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? <div className="row g-4">{query.data.data.map(property => <div className="col-md-6" key={property.id}><article className="panel"><h2>{property.title}</h2><p>{property.address}, {property.city}</p><p className="small">Submitted {new Date(property.submitted_at).toLocaleString('en-PH')}</p><Link className="btn btn-outline-primary" to={'/admin/reviews/' + property.id}>Review {property.title}</Link></article></div>)}</div> : <div className="panel empty-state"><h2>The queue is clear.</h2><p>New landlord submissions will appear here.</p></div>}
    {query.data?.meta.last_page > 1 && <nav className="d-flex gap-3 mt-4" aria-label="Review pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </section>
}

export function ReviewDetails() {
  const { id } = useParams()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const query = useQuery({ queryKey: ['review', id], queryFn: async () => (await api.get('/admin/reviews/' + id)).data.data })
  const mutation = useMutation({ mutationFn: values => writeApi('post', `/admin/reviews/${id}/decision`, values), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['reviews'] }); await client.invalidateQueries({ queryKey: ['listings'] }); navigate('/admin') } })
  if (query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /></div>
  const property = query.data
  function decide(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    mutation.mutate({ ...values, revision: property.revision, review_confirmed: confirmed })
  }
  return <section className="container page-space"><Link to="/admin">← Review queue</Link><h1 className="mt-4">Review: {property.title}</h1><p>{property.address}, {property.city}</p><p className="preserve-lines">{property.description}</p><p>Coordinates: {property.latitude}, {property.longitude}</p>
    <div className="public-photos mb-4">{property.photos.map(photo => <figure key={photo.id}><img src={photo.url} alt={photo.caption} /><figcaption>{photo.caption}</figcaption></figure>)}</div>
    <div className="row g-4">{property.room_options.map(option => <div className="col-lg-6" key={option.id}><article className="panel"><h2>{option.name}</h2><RoomCharges option={option} /></article></div>)}</div>
    <section className="panel mt-4 narrow-page"><h2>Review decision</h2><ul><li>Information, room inventory and charge terms are complete and understandable.</li><li>The address and coordinates are plausible and photos match the listing.</li><li>Check for misleading or prohibited content and obvious duplicate listings.</li><li>Approval is a content review, not a safety inspection or ownership certification.</li></ul>
      <ErrorNotice error={mutation.error} />{property.status === 'pending_review' ? <form onSubmit={decide}><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I have checked the listing against these review criteria.</span></label><label className="form-label" htmlFor="review-decision">Decision</label><select className="form-select mb-3" id="review-decision" name="decision"><option value="approved">Approve for publication</option><option value="rejected">Return with feedback</option></select><Field label="Feedback for the owner" name="reason" as="textarea" maxLength={2000} hint="Required when returning a listing. Explain what the owner should correct." rows={3} /><button className="btn btn-primary" disabled={!confirmed || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save review decision'}</button></form> : <p>This listing is now {property.status.replaceAll('_', ' ')}. Return to the queue for current submissions.</p>}
    </section>
  </section>
}
