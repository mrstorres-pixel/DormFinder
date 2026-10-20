import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useFormChanges, useRequireSavedChanges } from '../lib/useUnsavedChanges'
import { viewingIso, viewingLabel } from '../lib/practical'
import { pesos } from '../lib/money'
import { ErrorNotice, Field, Loading } from './Feedback'
import Avatar from './Avatar'
import ActionDialog from './ActionDialog'
import { ListingCover } from './HomeListingCard'
import './appointments.css'
import ViewingCalendar from './ViewingCalendar'
import { calendarMonth, loadViewingMonth, monthDays, philippineDate } from '../lib/viewingCalendar'

function stateLabel(viewing, role) {
  if (viewing.status === 'requested') return role === 'landlord' ? 'New viewing request' : 'Waiting for owner'
  if (viewing.status === 'proposed') return role === 'landlord' ? 'Waiting for student' : 'New time suggested'
  if (viewing.status === 'accepted') return viewing.time_passed ? 'Past visit' : 'Confirmed visit'
  return viewing.status === 'cancelled' ? 'Cancelled' : 'Declined'
}

export function RequestViewing({ property, option, onDirtyChange }) {
  const trigger = useRef(null)
  const client = useQueryClient()
  const { hash } = useLocation()
  const form = useRef(null)
  const [open, setOpen] = useState(hash === '#request-viewing')
  const [dirty, setDirty] = useState(false)
  const { clear } = useFormChanges(dirty)
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  const [identity, setIdentity] = useState({ signature: '', id: '' })
  const [error, setError] = useState('')
  const existing = useQuery({ queryKey: ['viewings', 'listing', property.id], queryFn: async () => (await api.get('/viewings', { params: { property_id: property.id, active: 1 } })).data.data, retry: false })
  const mutation = useMutation({ mutationFn: data => writeApi('post', '/listings/' + property.id + '/viewings', data), onSuccess: saved => { clear(); setDirty(false); client.setQueryData(['viewings', 'listing', property.id], [saved]); client.invalidateQueries({ queryKey: ['viewings'] }); client.invalidateQueries({ queryKey: ['dashboard'] }) } })
  const active = existing.data?.[0]
  function send(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    let starts_at
    try { starts_at = viewingIso(values.time); setError('') } catch (e) { setError(e.message); return }
    const data = { starts_at, note: values.note.trim(), room_option_id: option.id }
    const signature = JSON.stringify(data)
    const id = identity.signature === signature && identity.id ? identity.id : crypto.randomUUID()
    setIdentity({ signature, id }); mutation.mutate({ ...data, client_id: id })
  }
  const destination = active ? '/viewings?group=' + (active.status === 'accepted' ? 'upcoming' : 'requests') + '#viewing-' + active.id : '/viewings?group=requests'
  return <><div id="request-viewing" className="listing-visit-action">{active ? <div className="listing-request-state"><p role="status"><strong>{mutation.isSuccess ? 'Viewing requested' : 'You have a viewing request'}</strong><span>{stateLabel(active, 'student')} · {active.listing_snapshot.room_name}</span></p><Link className="btn btn-primary" to={destination}>View request</Link></div> : <button type="button" className="btn btn-primary" disabled={option.available_units === 0 || existing.isPending || !!existing.error} onClick={event => { trigger.current = event.currentTarget; setOpen(true) }}>Request a viewing</button>}
    {existing.error && <ErrorNotice error={existing.error} retry={() => existing.refetch()} />}{option.available_units === 0 && !active && <p className="action-fine-print">This room is sold out. You can still message the owner.</p>}</div>
    <div className="listing-mobile-action"><span><strong>{pesos(option.monthly_rent_centavos).replace(/\.00$/, '')}</strong><small>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</small></span>{active ? <Link className="btn btn-primary" to={destination}>View request</Link> : <button type="button" className="btn btn-primary" aria-label="Request a viewing for selected room" disabled={option.available_units === 0 || existing.isPending || !!existing.error} onClick={event => { trigger.current = event.currentTarget; setOpen(true) }}>Request a viewing</button>}</div>
    <ActionDialog returnFocus={trigger} open={open} title="Request a viewing" onClose={() => setOpen(false)}><p className="action-room-context"><strong>{property.title}</strong><span>{option.name} · {option.capacity}-person room</span></p>
      {active ? <div className="viewing-success"><p role="status">Viewing requested. {stateLabel(active, 'student')}.</p><p>{viewingLabel(active.starts_at)}</p><Link className="btn btn-primary" to={destination}>View request</Link><button className="btn btn-outline-primary" onClick={() => setOpen(false)}>Done</button></div> : <><ErrorNotice error={mutation.error} />{mutation.error?.response?.status === 409 && <Link className="btn btn-outline-primary mb-3" to="/viewings?group=requests">Review existing requests</Link>}{error && <p role="alert">{error}</p>}<form ref={form} onSubmit={send} onChange={() => setDirty(true)}><fieldset disabled={mutation.isPending || option.available_units === 0 || existing.isPending || !!existing.error}><Field label="Preferred viewing time (Philippine time, UTC+8)" name="time" type="datetime-local" required /><Field label="Viewing note for the owner" name="note" as="textarea" rows={2} maxLength={1000} /><p className="action-fine-print">One-hour visit · Choose 30 minutes to 90 days ahead. The owner must confirm. No reservation or payment.</p><button className="btn btn-primary w-100">{mutation.isPending ? 'Sending…' : 'Send viewing request'}</button>{dirty && <button type="button" className="btn btn-link" onClick={() => { clear(); setDirty(false); form.current?.reset(); setIdentity({ signature: '', id: '' }); setError('') }}>Discard viewing draft</button>}</fieldset></form></>}
    </ActionDialog></>
}

function AppointmentPhoto({ viewing }) {
  return <div className="appointment-photo">{viewing.property_preview ? <ListingCover property={viewing.property_preview} /> : <span className="appointment-photo-placeholder">Photos unavailable</span>}</div>
}

function ViewingDetails({ viewing, role, refresh, back, onDirtyChange, focused }) {
  const [dirty, setDirty] = useState(false)
  const { clear } = useFormChanges(dirty)
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  const [error, setError] = useState('')
  const heading = useRef(null)
  const proposal = useRef(null)
  useEffect(() => { if (focused) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'start' }) } }, [focused])
  const mutation = useMutation({ mutationFn: data => writeApi('patch', '/viewings/' + viewing.id, { ...data, revision: viewing.revision }), onSuccess: async () => { clear(); setDirty(false); await refresh() } })
  const active = ['requested', 'proposed', 'accepted'].includes(viewing.status)
  function decide(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const action = event.nativeEvent.submitter.value
    const data = { action }
    if (form.has('owner-note-' + viewing.id)) data.note = form.get('owner-note-' + viewing.id)
    if (action === 'propose') {
      try { data.starts_at = viewingIso(form.get('proposed-time-' + viewing.id)); setError('') } catch (e) { setError(e.message); return }
    }
    if (['cancel', 'decline'].includes(action) && !window.confirm(action === 'cancel' ? 'Cancel this viewing request?' : 'Decline this viewing request?')) return
    mutation.mutate(data)
  }
  const decisions = <>
    <ErrorNotice error={mutation.error} />{error && <p role="alert">{error}</p>}
    {active && <form onSubmit={decide} onChange={() => setDirty(true)}><fieldset disabled={mutation.isPending}>
      {(!viewing.can_schedule || viewing.time_passed) && <p className="appointment-paused">{viewing.time_passed ? 'This time has passed.' : 'Scheduling is paused.'} You can still cancel this request.</p>}
      {role === 'landlord' && viewing.status !== 'accepted' && <details ref={proposal} className="viewing-proposal"><summary>Suggest a different time or add a note</summary><Field label="Message for the student" name={'owner-note-' + viewing.id} as="textarea" maxLength={1000} defaultValue={viewing.owner_note} /><Field label="Suggest another time (Philippine time)" name={'proposed-time-' + viewing.id} type="datetime-local" /></details>}
      <div className="appointment-decisions">{!viewing.time_passed && viewing.can_schedule && ((role === 'landlord' && viewing.status === 'requested') || (role === 'student' && viewing.status === 'proposed')) && <button className="btn btn-primary" name="action" value="accept">{role === 'student' ? 'Accept suggested time' : 'Accept viewing'}</button>}{role === 'landlord' && viewing.status !== 'accepted' && <><button className="btn btn-outline-primary" name="action" value="propose" disabled={!viewing.can_schedule} onClick={event => { if (proposal.current && !proposal.current.open) { event.preventDefault(); proposal.current.open = true; proposal.current.querySelector('input')?.focus() } }}>Suggest another time</button><button className="btn btn-outline-danger" name="action" value="decline">Decline request</button></>}<button className="appointment-cancel" name="action" value="cancel">Cancel viewing</button></div>
    </fieldset></form>}
  </>
  return <article id={'viewing-' + viewing.id} ref={heading} tabIndex={-1} className="appointment-details" aria-label="Viewing details">
    <button type="button" className="appointment-back" onClick={back}>← Back to viewings</button><AppointmentPhoto viewing={viewing} />
    <div className="appointment-detail-content"><span className={'appointment-state state-' + viewing.status}>{stateLabel(viewing, role)}</span><h2>{viewing.listing_snapshot.title}</h2><p className="appointment-room">{viewing.listing_snapshot.room_name}</p>
    <div className="appointment-date"><span aria-hidden="true">◷</span><div><strong>{viewingLabel(viewing.starts_at)}</strong><small>One-hour visit · Philippine time</small></div></div>
    {viewing.status !== 'accepted' && decisions}
    <div className="appointment-person"><Avatar src={viewing.participant_avatar_url} name={viewing.participant_name} /><div><strong>{viewing.participant_name}</strong><small>{role === 'student' ? 'Property owner' : 'Student'}</small></div></div>
    <div className="appointment-address"><h3>Meeting address</h3><p>{viewing.listing_snapshot.address}, {viewing.listing_snapshot.city}</p>{viewing.status === 'accepted' && !viewing.time_passed && <small>Confirm the meeting point with the owner before visiting.</small>}</div>
    {(viewing.student_note || viewing.owner_note || viewing.requested_start !== viewing.starts_at) && <section className="appointment-notes" aria-label="Request notes">{viewing.student_note && <div><h3>Student note</h3><p className="preserve-lines">{viewing.student_note}</p></div>}{viewing.owner_note && <div><h3>Owner note</h3><p className="preserve-lines">{viewing.owner_note}</p></div>}{viewing.requested_start !== viewing.starts_at && <small>Originally requested: {viewingLabel(viewing.requested_start)}</small>}</section>}
    {viewing.status === 'accepted' && decisions}
    <div className="appointment-context-actions">{viewing.conversation_id ? <Link className="btn btn-outline-primary" to={'/inquiries/' + viewing.conversation_id}>{role === 'student' ? 'Message owner' : 'Message student'}</Link> : role === 'student' && viewing.can_schedule ? <Link className="btn btn-outline-primary" to={'/listings/' + viewing.property_id + '?option=' + viewing.room_option_id + '#message-owner'}>Message owner</Link> : null}{role === 'landlord' ? <Link className="btn btn-outline-primary" to={'/landlord/properties/' + viewing.property_id}>Manage listing</Link> : viewing.property_preview && <Link className="btn btn-outline-primary" to={'/listings/' + viewing.property_id + '?option=' + viewing.room_option_id}>View selected room</Link>}</div>
    </div>
  </article>
}

export default function Appointments() {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const requireSaved = useRequireSavedChanges()
  const [editing, setEditing] = useState(false)
  const legacy = params.get('status')
  const group = ['upcoming', 'requests', 'history'].includes(params.get('group')) ? params.get('group') : legacy ? ['requested', 'proposed'].includes(legacy) ? 'requests' : legacy === 'accepted' ? 'upcoming' : 'history' : 'upcoming'
  const calendar = params.get('mode') === 'calendar'
  const month = calendarMonth(params.get('month'))
  const day = monthDays(month).days.includes(params.get('day')) ? params.get('day') : null
  const monthQuery = useQuery({ queryKey: ['viewings', 'calendar', user?.id, month], queryFn: ({ signal }) => loadViewingMonth(api, month, signal), enabled: !!user && calendar, retry: false, refetchInterval: editing ? false : 15_000, refetchOnWindowFocus: !editing })
  const dayRows = (monthQuery.data || []).filter(row => !day || philippineDate(row.starts_at) === day)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const requestedId = /^\d+$/.test(params.get('viewing') || '') ? params.get('viewing') : /^#viewing-\d+$/.test(location.hash) ? location.hash.slice(9) : null
  const query = useQuery({ queryKey: ['viewings', 'workspace', user?.id, group, legacy, page], queryFn: async () => (await api.get('/viewings', { params: legacy ? { group, status: legacy, page } : { group, page } })).data, enabled: !!user && !calendar, retry: false, refetchInterval: editing ? false : 15_000, refetchOnWindowFocus: !editing })
  const listingQuery = calendar ? { ...monthQuery, data: monthQuery.data ? { data: dayRows } : undefined } : query
  const selectedId = requestedId || listingQuery.data?.data[0]?.id
  const selected = useQuery({ queryKey: ['viewings', 'detail', user?.id, String(selectedId)], queryFn: async () => (await api.get('/viewings', { params: { id: selectedId } })).data.data.find(row => String(row.id) === String(selectedId)) || null, enabled: !!user && !!selectedId, retry: false, refetchInterval: editing ? false : 15_000, refetchOnWindowFocus: !editing })
  const viewing = selected.data || listingQuery.data?.data.find(row => String(row.id) === String(selectedId))
  function pick(id) { if (requireSaved()) { const next = new URLSearchParams(params); next.set('viewing', String(id)); navigate({ search: '?' + next, hash: '' }) } }
  function back() { if (requireSaved()) { const next = new URLSearchParams(params); next.delete('viewing'); navigate({ search: '?' + next, hash: '' }) } }
  function changeCalendar(monthValue, dayValue) { if (requireSaved()) { setParams({ mode: 'calendar', month: monthValue, ...(dayValue ? { day: dayValue } : {}) }) } }
  function changeMode(value) { if (requireSaved()) { setParams(value === 'calendar' ? { mode: value, month } : { group }) } }
  function changeGroup(value) { setParams({ group: value }) }
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey: ['viewings'] }), client.invalidateQueries({ queryKey: ['dashboard'] }), client.invalidateQueries({ queryKey: ['notifications'] })]) }
  return <section data-tour="viewings" className={'viewings-workspace' + (requestedId ? ' has-selection' : '')}><header className="viewings-heading"><h1>Viewings</h1><p>Your visits, one step closer.</p></header>
    <div className="viewing-mode" aria-label="Viewing layout"><button aria-pressed={!calendar} onClick={() => changeMode('list')}>List</button><button aria-pressed={calendar} onClick={() => changeMode('calendar')}>Calendar</button></div>
    {calendar ? <><ErrorNotice error={monthQuery.error} retry={() => monthQuery.refetch()} /><ViewingCalendar month={month} day={day} rows={monthQuery.data || []} loading={monthQuery.isFetching} onMonth={changeCalendar} onDay={date => changeCalendar(month, date)} /><div className="calendar-agenda-heading"><h2>{day ? new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'Asia/Manila' }).format(new Date(day + 'T12:00:00+08:00')) : 'This month'}</h2>{day && <button onClick={() => changeCalendar(month)}>Show whole month</button>}</div></> : <nav className="viewing-tabs" aria-label="Viewing sections">{[['upcoming', 'Upcoming'], ['requests', 'Requests'], ['history', 'History']].map(([value, label]) => <button type="button" key={value} aria-current={group === value ? 'page' : undefined} onClick={() => changeGroup(value)}>{label}</button>)}</nav>}
    <div className="appointments-layout"><div className="appointments-list" aria-label="Viewing appointments">{listingQuery.isPending ? <Loading /> : listingQuery.error ? <ErrorNotice error={listingQuery.error} retry={() => listingQuery.refetch()} /> : listingQuery.data.data.length ? listingQuery.data.data.map(item => <button type="button" className={'appointment-card' + (String(item.id) === String(selectedId) ? ' is-selected' : '')} aria-pressed={String(item.id) === String(selectedId)} onClick={() => pick(item.id)} key={item.id}><AppointmentPhoto viewing={item} /><div className="appointment-card-copy"><span className={'appointment-state state-' + item.status}>{stateLabel(item, user?.role)}</span><h2>{item.listing_snapshot.title}</h2><p>{item.listing_snapshot.room_name}</p><time dateTime={item.starts_at}>{viewingLabel(item.starts_at)}</time><div className="appointment-card-person"><Avatar src={item.participant_avatar_url} name={item.participant_name} size="small" /><span>{item.participant_name}</span></div></div></button>) : <div className="appointments-empty"><span aria-hidden="true">◷</span><h2>{calendar ? 'No visits on these dates' : group === 'upcoming' ? 'No upcoming visits' : group === 'requests' ? 'No requests waiting' : 'No viewing history yet'}</h2><p>{calendar ? 'Choose another day or month to see your visits.' : group === 'upcoming' ? 'Visits appear here when a time is agreed.' : group === 'requests' ? 'New requests and suggested times appear here.' : 'Past, cancelled and declined visits stay here.'}</p>{!calendar && group === 'upcoming' && <button className="btn btn-outline-primary" onClick={() => changeGroup('requests')}>Check requests</button>}</div>}
      {!calendar && query.data?.meta?.last_page > 1 && <nav className="appointment-pages" aria-label="Viewing pages"><button disabled={page <= 1} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page - 1)); return next })}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button disabled={page >= query.data.meta.last_page} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page + 1)); return next })}>Next</button></nav>}
    </div><div className="appointment-detail-pane">{selected.error ? <ErrorNotice error={selected.error} retry={() => selected.refetch()} /> : viewing ? <ViewingDetails key={viewing.id + ':' + viewing.revision} viewing={viewing} role={user?.role} refresh={refresh} back={back} onDirtyChange={setEditing} focused={!!requestedId} /> : selected.isFetching ? <Loading /> : <div className="appointment-detail-empty"><span aria-hidden="true">◷</span><p>{requestedId ? 'This viewing is unavailable to your account.' : 'Select a visit to see its details.'}</p>{requestedId && <button className="btn btn-outline-primary" onClick={back}>Back to viewings</button>}</div>}</div></div>
  </section>
}
