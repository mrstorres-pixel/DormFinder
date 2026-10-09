import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { ErrorNotice, Field, Loading } from './Feedback'

const labels = { pending_reviews: 'Pending reviews', open_reports: 'Open reports', published_listings: 'Published listings', active_students: 'Active students', active_landlords: 'Active landlords', suspended_accounts: 'Suspended accounts', unread_notifications: 'Unread notifications', inquiries: 'Your inquiries', favorites: 'Saved listings' }

export function DashboardCounts() {
  const { data: user } = useCurrentUser()
  const query = useQuery({ queryKey: ['dashboard', user?.id], queryFn: async () => (await api.get('/dashboard')).data.data, enabled: !!user })
  if (query.isPending) return <Loading>Loading your counts…</Loading>
  if (query.error) return <ErrorNotice error={query.error} retry={() => query.refetch()} />
  const values = Object.entries(query.data).flatMap(([key, value]) => key === 'listings' ? Object.entries(value).map(([status, total]) => [status.replaceAll('_', ' ') + ' listings', total]) : [[labels[key] || key, value]])
  return <dl className="dashboard-counts">{values.map(([label, value]) => <div className="panel" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

export function AdminNavigation() {
  return <nav aria-label="Administrator sections" className="d-flex gap-3 flex-wrap mb-4"><Link to="/admin">Reviews</Link><Link to="/admin/reports">Reports</Link><Link to="/admin/listings">All listings</Link><Link to="/admin/users">Accounts</Link><Link to="/admin/audit">Audit history</Link></nav>
}

function Pages({ data, page, setPage }) {
  const last = data?.meta?.last_page ?? data?.last_page ?? 1
  if (last <= 1) return null
  return <nav aria-label="Result pages" className="d-flex align-items-center gap-3 mt-4"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {last}</span><button className="btn btn-outline-primary" disabled={page >= last} onClick={() => setPage(page + 1)}>Next</button></nav>
}

export function ReportForm({ property }) {
  const [identity, setIdentity] = useState({ signature: '', id: '' })
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: data => writeApi('post', '/listings/' + property.id + '/reports', data), onSuccess: () => { client.invalidateQueries({ queryKey: ['reports'] }); client.invalidateQueries({ queryKey: ['dashboard'] }) } })
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    values.body = values.body.trim()
    const signature = JSON.stringify(values)
    const id = identity.signature === signature ? identity.id : crypto.randomUUID()
    setIdentity({ signature, id })
    mutation.mutate({ ...values, client_id: id })
  }
  return <details className="panel mt-4"><summary>Report this listing</summary><p className="small mt-3">Tell administrators about misleading content or another concern. Your report is private. Do not include passwords or private inquiry messages.</p><ErrorNotice error={mutation.error} />{mutation.isSuccess ? <p role="status">Your report has been received. <Link to="/reports">View your reports</Link></p> : <form onSubmit={submit}><label className="form-label" htmlFor="report-category">Concern</label><select className="form-select mb-3" id="report-category" name="category"><option value="misleading">Misleading information</option><option value="inappropriate">Inappropriate content</option><option value="duplicate">Duplicate listing</option><option value="unavailable">No longer available</option><option value="other">Other concern</option></select><Field label="Report details" name="body" as="textarea" required minLength={10} maxLength={2000} rows={3} /><button className="btn btn-outline-danger" disabled={mutation.isPending}>Send listing report</button></form>}</details>
}

export function StudentReports() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['reports', page], queryFn: async () => (await api.get('/reports', { params: { page } })).data })
  return <section className="container page-space"><h1>Your reports</h1><p>Only you and administrators can read your report details. A report does not automatically hide a listing.</p>{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(report => <article className="panel mb-3" key={report.id}><h2>{report.listing_title}</h2><p>Report #{report.id} · <strong>{report.status}</strong> · {report.category}</p><p className="preserve-lines">{report.body}</p><p className="small">Submitted {new Date(report.created_at).toLocaleString('en-PH')}</p></article>) : <p>No reports yet.</p>}<Pages data={query.data} page={page} setPage={setPage} /></section>
}

function ResolutionForm({ report }) {
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: values => writeApi('post', '/admin/reports/' + report.id + '/resolve', { status: values.status, reason: values['reason-' + report.id], revision: report.revision }), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-reports'] }); client.invalidateQueries({ queryKey: ['audit'] }); client.invalidateQueries({ queryKey: ['dashboard'] }) } })
  return <form onSubmit={event => { event.preventDefault(); mutation.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><ErrorNotice error={mutation.error} /><label className="form-label" htmlFor={'resolution-' + report.id}>Report outcome</label><select id={'resolution-' + report.id} name="status" className="form-select mb-3"><option value="resolved">Resolved after handling the concern</option><option value="dismissed">Dismissed after review</option></select><Field label="Private resolution notes" name={'reason-' + report.id} as="textarea" required minLength={10} maxLength={2000} /><p className="small">Closing a report records the outcome. Use listing or account controls separately when a restriction is needed.</p><button className="btn btn-primary" disabled={mutation.isPending}>Close report #{report.id}</button></form>
}

export function ReportQueue() {
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['admin-reports', status, page], queryFn: async () => (await api.get('/admin/reports', { params: { status, page } })).data })
  return <section className="container page-space"><AdminNavigation /><h1>Listing reports</h1><label className="form-label" htmlFor="report-status">Report status</label><select id="report-status" className="form-select mb-4" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>{['open', 'resolved', 'dismissed'].map(value => <option key={value} value={value}>{value}</option>)}</select>{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(report => <article className="panel mb-4" key={report.id}><h2>{report.listing_title}</h2><p>Report #{report.id} · Student #{report.student_id} · {report.category} · {report.status}</p><p className="preserve-lines">{report.body}</p><Link to={'/admin/reviews/' + report.property_id}>Inspect reported listing</Link>{report.status === 'open' ? <div className="mt-3"><ResolutionForm report={report} /></div> : <p className="preserve-lines mt-3">{report.resolution_reason}</p>}</article>) : <p>No {status} reports.</p>}<Pages data={query.data} page={page} setPage={setPage} /></section>
}

export function LifecycleControls({ property, admin = false }) {
  const client = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const actions = admin ? (['archived', 'suspended'].includes(property.status) ? ['restore', ...(property.status === 'suspended' ? ['archive'] : [])] : ['suspend', 'archive']) : property.status === 'archived' ? ['restore'] : property.status !== 'suspended' ? ['archive'] : []
  const mutation = useMutation({ mutationFn: values => writeApi('post', admin ? '/admin/properties/' + property.id + '/moderation' : '/landlord/properties/' + property.id + '/lifecycle', { action: values.action, reason: values['listing-reason'], revision: property.revision }), onSuccess: async data => { setConfirmed(false); client.setQueryData([admin ? 'review' : 'property', String(property.id)], data); await Promise.all(['properties', 'admin-properties', 'reviews', 'listings', 'audit', 'dashboard', 'notifications'].map(key => client.invalidateQueries({ queryKey: [key] }))) } })
  return <section className="panel mt-4"><h2>{admin ? 'Listing moderation' : 'Archive and restore'}</h2><p>Current status: <strong>{property.status.replaceAll('_', ' ')}</strong></p>{admin && <Link to={'/admin/users?id=' + property.landlord_id}>Manage owner account</Link>}<p className="small">Archiving hides the listing and preserves inquiry history. Suspension also freezes replies. Restoration creates a draft that must pass review again.</p><ErrorNotice error={mutation.error} />{actions.length ? <form key={property.revision} onSubmit={event => { event.preventDefault(); mutation.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><label className="form-label" htmlFor="listing-action">Listing action</label><select className="form-select mb-3" id="listing-action" name="action">{actions.map(action => <option key={action} value={action}>{action === 'restore' ? 'Restore to draft' : action === 'archive' ? 'Archive listing' : 'Suspend listing'}</option>)}</select><Field label="Reason for listing action" name="listing-reason" as="textarea" required minLength={10} maxLength={2000} /><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I understand how this listing action affects publication and replies.</span></label><button className="btn btn-outline-danger" disabled={!confirmed || mutation.isPending}>Apply listing action</button></form> : <p>Only an administrator can restore a suspended listing.</p>}</section>
}

function AccountAction({ user }) {
  const client = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const action = user.status === 'active' ? 'suspend' : 'reactivate'
  const mutation = useMutation({ mutationFn: values => writeApi('post', '/admin/users/' + user.id + '/moderation', { reason: values.reason, revision: user.moderation_revision, action }), onSuccess: async () => { setConfirmed(false); await Promise.all(['admin-users', 'admin-properties', 'reviews', 'listings', 'audit', 'dashboard', 'notifications'].map(key => client.invalidateQueries({ queryKey: [key] }))) } })
  return <form onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); mutation.mutate({ reason: values['account-reason-' + user.id] }) }}><ErrorNotice error={mutation.error} /><Field label={'Reason for account action #' + user.id} name={'account-reason-' + user.id} as="textarea" required minLength={10} maxLength={2000} /><p className="small">Suspension revokes sessions, freezes replies, and hides published or pending listings. Reactivation requires a new login; hidden listings remain drafts.</p><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Confirm {action} account #{user.id}</span></label><button className="btn btn-outline-danger" disabled={!confirmed || mutation.isPending}>{action === 'suspend' ? 'Suspend' : 'Reactivate'} account #{user.id}</button></form>
}

export function AccountModeration() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = useQuery({ queryKey: ['admin-users', params.toString()], queryFn: async () => (await api.get('/admin/users', { params: Object.fromEntries(params) })).data })
  return <section className="container page-space"><AdminNavigation /><h1>Account moderation</h1><form className="panel mb-4" onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setParams(Object.fromEntries(Object.entries(values).filter(([, value]) => value))) }}><Field label="Search account name or email" name="q" defaultValue={params.get('q') || ''} maxLength={100} /><button className="btn btn-outline-primary">Find accounts</button></form>{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(user => <article className="panel mb-4" key={user.id}><h2>{user.name}</h2><p>Account #{user.id} · {user.email} · {user.role} · <strong>{user.status}</strong></p><AccountAction key={user.moderation_revision} user={user} /></article>) : <p>No accounts found.</p>}<Pages data={query.data} page={page} setPage={next => setParams(current => { const result = new URLSearchParams(current); result.set('page', String(next)); return result })} /></section>
}

export function AdminListings() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['admin-properties', status, page], queryFn: async () => (await api.get('/admin/properties', { params: { status: status || undefined, page } })).data })
  return <section className="container page-space"><AdminNavigation /><h1>All listings</h1><label className="form-label" htmlFor="listing-status">Listing status</label><select id="listing-status" className="form-select mb-4" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(property => <article className="panel mb-3" key={property.id}><h2>{property.title}</h2><p>{property.status.replaceAll('_', ' ')} · Owner #{property.landlord_id}</p><Link to={'/admin/reviews/' + property.id}>Inspect and moderate listing</Link></article>) : <p>No listings found.</p>}<Pages data={query.data} page={page} setPage={setPage} /></section>
}

export function AuditHistory() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['audit', page], queryFn: async () => (await api.get('/admin/audit', { params: { page } })).data })
  return <section className="container page-space"><AdminNavigation /><h1>Audit history</h1><p>Recorded review and moderation actions. Inquiry messages are private to their participants.</p>{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(row => <article className="panel mb-3" key={row.id}><h2 className="h5">{row.action.replaceAll('_', ' ')}</h2><p>Actor #{row.actor_id} · {new Date(row.created_at).toLocaleString('en-PH')} · {row.before_status} → {row.after_status}</p><p>{row.property_id && 'Listing #' + row.property_id + ' · '}{row.user_id && 'Account #' + row.user_id + ' · '}Revision {row.revision}</p><p className="preserve-lines">{row.reason}</p></article>) : <p>No recorded actions yet.</p>}<Pages data={query.data} page={page} setPage={setPage} /></section>
}

export function Notifications() {
  const { data: user } = useCurrentUser()
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['notifications', user?.id, page], queryFn: async () => (await api.get('/notifications', { params: { page } })).data })
  const mutation = useMutation({ mutationFn: id => writeApi('put', '/notifications/' + id + '/read'), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['notifications'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }) } })
  return <section className="container page-space"><h1>Your notifications</h1><p>Updates appear here when you visit. Private inquiry notifications do not include message previews.</p><ErrorNotice error={mutation.error} />{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(row => <article className="panel mb-3" key={row.id}><h2 className="h5">{row.title}</h2><p>{row.read_at ? 'Read' : 'Unread'} · {new Date(row.created_at).toLocaleString('en-PH')}</p><div className="d-flex gap-3 align-items-center"><Link to={row.path}>View update</Link>{!row.read_at && <button className="btn btn-sm btn-outline-primary" disabled={mutation.isPending} onClick={() => mutation.mutate(row.id)}>Mark notification #{row.id} read</button>}</div></article>) : <p>No notifications yet.</p>}<Pages data={query.data} page={page} setPage={setPage} /></section>
}
