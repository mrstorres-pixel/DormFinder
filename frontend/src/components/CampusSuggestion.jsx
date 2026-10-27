import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi, fieldErrors } from '../lib/api'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { useDirectoryBrowse, adminDate } from '../lib/adminBrowse'
import { AdminPager } from './AdminTools'
import { ErrorNotice, Field, Loading } from './Feedback'
import './campus-management.css'

export default function CampusSuggestion() {
  const [params] = useSearchParams()
  const [values, setValues] = useState({ name: (params.get('name') || '').slice(0, 150), city: '', address: '', source_url: '' })
  const [dirty, setDirty] = useState(false), [sent, setSent] = useState(false)
  const { clear } = useFormChanges(dirty)
  const identity = useRef({ signature: '', id: '' })
  const client = useQueryClient()
  const history = useDirectoryBrowse('my-campus-suggestions', '/campus-suggestions')
  const save = useMutation({ mutationFn: data => writeApi('post', '/campus-suggestions', data), onSuccess: async () => { clear(); setDirty(false); setSent(true); await client.invalidateQueries({ queryKey: ['my-campus-suggestions'] }) } })
  function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))
    const signature = JSON.stringify(data)
    if (identity.current.signature !== signature) identity.current = { signature, id: crypto.randomUUID() }
    save.mutate({ ...data, client_id: identity.current.id })
  }
  return <section className="container page-space campus-suggestion-page"><Link className="back-link" to="/campuses">← Campus directory</Link><header className="page-heading"><div><h1>Suggest a campus</h1><p>Missing a campus or branch? Send its details so an administrator can verify the name and entrance before adding it.</p></div></header><section className="panel"><ErrorNotice error={save.error} />{sent ? <><p className="alert alert-success" role="status">Your campus suggestion has been received. Its review status appears below. Any outcome will also appear in your DormFinder notifications.</p><button className="btn btn-outline-primary" onClick={() => { setValues({ name: '', city: '', address: '', source_url: '' }); setSent(false); save.reset() }}>Suggest another campus</button></> : <form onSubmit={submit}><fieldset disabled={save.isPending}>{[['Campus and branch name', 'name', 150], ['City', 'city', 100], ['Street address or location', 'address', 255], ['University website or source link (optional)', 'source_url', 255]].map(([label, name, maxLength]) => <Field key={name} label={label} name={'suggestion-' + name} value={values[name]} required={name !== 'source_url'} type={name === 'source_url' ? 'url' : 'text'} minLength={name === 'address' ? 5 : name === 'city' ? 2 : name === 'name' ? 3 : undefined} maxLength={maxLength} onChange={event => { setValues(current => ({ ...current, [name]: event.target.value })); setDirty(true) }} error={Object.fromEntries(Object.entries(fieldErrors(save.error)).map(([key, value]) => ['suggestion-' + key, value]))} />)}<button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Sending…' : 'Send suggestion'}</button></fieldset></form>}</section><section className="campus-own-requests" aria-label="Your campus suggestions"><h2>Your suggestions</h2>{history.query.isPending ? <Loading>Loading suggestions…</Loading> : history.query.error ? <ErrorNotice error={history.query.error} retry={() => history.query.refetch()} /> : history.query.data.data.length ? history.query.data.data.map(row => <article key={row.id} className="panel"><div className="section-heading"><h3>{row.name}</h3><span className="admin-status">{({ pending: 'Awaiting review', added: 'Added to directory', duplicate: 'Already listed', declined: 'More information needed' })[row.status]}</span></div><p>{row.city} · Sent {adminDate(row.created_at)}</p>{row.resolution_note && <p>{row.resolution_note}</p>}{row.status === 'declined' && <button type="button" className="btn btn-outline-primary" onClick={() => { if (dirty && !window.confirm('Discard the current unsaved suggestion and reuse these details?')) return; clear(); setDirty(false); setValues({ name: row.name, city: row.city, address: row.address, source_url: row.source_url || '' }); setSent(false); save.reset(); identity.current = { signature: '', id: '' }; requestAnimationFrame(() => document.getElementById('suggestion-name')?.focus()) }}>Update and resubmit</button>}{row.campus_id && <Link to={'/listings?campus_id=' + row.campus_id}>Find places near this campus</Link>}</article>) : <p>Your submitted requests and review outcomes will appear here.</p>}{history.query.data && <AdminPager browse={history} noun="requests" />}</section></section>
}
