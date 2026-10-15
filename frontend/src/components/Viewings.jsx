import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { viewingIso, viewingLabel } from '../lib/practical'
import { ErrorNotice, Field, Loading } from './Feedback'
import PropertyContext from './PropertyContext'

export function RequestViewing({ property, option, onDirtyChange }) {
  const client = useQueryClient()
  const form = useRef(null)
  const [dirty, setDirty] = useState(false)
  const { clear } = useFormChanges(dirty)
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  const [identity, setIdentity] = useState({ signature: '', id: '' })
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: data => writeApi('post','/listings/' + property.id + '/viewings',data), onSuccess: () => { clear(); setDirty(false); client.invalidateQueries({ queryKey: ['viewings'] }); client.invalidateQueries({ queryKey: ['dashboard'] }) } })
  function send(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    let starts_at
    try { starts_at = viewingIso(values.time); setError('') } catch (e) { setError(e.message); return }
    const data = { starts_at, note: values.note.trim(), room_option_id: option.id }
    const signature = JSON.stringify(data)
    const id = identity.signature === signature ? identity.id : crypto.randomUUID()
    setIdentity({ signature, id })
    mutation.mutate({ ...data, client_id: id })
  }
  return <details className="listing-action" id="request-viewing"><summary>Request a property viewing</summary><p className="small mt-3">Request a one-hour visit for {option.name}. The owner must confirm the time. A viewing does not reserve a room or take payment.</p>
    <ErrorNotice error={mutation.error} />{mutation.error?.response?.status === 409 && <p className="small">The request may have changed, its room may be unavailable, or the time may overlap another viewing. <Link to="/viewings">Check your existing requests</Link> before retrying.</p>}{error && <p role="alert">{error}</p>}{mutation.isSuccess ? <p role="status">Viewing requested. <Link to="/viewings">Track the owner's response</Link></p> : <form ref={form} onSubmit={send} onChange={() => setDirty(true)}><fieldset disabled={mutation.isPending || option.available_units === 0}><Field label="Preferred viewing time (Philippine time, UTC+8)" name="time" type="datetime-local" required /><Field label="Viewing note for the owner" name="note" as="textarea" rows={2} maxLength={1000} /><p className="small text-secondary">Choose at least 30 minutes ahead and within 90 days. Confirm the meeting point with the owner.</p><button className="btn btn-primary">Send viewing request</button>{dirty && <button type="button" className="btn btn-link" onClick={() => { clear(); setDirty(false); form.current?.reset(); setIdentity({ signature: '', id: '' }); setError('') }}>Discard viewing draft</button>}</fieldset>{option.available_units === 0 && <p>This room is sold out. Choose another room option before requesting a viewing.</p>}</form>}
  </details>
}

function ViewingCard({ viewing, role, refresh }) {
  const [dirty, setDirty] = useState(false)
  const { clear } = useFormChanges(dirty)
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: data => writeApi('patch','/viewings/' + viewing.id,{ ...data, revision: viewing.revision }), onSuccess: async () => { clear(); setDirty(false); await refresh() } })
  const active = ['requested','proposed','accepted'].includes(viewing.status)
  function decide(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const action = event.nativeEvent.submitter.value
    const data = { action }
    if (form.has('owner-note-' + viewing.id)) data.note = form.get('owner-note-' + viewing.id)
    if (action === 'propose') {
      try { data.starts_at = viewingIso(form.get('proposed-time-' + viewing.id)); setError('') } catch (e) { setError(e.message); return }
    }
    if (['cancel','decline'].includes(action) && !window.confirm(action === 'cancel' ? 'Cancel this viewing request?' : 'Decline this viewing request?')) return
    mutation.mutate(data)
  }
  const stateLabel = viewing.status === 'requested' ? role === 'landlord' ? 'New viewing request' : 'Waiting for owner' : viewing.status === 'proposed' ? role === 'landlord' ? 'Waiting for student confirmation' : 'Owner suggested a new time' : viewing.status === 'accepted' ? 'Time agreed' : viewing.status === 'cancelled' ? 'Cancelled' : 'Declined'
  return <article id={'viewing-' + viewing.id} tabIndex={-1} className="panel viewing-card mb-4"><div className="viewing-card-heading"><PropertyContext title={viewing.listing_snapshot.title} room={viewing.listing_snapshot.room_name} participant={viewing.participant_name} address={viewing.listing_snapshot.address + ', ' + viewing.listing_snapshot.city} /><span className={'viewing-state state-' + viewing.status}>{stateLabel}</span></div><div className="viewing-time"><span className="viewing-time-icon" aria-hidden="true">◷</span><div><strong>{viewingLabel(viewing.starts_at)}</strong><p>One-hour visit · Philippine time</p>{viewing.requested_start && viewing.requested_start !== viewing.starts_at && <p className="small text-secondary">Originally requested: {viewingLabel(viewing.requested_start)}</p>}</div></div>{viewing.status === 'accepted' && <p className="viewing-confirmation">Confirm the meeting point with the owner before visiting.</p>}
    {viewing.student_note && <p className="preserve-lines">Student note: {viewing.student_note}</p>}{viewing.owner_note && <p className="preserve-lines">Owner note: {viewing.owner_note}</p>}<ErrorNotice error={mutation.error} />{error && <p role="alert">{error}</p>}
    {active && <form onSubmit={decide} onChange={() => setDirty(true)}><fieldset disabled={mutation.isPending}>
      {(!viewing.can_schedule || viewing.time_passed) && <p className="alert alert-info">Scheduling is paused or this time has passed. You can still cancel this request.</p>}
      {role === 'landlord' && viewing.status !== 'accepted' && <details className="viewing-proposal"><summary>Suggest a different time or add a note</summary><Field label="Message for the student" name={'owner-note-' + viewing.id} as="textarea" maxLength={1000} defaultValue={viewing.owner_note} /><Field label="Suggest another time (Philippine time)" name={'proposed-time-' + viewing.id} type="datetime-local" /></details>}
      <div className="d-flex gap-2 flex-wrap">{!viewing.time_passed && viewing.can_schedule && ((role === 'landlord' && viewing.status === 'requested') || (role === 'student' && viewing.status === 'proposed')) && <button className="btn btn-primary" name="action" value="accept">{role === 'student' ? 'Accept suggested time' : 'Accept viewing'}</button>}{role === 'landlord' && viewing.status !== 'accepted' && <><button className="btn btn-outline-primary" name="action" value="propose" disabled={!viewing.can_schedule}>Suggest another time</button><button className="btn btn-outline-danger" name="action" value="decline">Decline request</button></>}<button className="btn btn-outline-secondary" name="action" value="cancel">Cancel viewing</button></div>
    </fieldset></form>}<div className="viewing-continuation">{role === 'landlord' ? <Link className="btn btn-outline-primary btn-sm" to={'/landlord/properties/' + viewing.property_id}>Manage this listing →</Link> : viewing.can_schedule && <Link className="btn btn-outline-primary btn-sm" to={'/listings/' + viewing.property_id + '?option=' + viewing.room_option_id}>View selected room →</Link>}</div>
  </article>
}

export default function Viewings() {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const focusedViewing = useRef('')
  const page = Math.max(1,Number(params.get('page')) || 1)
  const query = useQuery({ queryKey: ['viewings', user?.id, params.toString()], queryFn: async () => (await api.get('/viewings',{ params: Object.fromEntries(params) })).data })
  useEffect(() => {
    if (!/^#viewing-\d+$/.test(hash)) { focusedViewing.current = ''; return }
    if (!query.data || focusedViewing.current === hash) return
    const target = document.getElementById(hash.slice(1))
    if (!target) return
    focusedViewing.current = hash
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'center' })
  }, [hash, query.data])
  async function refresh() { await Promise.all([query.refetch(),client.invalidateQueries({ queryKey: ['dashboard'] }),client.invalidateQueries({ queryKey: ['notifications'] })]) }
  return <section className="container page-space narrow-page"><span className="eyebrow">SEE THE SPACE BEFORE DECIDING</span><h1>Your property viewings</h1><p>Times are shown in Philippine time (UTC+8). Requests and notes are private to the student and property owner. No room booking or payment is created.</p>
    <label className="form-label" htmlFor="viewing-status">Filter viewing status</label><select id="viewing-status" className="form-select mb-4" value={params.get('status') || ''} onChange={event => setParams(event.target.value ? { status: event.target.value } : {})}><option value="">All viewings</option>{['requested','proposed','accepted','declined','cancelled'].map(status => <option key={status} value={status}>{status}</option>)}</select>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(viewing => <ViewingCard key={viewing.id + ':' + viewing.revision} viewing={viewing} role={user.role} refresh={refresh} />) : <p className="panel">No viewing requests here yet.</p>}
    {query.data?.meta.last_page > 1 && <nav className="d-flex gap-2" aria-label="Viewing pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setParams({ ...Object.fromEntries(params),page: String(page-1) })}>Previous</button><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setParams({ ...Object.fromEntries(params),page: String(page+1) })}>Next</button></nav>}
  </section>
}
