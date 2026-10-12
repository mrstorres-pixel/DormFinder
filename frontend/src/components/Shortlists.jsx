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

export function AddToShortlist({ property, option }) {
  const { data: user } = useCurrentUser()
  const lists = useQuery({ queryKey: ['shortlists', user?.id], enabled: user?.role === 'student', queryFn: async () => (await api.get('/shortlists')).data.data })
  const [choice, setChoice] = useState('')
  const listId = choice || String(lists.data?.[0]?.id || '')
  const mutation = useMutation({ mutationFn: () => writeApi('post', '/shortlists/' + listId + '/items', { property_id: property.id, room_option_id: option.id }) })
  if (user?.role !== 'student') return null
  return <details className="listing-action"><summary>Save to a shortlist</summary><section className="listing-action-body" aria-label="Save selected room to a shortlist"><ErrorNotice error={lists.error || mutation.error} />{lists.isPending ? <Loading /> : lists.data?.length ? <><label className="form-label" htmlFor="listing-shortlist">Save this room option to</label><select id="listing-shortlist" className="form-select mb-2" value={listId} onChange={event => { setChoice(event.target.value); mutation.reset() }}>{lists.data.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select><button className="btn btn-outline-primary" disabled={mutation.isPending || !option} onClick={() => mutation.mutate()}>Save room to shortlist</button>{mutation.isSuccess && <p className="small mt-2" role="status">Room saved to your private shortlist.</p>}</> : <p>Create a named list, then return to save this room option.</p>}<Link className="d-block mt-2" to="/shortlists">Manage shortlists and notes</Link></section></details>
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
  return <article className="panel mb-4"><h2>{listing ? <Link to={'/listings/' + listing.id + '?option=' + optionId}>{listing.title}</Link> : item.listing_snapshot.title}</h2>{listing?.photos[0] && <img className="shortlist-photo" src={listing.photos[0].url} alt={listing.photos[0].caption} loading="lazy" />}
    {!listing && <p className="alert alert-info">This listing is currently unpublished. Your saved title and private notes remain available.</p>}
    <ErrorNotice error={save.error || remove.error} />
    <form onSubmit={event => { event.preventDefault(); save.mutate() }}><fieldset disabled={save.isPending || remove.isPending}>
      {listing ? <><label className="form-label" htmlFor={'saved-option-' + item.id}>Saved room option for {listing.title}</label><select className="form-select mb-3" id={'saved-option-' + item.id} value={optionId} onChange={event => change('option',event.target.value)}>{!option && <option value={optionId}>Previously saved room is unavailable</option>}{listing.room_options.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select>{option && <p>{pesos(option.monthly_fixed_total_centavos)} known monthly · {option.price_basis === 'per_person' ? 'per person' : 'per room'} · {option.available_units} available</p>}</> : <p>Previously saved room: {item.listing_snapshot.room_name}</p>}
      <Field name={'shortlist-note-' + item.id} label={'Private note for ' + (listing?.title || item.listing_snapshot.title)} as="textarea" maxLength={1000} rows={3} value={note} onChange={event => change('note',event.target.value)} />
      <div className="d-flex gap-2 flex-wrap"><button className="btn btn-primary" disabled={!dirty}>{save.isPending ? 'Saving…' : 'Save shortlist notes'}</button>{dirty && <button type="button" className="btn btn-outline-secondary" onClick={() => { clear(); setDraft(null) }}>Discard these edits</button>}<button type="button" className="btn btn-outline-danger" onClick={() => { if (canReplaceOthers() && window.confirm('Remove this saved property and its private note?')) remove.mutate() }}>Remove saved property</button></div>
    </fieldset></form>
    {option && <label className="d-flex gap-2 mt-3"><input type="checkbox" checked={selected} disabled={!selected && compare.selections.length >= 3} onChange={event => compare.choose(item.property_id, option.id, event.target.checked)} />Compare saved {listing.title}</label>}
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
  const create = useMutation({ mutationFn: () => writeApi('post','/shortlists',{ name }), onSuccess: async saved => { clear(); setName(''); await refresh(); setParams({ list: String(saved.id) }) } })
  const remove = useMutation({ mutationFn: () => writeApi('delete','/shortlists/' + id), onSuccess: async () => { setParams({}); await refresh() } })
  return <section className="container page-space"><span className="eyebrow">YOUR OPTIONS, ORGANIZED</span><h1>Private shortlists</h1><p>Group housing options into named lists, keep personal notes, and compare up to three saved rooms. Only your account can access these lists.</p><ErrorNotice error={lists.error || create.error || remove.error} />
    <form className="panel mb-4" onSubmit={event => { event.preventDefault(); if (canReplaceOthers()) create.mutate() }}><fieldset disabled={create.isPending}><Field name="shortlist-name" label="New shortlist name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Near campus or Within budget" /><button className="btn btn-primary">Create shortlist</button></fieldset></form>
    {lists.isPending ? <Loading /> : lists.data?.length ? <><label className="form-label" htmlFor="active-shortlist">Open shortlist</label><select id="active-shortlist" className="form-select mb-4" value={id} onChange={event => setParams({ list: event.target.value })}>{lists.data.map(list => <option key={list.id} value={list.id}>{list.name} ({list.items_count})</option>)}</select><ComparisonTray />
      {detail.isPending ? <Loading /> : detail.error ? <ErrorNotice error={detail.error} retry={() => detail.refetch()} /> : <><h2>{detail.data.name}</h2>{detail.data.items.length ? detail.data.items.map(item => <ShortlistItem key={item.id} item={item} listId={id} refresh={refresh} />) : <p className="panel">Your list is empty. Open a listing and save a room option here.</p>}<button className="btn btn-outline-danger" disabled={remove.isPending} onClick={() => { if (requireSaved() && window.confirm('Delete this entire shortlist and all its private notes?')) remove.mutate() }}>Delete this shortlist</button></>}
    </> : <p>Create your first shortlist to organize your housing search.</p>}<Link className="d-block mt-4" to="/find">Find housing for my campus</Link>
  </section>
}
