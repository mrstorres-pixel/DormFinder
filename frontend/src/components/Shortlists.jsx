import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useComparison } from '../lib/comparison'
import { useFormChanges, useRequireSavedChanges } from '../lib/useUnsavedChanges'
import { pesos } from '../lib/money'
import { ErrorNotice, Field, Loading } from './Feedback'
import { ComparisonTray } from './Discovery'
import PropertyContext from './PropertyContext'
import { safeReturnTo } from '../lib/navigation'

export function AddToShortlist({ property, option }) {
  const { data: user } = useCurrentUser()
  const lists = useQuery({ queryKey: ['shortlists', user?.id], enabled: user?.role === 'student', queryFn: async () => (await api.get('/shortlists')).data.data })
  const [choice, setChoice] = useState('')
  const listId = choice || String(lists.data?.[0]?.id || '')
  const mutation = useMutation({ mutationFn: () => writeApi('post', '/shortlists/' + listId + '/items', { property_id: property.id, room_option_id: option.id }) })
  if (user?.role !== 'student') return null
  return <details className="listing-action"><summary>Save to a shortlist</summary><section className="listing-action-body" aria-label="Save selected room to a shortlist"><ErrorNotice error={lists.error || mutation.error} />{lists.isPending ? <Loading /> : lists.data?.length ? <><label className="form-label" htmlFor="listing-shortlist">Save this room option to</label><select id="listing-shortlist" className="form-select mb-2" value={listId} onChange={event => { setChoice(event.target.value); mutation.reset() }}>{lists.data.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select><button className="btn btn-outline-primary" disabled={mutation.isPending || !option} onClick={() => mutation.mutate()}>Save room to shortlist</button>{mutation.isSuccess && <p className="small mt-2" role="status">Room saved to your private shortlist.</p>}</> : <p>Create a named list, then return to save this room option.</p>}<Link className="d-block mt-2" to={'/shortlists?returnTo=' + encodeURIComponent('/listings/' + property.id + '?option=' + option.id + (property.distance_from_campus?.campus_id ? '&campus_id=' + property.distance_from_campus.campus_id : ''))}>Manage shortlists and notes</Link></section></details>
}

function ShortlistItem({ item, listId, refresh }) {
  const [draft, setDraft] = useState(null)
  const listing = item.listing
  const note = draft?.note ?? item.note
  const optionId = draft?.option ?? String(item.room_option_id || '')
  const dirty = note !== item.note || optionId !== String(item.room_option_id || '')
  const { clear, canReplaceOthers } = useFormChanges(dirty)
  const compare = useComparison()
  const option = listing?.room_options.find(room => room.id === Number(optionId))
  const selected = compare.selections.some(row => row.property_id === item.property_id)
  const save = useMutation({ mutationFn: () => writeApi('patch', '/shortlists/' + listId + '/items/' + item.id, { note, room_option_id: Number(optionId) || null, revision: draft?.revision ?? item.revision }), onSuccess: async () => { clear(); await refresh(); setDraft(null) } })
  const remove = useMutation({ mutationFn: () => writeApi('delete', '/shortlists/' + listId + '/items/' + item.id, { revision: item.revision }), onSuccess: () => { clear(); return refresh() } })
  function change(field,value) { setDraft({ note, option: optionId, revision: draft?.revision ?? item.revision, [field]: value }); if (field === 'option' && selected) compare.choose(item.property_id, Number(value)) }
  return <article className="panel shortlist-item mb-4"><div className="shortlist-item-heading">{listing?.photos[0] && <img className="shortlist-photo" src={listing.photos[0].url} alt={listing.photos[0].caption} loading="lazy" />}<PropertyContext title={listing?.title || item.listing_snapshot.title} room={option?.name || item.listing_snapshot.room_name} to={listing ? '/listings/' + listing.id + '?option=' + optionId : undefined} address={listing ? listing.city : undefined} />{listing?.is_demo && <span className="workspace-demo">Synthetic demo</span>}</div>
    {!listing && <p className="alert alert-info">This listing is currently unpublished. Your saved title and private notes remain available.</p>}
    <ErrorNotice error={save.error || remove.error} />
    <form onSubmit={event => { event.preventDefault(); save.mutate() }}><fieldset disabled={save.isPending || remove.isPending}>
      {listing ? <><label className="form-label" htmlFor={'saved-option-' + item.id}>Saved room option<span className="visually-hidden"> for {listing.title}</span></label><select className="form-select mb-3" id={'saved-option-' + item.id} value={optionId} onChange={event => change('option',event.target.value)}>{!option && <option value={optionId}>Previously saved room is unavailable</option>}{listing.room_options.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select>{option && <p>{pesos(option.monthly_fixed_total_centavos)} known monthly · {option.price_basis === 'per_person' ? 'per person' : 'per room'} · {option.available_units} available</p>}</> : <p>Previously saved room: {item.listing_snapshot.room_name}</p>}
<details className="shortlist-note"><summary>Edit your private note</summary>
      <Field name={'shortlist-note-' + item.id} label={'Private note for ' + (listing?.title || item.listing_snapshot.title)} as="textarea" maxLength={1000} rows={3} value={note} onChange={event => change('note',event.target.value)} />
      <div className="d-flex gap-2 flex-wrap"><button className="btn btn-primary" disabled={!dirty}>{save.isPending ? 'Saving…' : 'Save shortlist notes'}</button>{dirty && <button type="button" className="btn btn-outline-secondary" onClick={() => { clear(); setDraft(null) }}>Discard these edits</button>}<button type="button" className="btn btn-outline-danger" onClick={() => { if (canReplaceOthers() && window.confirm('Remove this saved property and its private note?')) remove.mutate() }}>Remove saved property</button></div>
    </details></fieldset></form>
    {note && <p className="note-preview">{note.length > 140 ? note.slice(0, 140) + '…' : note}</p>}{dirty && <p className="small text-secondary">Unsaved changes — open your note to save or discard.</p>}<div className="shortlist-continuation">{option && <Link to={'/listings/' + item.property_id + '?option=' + option.id + '#request-viewing'}>Arrange a viewing →</Link>}{option && <label className="d-flex gap-2 mt-3"><input type="checkbox" checked={selected} disabled={!selected && compare.selections.length >= 3} onChange={event => compare.choose(item.property_id, option.id, event.target.checked)} />Compare saved {listing.title}</label>}</div>
  </article>
}

export default function Shortlists() {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [name, setName] = useState('')
  const { clear, canReplaceOthers } = useFormChanges(name.length > 0)
  const requireSaved = useRequireSavedChanges()
  const lists = useQuery({ queryKey: ['shortlists', user?.id], queryFn: async () => (await api.get('/shortlists')).data.data })
  const id = params.get('list') || String(lists.data?.[0]?.id || '')
  const detail = useQuery({ queryKey: ['shortlist', id], enabled: !!id, refetchInterval: 240_000, queryFn: async () => (await api.get('/shortlists/' + id)).data.data })
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey: ['shortlists'] }),client.invalidateQueries({ queryKey: ['shortlist', id] }),client.invalidateQueries({ queryKey: ['dashboard'] })]) }
  const create = useMutation({ mutationFn: () => writeApi('post','/shortlists',{ name }), onSuccess: async saved => { clear(); setName(''); await refresh(); setParams(current => { const next = new URLSearchParams(current); next.set('list', String(saved.id)); return next }) } })
  const remove = useMutation({ mutationFn: () => writeApi('delete','/shortlists/' + id), onSuccess: async () => { setParams({}); await refresh() } })
  const returnPath = safeReturnTo(params.get('returnTo'), '')
  const roomReturn = /^\/listings\/\d+(?:[?#]|$)/.test(returnPath) ? returnPath : ''
  return <section className="container page-space saved-workspace"><div className="page-heading"><div><span className="eyebrow">YOUR OPTIONS, TOGETHER</span><h1>Private shortlists</h1><p>Keep the rooms you like, add a private note, and compare when you're ready.</p></div><Link className="btn btn-outline-primary" to="/find">Find more rooms →</Link></div><ErrorNotice error={lists.error || create.error || remove.error} />
    {roomReturn && <div className="return-to-room"><span>{create.isSuccess ? 'Your shortlist is ready. Return to save the room you were exploring.' : 'Create or open a shortlist, then return to your selected room.'}</span><Link to={roomReturn}>Return to selected room →</Link></div>}
    <div className="saved-workspace-layout"><aside className="saved-workspace-sidebar"><h2>Your lists</h2>{lists.isPending ? <Loading /> : lists.data?.length ? <div className="saved-list-links">{lists.data.map(list => <button key={list.id} className={String(list.id) === id ? 'is-current' : ''} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('list', String(list.id)); return next })}><span>{list.name}</span><small>{list.items_count} {list.items_count === 1 ? 'room' : 'rooms'}</small></button>)}</div> : <p className="small text-secondary">Your first list starts here.</p>}
    <form className="new-shortlist-form" onSubmit={event => { event.preventDefault(); if (canReplaceOthers()) create.mutate() }}><fieldset disabled={create.isPending}><Field name="shortlist-name" label="New shortlist name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Near campus" /><button className="btn btn-primary">Create shortlist</button></fieldset></form><Link className="saved-favorites-link" to="/favorites">Open quick favorites →</Link></aside>
    <div className="saved-workspace-main"><ComparisonTray />{lists.data?.length ? detail.isPending ? <Loading /> : detail.error ? <ErrorNotice error={detail.error} retry={() => detail.refetch()} /> : <><div className="saved-list-heading"><h2>{detail.data.name}</h2><span>{detail.data.items.length} saved {detail.data.items.length === 1 ? 'room' : 'rooms'}</span></div>{detail.data.items.length ? detail.data.items.map(item => <ShortlistItem key={item.id} item={item} listId={id} refresh={refresh} />) : <div className="saved-empty"><span aria-hidden="true">♡</span><h3>Make room for your favorites.</h3><p>Open a listing and save its room option to this list.</p><Link to="/listings">Explore rooms →</Link></div>}<button className="btn btn-link shortlist-delete" disabled={remove.isPending} onClick={() => { if (requireSaved() && window.confirm('Delete this entire shortlist and all its private notes?')) remove.mutate() }}>Delete this shortlist</button></> : !lists.isPending && <div className="saved-empty"><span aria-hidden="true">♡</span><h2>A few good options, in one place.</h2><p>Create a list, then save rooms as you explore. Your notes stay private to your account.</p></div>}</div></div>
  </section>
}
