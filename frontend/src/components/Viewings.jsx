import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { viewingIso, viewingLabel } from '../lib/practical'
import { ErrorNotice, Field, Loading } from './Feedback'

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
  return <article id={'viewing-' + viewing.id} className="panel mb-4"><h2>{viewing.listing_snapshot.title}</h2><p>{viewing.listing_snapshot.room_name} · With {viewing.participant_name}</p><p><strong>{viewingLabel(viewing.starts_at)}</strong> · One-hour slot</p><p>{viewing.listing_snapshot.address}, {viewing.listing_snapshot.city}</p>{viewing.requested_start && viewing.requested_start !== viewing.starts_at && <p className="small text-secondary">Originally requested: {viewingLabel(viewing.requested_start)}</p>}<p>Status: <strong>{viewing.status === 'requested' ? 'Waiting for owner' : viewing.status === 'proposed' ? 'Owner suggested a new time' : viewing.status}</strong></p>{viewing.status === 'accepted' && <p className="alert alert-success">Time agreed. Confirm the meeting point with the owner before visiting.</p>}
    {viewing.student_note && <p className="preserve-lines">Student note: {viewing.student_note}</p>}{viewing.owner_note && <p className="preserve-lines">Owner note: {viewing.owner_note}</p>}<ErrorNotice error={mutation.error} />{error && <p role="alert">{error}</p>}
    {active && <form onSubmit={decide} onChange={() => setDirty(true)}><fieldset disabled={mutation.isPending}>
      {(!viewing.can_schedule || viewing.time_passed) && <p className="alert alert-info">Scheduling is paused or this time has passed. You can still cancel this request.</p>}
      {role === 'landlord' && viewing.status !== 'accepted' && <><Field label={'Owner note for viewing #' + viewing.id} name={'owner-note-' + viewing.id} as="textarea" maxLength={1000} /><Field label={'Suggest another time for viewing #' + viewing.id + ' (Philippine time)'} name={'proposed-time-' + viewing.id} type="datetime-local" /></>}
      <div className="d-flex gap-2 flex-wrap">{!viewing.time_passed && viewing.can_schedule && ((role === 'landlord' && viewing.status === 'requested') || (role === 'student' && viewing.status === 'proposed')) && <button className="btn btn-primary" name="action" value="accept">{role === 'student' ? 'Accept suggested time' : 'Accept viewing'}</button>}{role === 'landlord' && viewing.status !== 'accepted' && <><button className="btn btn-outline-primary" name="action" value="propose" disabled={!viewing.can_schedule}>Suggest another time</button><button className="btn btn-outline-danger" name="action" value="decline">Decline request</button></>}<button className="btn btn-outline-secondary" name="action" value="cancel">Cancel viewing</button></div>
    </fieldset></form>}
  </article>
}

export default function Viewings() {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1,Number(params.get('page')) || 1)
  const query = useQuery({ queryKey: ['viewings', user?.id, params.toString()], queryFn: async () => (await api.get('/viewings',{ params: Object.fromEntries(params) })).data })
  async function refresh() { await Promise.all([query.refetch(),client.invalidateQueries({ queryKey: ['dashboard'] }),client.invalidateQueries({ queryKey: ['notifications'] })]) }
  return <section className="container page-space narrow-page"><span className="eyebrow">SEE THE SPACE BEFORE DECIDING</span><h1>Your property viewings</h1><p>Times are shown in Philippine time (UTC+8). Requests and notes are private to the student and property owner. No room booking or payment is created.</p>
    <label className="form-label" htmlFor="viewing-status">Filter viewing status</label><select id="viewing-status" className="form-select mb-4" value={params.get('status') || ''} onChange={event => setParams(event.target.value ? { status: event.target.value } : {})}><option value="">All viewings</option>{['requested','proposed','accepted','declined','cancelled'].map(status => <option key={status} value={status}>{status}</option>)}</select>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(viewing => <ViewingCard key={viewing.id + ':' + viewing.revision} viewing={viewing} role={user.role} refresh={refresh} />) : <p className="panel">No viewing requests here yet.</p>}
    {query.data?.meta.last_page > 1 && <nav className="d-flex gap-2" aria-label="Viewing pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setParams({ ...Object.fromEntries(params),page: String(page-1) })}>Previous</button><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setParams({ ...Object.fromEntries(params),page: String(page+1) })}>Next</button></nav>}
    <div className="d-flex gap-3 mt-4"><Link to="/find">Find housing</Link><Link to="/inquiries">Private conversations</Link></div>
  </section>
}
