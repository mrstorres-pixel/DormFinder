import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fieldErrors, writeApi } from '../lib/api'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { ErrorNotice, Field, Loading } from './Feedback'
import { RoomCharges } from './RoomOptions'
import { pesos } from '../lib/money'
import ListingInformation from './ListingInformation'
import PhotoGallery from './PhotoGallery'
import ReviewLocationMap from './ReviewLocationMap'
import { LifecycleControls } from './ModerationPages'
import { AdminShell, AdminWorkQueues, AdminLayout, AdminFilterBar, AdminPager, AdminEmpty } from './AdminTools'
import { useAdminBrowse } from '../lib/adminBrowse'
import './review-workspace.css'

const submitted = value => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Submission date unavailable'
const statusLabel = value => value === 'pending_review' ? 'Awaiting review' : value.replaceAll('_', ' ')

export function ReviewQueue() {
  const browse = useAdminBrowse('reviews', '/admin/reviews', 'oldest')
  const { params, page, query } = browse
  const rows = query.data?.data || []
  return <AdminLayout title="Listing review queue" description="Review submissions, check their photos and charges, then approve or return clear feedback." className="review-workspace review-queue">
    <AdminWorkQueues />
    <ol className="admin-review-workflow" aria-label="Listing review workflow"><li><span>1</span>Open a submission</li><li><span>2</span>Check photos, rooms & location</li><li><span>3</span>Approve or return feedback</li></ol>
    <AdminFilterBar browse={browse} sorts={[["oldest", "Oldest submissions first"], ["newest", "Newest submissions first"], ["title_asc", "Listing: A-Z"], ["title_desc", "Listing: Z-A"]]} filters={[{ name: 'property_type', label: 'Property type', options: [['', 'All property types'], ['dormitory', 'Dormitory'], ['apartment', 'Apartment'], ['boarding_house', 'Boarding house'], ['rental_room', 'Rental room']] }]} />
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rows.length ? <>
      <div className="review-queue-list">{rows.map(property => <article className="review-queue-row" key={property.id}>
        <Link className="review-queue-image" to={`/admin/reviews/${property.id}?page=${page}`} state={{ adminReturn: "/admin?" + params.toString() }} aria-label={'Review photos: ' + property.title}>{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption || 'Listing cover'} loading="lazy" /> : <span aria-hidden="true">⌂</span>}</Link>
        <div className="review-queue-copy"><span className="review-property-type">{property.property_type?.replaceAll('_', ' ') || 'Property'}</span><h2><Link to={`/admin/reviews/${property.id}?page=${page}`} state={{ adminReturn: "/admin?" + params.toString() }}>{property.title}</Link></h2><p>{[property.address, property.city].filter(Boolean).join(', ')}</p><div className="review-queue-facts"><span>{property.photos.length} photos</span><span>{property.room_options.length} room {property.room_options.length === 1 ? 'option' : 'options'}</span></div><time dateTime={property.submitted_at || undefined}>{submitted(property.submitted_at)}</time></div>
        <Link className="btn btn-outline-primary review-open" to={`/admin/reviews/${property.id}?page=${page}`} state={{ adminReturn: "/admin?" + params.toString() }} aria-label={'Review ' + property.title}>Review listing <span aria-hidden="true">↗</span></Link>
      </article>)}</div>
    </> : <AdminEmpty title={params.get('q') || params.get('property_type') ? 'No matching submissions' : 'You’re all caught up.'}>{page > 1 ? <button className="btn btn-outline-primary" onClick={() => browse.setPage(1)}>Back to first page</button> : <><p>New submissions will appear here, with the oldest first.</p><Link className="btn btn-outline-primary" to="/admin/reports">Check student reports</Link><Link to="/admin/listings">Browse all listings</Link></>}</AdminEmpty>}
    {query.data && <AdminPager browse={browse} noun="submissions" />}
    <p className="review-scope-note review-boundary-note">Review covers listing details and charges. Ownership and safety are not verified.</p>
  </AdminLayout>
}

export function ReviewDetails() {
  const location = useLocation()
  const { id } = useParams()
  const [params] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const returnPath = location.state?.adminReturn
  const queuePath = typeof returnPath === 'string' && ['/admin', '/admin/listings', '/admin/reports', '/admin/users', '/admin/audit'].includes(returnPath.split('?')[0]) ? returnPath : page > 1 ? '/admin?page=' + page : '/admin'
  const backLabel = queuePath.startsWith('/admin/listings') ? 'All listings' : queuePath.startsWith('/admin/reports') ? 'Listing reports' : queuePath.startsWith('/admin/audit') ? 'Audit history' : 'Review queue'
  const query = useQuery({ queryKey: ['review', id], queryFn: async () => (await api.get('/admin/reviews/' + id)).data.data })
  if (query.isPending) return <AdminLayout title="Listing review" description="Loading the submitted property."><Loading /></AdminLayout>
  if (query.error && !query.data) return <AdminLayout title="Listing review" description="This submission could not be loaded."><Link to={queuePath}>← {backLabel}</Link><ErrorNotice error={query.error} retry={() => query.refetch()} /></AdminLayout>
  const property = query.data
  return <AdminShell className="review-workspace review-detail">
    <Link className="back-link" to={queuePath}>← {backLabel}</Link>
    <header className="review-page-heading"><div><span className="eyebrow">LISTING REVIEW</span><h1>{property.title}</h1><p>{[property.address, property.city].filter(Boolean).join(', ')}</p></div><span className="review-status">{statusLabel(property.status)}</span></header>
    {query.error && <ErrorNotice error={query.error} retry={() => query.refetch()} />}
    <div className="review-detail-layout">
      <div className="review-content">
        <nav className="review-section-links" aria-label="Listing review sections"><a href="#review-photos">Photos</a><a href="#review-rooms">Rooms & costs</a><a href="#review-location">Location</a><a href="#review-decision-panel">Decision</a></nav>
        <section id="review-photos" className="review-photos" aria-labelledby="review-photos-title"><h2 id="review-photos-title" className="visually-hidden">Listing photos</h2><PhotoGallery key={property.id} photos={property.photos} refresh={() => query.refetch()} /></section>
        <section className="review-description"><h2>About this property</h2><p className="preserve-lines">{property.description || 'No property description provided.'}</p></section>
        <ReviewRooms key={property.id} options={property.room_options} />
        <ListingInformation property={property} />
        <section id="review-location" className="panel review-location" aria-labelledby="review-location-title"><h2 id="review-location-title">Location</h2><p>{[property.address, property.city].filter(Boolean).join(', ')}</p><ReviewLocationMap key={`${property.id}:${property.latitude}:${property.longitude}`} latitude={property.latitude} longitude={property.longitude} /><p className="review-scope-note">The pin is supplied by the owner. Check that it agrees with the address.</p></section>
      </div>
      <aside className="review-decision-column" aria-label="Review actions"><ReviewDecision key={property.id} property={property} queuePath={queuePath} refresh={() => query.refetch()} /><div className="review-moderation"><LifecycleControls property={property} admin /></div></aside>
    </div>
  </AdminShell>
}

function ReviewRooms({ options }) {
  const [selected, setSelected] = useState('')
  const room = options.find(option => String(option.id) === selected) || options[0]
  return <section id="review-rooms" className="panel review-room-panel" aria-labelledby="review-rooms-title"><h2 id="review-rooms-title">Rooms & costs</h2>{room ? <>
    <fieldset className="review-room-choices"><legend className="visually-hidden">Room option to inspect</legend>{options.map(option => <label key={option.id} className={option.id === room.id ? 'is-selected' : ''}><input type="radio" name="review-room" checked={option.id === room.id} value={option.id} onChange={() => setSelected(String(option.id))} /><span><strong>{option.name}</strong><span>{pesos(option.monthly_rent_centavos)} <small>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</small></span></span></label>)}</fieldset>
    <RoomCharges option={room} />
  </> : <p>No room options provided.</p>}</section>
}

function ReviewDecision({ property, queuePath, refresh }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const [confirmedRevision, setConfirmedRevision] = useState(null)
  const confirmed = confirmedRevision === property.revision
  const [decision, setDecision] = useState('approved')
  const [reason, setReason] = useState('')
  const [missingFeedback, setMissingFeedback] = useState(false)
  const feedback = useRef(null)
  const [refreshing, setRefreshing] = useState(false)
  const mutation = useMutation({
    mutationKey: ['property-write', property.id],
    mutationFn: values => writeApi('post', `/admin/reviews/${property.id}/decision`, values),
    onSuccess: async data => {
      clearUnsaved(); setDirty(false)
      client.setQueryData(['review', String(property.id)], data)
      await Promise.all(['reviews', 'listings', 'admin-properties', 'dashboard', 'notifications', 'notification-unread', 'audit'].map(key => client.invalidateQueries({ queryKey: [key] })))
      navigate(queuePath)
    },
  })
  const errors = fieldErrors(mutation.error)
  function decide(event) {
    event.preventDefault()
    if (!confirmed || refreshing || mutation.isPending || !canReplaceOthers()) return
    if (decision === 'rejected' && !reason.trim()) { setMissingFeedback(true); feedback.current?.focus(); return }
    mutation.mutate({ decision, reason: reason.trim(), revision: property.revision, review_confirmed: confirmed })
  }
  async function refreshListing() {
    if (!canReplaceOthers()) return
    setRefreshing(true); setConfirmedRevision(null)
    try { await refresh() } finally { setRefreshing(false) }
  }
  return <section id="review-decision-panel" className="panel review-decision" aria-labelledby="review-decision-title" tabIndex={-1}>
    <header><h2 id="review-decision-title">Review decision</h2><p>Listing #{property.id} · Revision {property.revision}</p><p><time dateTime={property.submitted_at || undefined}>{submitted(property.submitted_at)}</time></p></header>
    {property.status === 'pending_review' ? <>
      <ErrorNotice error={mutation.error} />
      {mutation.error?.response?.status === 409 && <p className="review-refresh-note">The submission changed. <button className="btn btn-link" type="button" disabled={refreshing} onClick={refreshListing}>{refreshing ? 'Refreshing…' : 'Refresh listing'}</button> Your feedback stays here; check the updated listing before deciding.</p>}
      <form onSubmit={decide} onChange={() => setDirty(true)}><fieldset disabled={mutation.isPending || refreshing}>
        <details className="review-criteria"><summary>What to check</summary><ul><li>Photos and description represent the listing clearly.</li><li>Every room’s inventory, rent and charges are understandable.</li><li>The address and pin agree; content is not misleading, prohibited or an obvious duplicate.</li></ul></details>
        <label className="review-confirmation"><input type="checkbox" checked={confirmed} onChange={event => setConfirmedRevision(event.target.checked ? property.revision : null)} /><span>I have checked the listing against these review criteria.</span></label>
        <fieldset className="review-decision-options"><legend>Decision</legend><label className={decision === 'approved' ? 'is-selected' : ''}><input type="radio" name="decision" value="approved" checked={decision === 'approved'} onChange={() => setDecision('approved')} /><span>Approve<span>Publish this listing</span></span></label><label className={decision === 'rejected' ? 'is-selected' : ''}><input type="radio" name="decision" value="rejected" checked={decision === 'rejected'} onChange={() => setDecision('rejected')} /><span>Request changes<span>Return it to the owner</span></span></label></fieldset>
        <Field label="Feedback for the owner" name="reason" as="textarea" ref={feedback} value={reason} onChange={event => { setReason(event.target.value); setMissingFeedback(false) }} required={decision === 'rejected'} maxLength={2000} error={missingFeedback ? { reason: ['Explain what the owner should correct.'] } : errors} rows={4} placeholder={decision === 'rejected' ? 'Explain what needs to change…' : 'Optional note to the owner…'} />
        <button className="btn btn-primary review-submit" disabled={!confirmed || mutation.isPending || refreshing}>{mutation.isPending ? 'Saving…' : decision === 'approved' ? 'Approve listing' : 'Send feedback'}</button>
        <p className="review-scope-note">{decision === 'approved' ? 'Approval publishes the listing. It does not certify ownership or safety.' : 'The listing stays private. The owner can edit and resubmit.'}</p>
      </fieldset></form>
    </> : <div className="review-finished"><p>This listing is now <strong>{statusLabel(property.status)}</strong>.</p>{property.moderation_reason && <p className="preserve-lines">{property.moderation_reason}</p>}<Link className="btn btn-outline-primary" to={queuePath}>Return to review queue</Link></div>}
  </section>
}
