import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useComparison } from '../lib/comparison'
import { useFormChanges, useRequireSavedChanges } from '../lib/useUnsavedChanges'
import { safeReturnTo } from '../lib/navigation'
import { savedDraft, refreshSaved } from '../lib/savedPlaces'
import { ErrorNotice, Field, Loading } from './Feedback'
import { ComparisonTray } from './Discovery'
import ActionDialog from './ActionDialog'
import SavedPlaceCard from './SavedPlaceCard'
import './saved-places.css'

export function SavedPlacesRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (params.has('list')) { params.set('collection', params.get('list')); params.delete('list') }
  return <Navigate replace to={'/saved' + (params.size ? '?' + params : '')} />
}

function SavedEditor({ row, collection, collections, open, onClose, onRemoved, reload, returnFocus }) {
  const client = useQueryClient()
  const { data: user } = useCurrentUser()
  const compare = useComparison()
  const [base, setBase] = useState(row)
  const [context, setContext] = useState(String(collection || row.default_context || ''))
  const [values, setValues] = useState(() => savedDraft(row, collection || row.default_context || ''))
  const dirty = JSON.stringify(values) !== JSON.stringify(savedDraft(base, context))
  const { clear, canReplaceOthers } = useFormChanges(dirty)
  const mutation = useMutation({ mutationFn: data => writeApi('patch', '/saved-places/' + row.property_id, data), onSuccess: async fresh => {
    clear(); setBase(fresh); setValues(savedDraft(fresh, context))
    if (compare.selections.some(item => item.property_id === row.property_id)) {
      const option = Number(values.room)
      if (fresh.listing?.room_options.some(item => item.id === option)) compare.choose(row.property_id, option)
      else compare.choose(row.property_id, 0, false)
    }
    client.setQueryData(['saved-place', user.id, row.property_id], fresh)
    await refreshSaved(client)
  } })
  const remove = useMutation({ mutationFn: () => writeApi('delete', '/saved-places/' + row.property_id, { version: base.version }), onSuccess: async () => { clear(); compare.choose(row.property_id, 0, false); onRemoved(); await refreshSaved(client) } })
  function switchContext(value) {
    if (dirty && !window.confirm('Discard your unsaved edits before switching these saved details?')) return
    clear(); setContext(value); setValues(savedDraft(base, value)); mutation.reset()
  }
  function submit(event) {
    event.preventDefault()
    if (!canReplaceOthers()) return
    const removed = base.contexts.filter(item => !values.collections.includes(item.collection_id))
    if (removed.length && !window.confirm('Remove this place from ' + removed.map(item => item.collection_name).join(', ') + '? Notes stored in those collections will be deleted.')) return
    mutation.mutate({ version: base.version, context_id: Number(context) || null, note: values.note, room_option_id: Number(values.room) || null, collection_ids: values.collections, confirm_remove: !!removed.length })
  }
  async function reloadDetails() {
    if (dirty && !window.confirm('Discard your edits and load the current saved details?')) return
    const fresh = await reload()
    if (!fresh) return
    clear(); const next = fresh.contexts.some(item => String(item.collection_id) === context) ? context : ''
    setBase(fresh); setContext(next); setValues(savedDraft(fresh, next)); mutation.reset(); remove.reset()
  }
  const listing = base.listing
  const snapshot = context ? base.contexts.find(item => String(item.collection_id) === context)?.listing_snapshot : base.listing_snapshot
  return <ActionDialog open={open} title="Saved place" onClose={onClose} returnFocus={returnFocus}>
    <p className="action-room-context"><strong>{listing?.title || snapshot?.title || base.listing_snapshot.title}</strong><span>{listing ? listing.city : 'Listing currently unavailable'}</span></p>
    <ErrorNotice error={mutation.error || remove.error} />{(mutation.error?.response?.status === 409 || remove.error?.response?.status === 409) && <button type="button" className="btn btn-outline-primary mb-3" onClick={reloadDetails}>Reload saved details</button>}
    <form onSubmit={submit}><fieldset disabled={mutation.isPending || remove.isPending}>
      {base.contexts.length > 0 && <><label htmlFor="saved-detail-context" className="form-label">Details for</label><select id="saved-detail-context" className="form-select mb-3" value={context} onChange={event => switchContext(event.target.value)}><option value="">This saved place</option>{base.contexts.map(item => <option key={item.collection_id} value={item.collection_id}>{item.collection_name}</option>)}</select></>}
      <label className="form-label" htmlFor="saved-room-choice">Room option</label><select className="form-select mb-3" id="saved-room-choice" value={values.room} onChange={event => setValues(current => ({ ...current, room: event.target.value }))} disabled={!listing}>
        <option value="">No room chosen yet</option>{values.room && !listing?.room_options.some(item => String(item.id) === values.room) && <option value={values.room}>{snapshot?.room_name || 'Previously saved room'} · unavailable</option>}{listing?.room_options.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      <Field name="saved-note" label="Your private note" as="textarea" rows={3} maxLength={1000} value={values.note} onChange={event => setValues(current => ({ ...current, note: event.target.value }))} placeholder="What would you like to remember?" />
      <fieldset className="saved-collection-picker"><legend>Collections <span>optional</span></legend>{collections.length ? collections.map(item => <label key={item.id}><input type="checkbox" checked={values.collections.includes(item.id)} disabled={String(item.id) === context} onChange={event => setValues(current => ({ ...current, collections: (event.target.checked ? [...current.collections, item.id] : current.collections.filter(id => id !== item.id)).sort((a, b) => a - b) }))} />{item.name}</label>) : <p className="small text-secondary">No collections yet. You can save without one.</p>}</fieldset>
      <div className="saved-editor-actions"><button className="btn btn-primary" disabled={!dirty}>{mutation.isPending ? 'Saving…' : 'Save changes'}</button>{dirty && <button type="button" className="btn btn-outline-primary" onClick={() => { clear(); setValues(savedDraft(base, context)); mutation.reset() }}>Discard edits</button>}</div>
      {mutation.isSuccess && !dirty && <p role="status" className="saved-editor-status">Saved changes.</p>}
      <button type="button" className="saved-remove" onClick={() => { if (canReplaceOthers() && window.confirm('Remove this place from Saved places and every collection? Its saved notes' + (dirty ? ' and your unsaved edits' : '') + ' will be deleted.')) remove.mutate() }}>Remove saved place</button>
    </fieldset></form>
  </ActionDialog>
}

function NewCollection({ open, onClose, returnFocus }) {
  const [name, setName] = useState('')
  const { clear, canReplaceOthers } = useFormChanges(!!name)
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: () => writeApi('post', '/shortlists', { name }), onSuccess: async () => { clear(); setName(''); await refreshSaved(client); onClose() } })
  return <ActionDialog title="New collection" open={open} onClose={onClose} returnFocus={returnFocus}><form onSubmit={event => { event.preventDefault(); if (canReplaceOthers()) mutation.mutate() }}><ErrorNotice error={mutation.error} /><Field label="Collection name" name="collection-name" required maxLength={80} placeholder="e.g. Near campus" value={name} disabled={mutation.isPending} onChange={event => setName(event.target.value)} /><button className="btn btn-primary w-100" disabled={mutation.isPending || !name.trim()}>Create collection</button></form></ActionDialog>
}

export default function SavedPlaces() {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const requireSaved = useRequireSavedChanges()
  const [editorId, setEditorId] = useState(() => Number(params.get('place')) || null)
  const [editorOpen, setEditorOpen] = useState(!!editorId)
  const [newOpen, setNewOpen] = useState(false)
  const editTrigger = useRef(null), collectionTrigger = useRef(null)
  const collection = params.get('collection') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const lists = useQuery({ queryKey: ['shortlists', user?.id], queryFn: async () => (await api.get('/shortlists')).data.data, retry: false })
  const query = useQuery({ queryKey: ['saved-places', user?.id, collection, page], queryFn: async () => (await api.get('/saved-places', { params: { collection: collection || undefined, page } })).data, retry: false, refetchOnWindowFocus: !editorOpen && !newOpen })
  const detail = useQuery({ queryKey: ['saved-place', user?.id, editorId], queryFn: async () => (await api.get('/saved-places/' + editorId)).data.data, enabled: !!editorId && !!user, retry: false, refetchOnWindowFocus: false })
  const removeCollection = useMutation({ mutationFn: () => writeApi('delete', '/shortlists/' + collection, { empty_only: true }), onSuccess: async () => { setParams({}); await refreshSaved(client) } })
  function edit(id, trigger) { if (id !== editorId && !requireSaved()) return; editTrigger.current = trigger; setEditorId(id); setEditorOpen(true) }
  function filter(id) { setParams(id ? { collection: String(id) } : {}) }
  const returnPath = safeReturnTo(params.get('returnTo'), '')
  return <section className="saved-places-page"><header className="saved-page-heading"><div><h1>Saved places</h1><p>Your possibilities, together.</p></div><button ref={collectionTrigger} className="btn btn-outline-primary" onClick={() => setNewOpen(true)}>＋ New collection</button></header>
    {returnPath && /^\/listings\/\d+(?:[?#]|$)/.test(returnPath) && <Link className="btn btn-outline-primary mb-3" to={returnPath}>Return to selected room</Link>}
    <ErrorNotice error={lists.error || removeCollection.error} retry={lists.error ? () => lists.refetch() : undefined} />
    <nav className="saved-collection-tabs" aria-label="Saved collections"><button type="button" aria-current={!collection ? 'page' : undefined} onClick={() => filter('')}>All saved</button>{lists.data?.map(item => <button type="button" key={item.id} aria-current={String(item.id) === collection ? 'page' : undefined} onClick={() => filter(item.id)}>{item.name}</button>)}</nav>
    <ComparisonTray />
    {query.isPending ? <Loading>Loading saved places…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? <div className="saved-places-grid">{query.data.data.map(row => <SavedPlaceCard key={row.property_id} row={row} collection={collection} onEdit={edit} />)}</div> : <div className="saved-page-empty"><span aria-hidden="true">♡</span><h2>{collection ? 'This collection is ready for your places.' : 'Keep a few possibilities.'}</h2><p>{collection ? 'Edit a saved place to add it here.' : 'Save a place while you browse. Organize it whenever you want.'}</p><Link className="btn btn-primary" to="/listings">Browse places</Link>{collection && <button className="btn btn-outline-primary" onClick={() => { if (requireSaved() && window.confirm('Delete this empty collection?')) removeCollection.mutate() }}>Delete empty collection</button>}</div>}
    {query.data?.meta?.last_page > 1 && <nav className="saved-pages" aria-label="Saved place pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page - 1)); return next })}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page + 1)); return next })}>Next</button></nav>}
    <NewCollection open={newOpen} onClose={() => setNewOpen(false)} returnFocus={collectionTrigger} />
    {editorId && detail.isPending && editorOpen && <p role="status">Opening saved details…</p>}{detail.error && editorOpen && <ErrorNotice error={detail.error} retry={() => detail.refetch()} />}
    {detail.data && <SavedEditor key={user.id + ':' + editorId} row={detail.data} collection={collection} collections={lists.data || []} open={editorOpen} returnFocus={editTrigger} onClose={() => setEditorOpen(false)} onRemoved={() => { setEditorOpen(false); setEditorId(null) }} reload={async () => { const result = await detail.refetch(); return result.error ? null : result.data }} />}
  </section>
}
