import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { ErrorNotice, Field, Loading } from './Feedback'
import useUnsavedChanges, { useFormChanges } from '../lib/useUnsavedChanges'
import DashboardActions from './DashboardActions'
import './admin-navigation.css'
import { AdminAccounts, AdminReports, AdminAudit, AdminListings as ListingDirectory } from './AdminWorkspace'
export { AdminNavigation } from './AdminTools'

const labels = { upcoming_viewings: 'Upcoming viewings', pending_viewings: 'Viewing decisions waiting', awaiting_reply: 'Awaiting your reply', shortlists: 'Private shortlists', stale_listings: 'Availability needs updating', older_reviews: 'Reviews waiting over two days', pending_reviews: 'Pending reviews', open_reports: 'Open reports', published_listings: 'Published listings', active_students: 'Active students', active_landlords: 'Active landlords', suspended_accounts: 'Suspended accounts', unread_notifications: 'Unread notifications', inquiries: 'Your inquiries', favorites: 'Saved listings' }

export function DashboardCounts({ actionsFirst = false }) {
  const { data: user } = useCurrentUser()
  const query = useQuery({ queryKey: ['dashboard', user?.id], queryFn: async () => (await api.get('/dashboard')).data.data, enabled: !!user })
  if (query.isPending) return <Loading>Loading your counts…</Loading>
  if (query.error) return <ErrorNotice error={query.error} retry={() => query.refetch()} />
  const destinations = { upcoming_viewings: '/viewings?status=accepted', pending_viewings: user.role === 'student' ? '/viewings?status=proposed' : '/viewings?status=requested', awaiting_reply: '/inquiries', shortlists: '/shortlists', stale_listings: '/landlord', older_reviews: '/admin', unread_notifications: '/notifications', inquiries: '/inquiries', favorites: '/favorites', open_reports: user.role === 'admin' ? '/admin/reports' : '/reports', pending_reviews: '/admin', published_listings: '/listings', active_students: '/admin/users', active_landlords: '/admin/users', suspended_accounts: '/admin/users' }
  const values = Object.entries(query.data).flatMap(([key, value]) => key === 'listings' ? Object.entries(value).map(([status, total]) => [status.replaceAll('_', ' ') + ' listings', total, '/landlord']) : [[labels[key] || key, value, destinations[key]]])
  const counts = <dl className="dashboard-counts">{values.map(([label, value, to]) => <div className="panel" key={label}><dt>{to ? <Link to={to}>{label}</Link> : label}</dt><dd>{value}</dd></div>)}</dl>
  const actions = <DashboardActions user={user} counts={query.data} />
  return actionsFirst ? <>{actions}<h2 className="activity-heading">Your activity at a glance</h2>{counts}</> : <>{counts}{actions}</>

}

function Pages({ data, page, setPage }) {
  const last = data?.meta?.last_page ?? data?.last_page ?? 1
  if (last <= 1) return null
  return <nav aria-label="Result pages" className="d-flex align-items-center gap-3 mt-4"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {last}</span><button className="btn btn-outline-primary" disabled={page >= last} onClick={() => setPage(page + 1)}>Next</button></nav>
}

export function ReportForm({ property }) {
  const [dirty, setDirty] = useState(false)
  const clearUnsaved = useUnsavedChanges(dirty)
  const [identity, setIdentity] = useState({ signature: '', id: '' })
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: data => writeApi('post', '/listings/' + property.id + '/reports', data), onSuccess: () => { clearUnsaved(); setDirty(false); client.invalidateQueries({ queryKey: ['reports'] }); client.invalidateQueries({ queryKey: ['dashboard'] }) } })
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    values.body = values.body.trim()
    const signature = JSON.stringify(values)
    const id = identity.signature === signature ? identity.id : crypto.randomUUID()
    setIdentity({ signature, id })
    mutation.mutate({ ...values, client_id: id })
  }
  return <details className="panel mt-4"><summary>Report this listing</summary><p className="small mt-3">Tell administrators about misleading content or another concern. Your report is private. Do not include passwords or private inquiry messages.</p><ErrorNotice error={mutation.error} />{mutation.isSuccess ? <p role="status">Your report has been received. <Link to="/reports">View your reports</Link></p> : <form onChange={() => setDirty(true)} onSubmit={submit}><fieldset disabled={mutation.isPending}><label className="form-label" htmlFor="report-category">Concern</label><select className="form-select mb-3" id="report-category" name="category"><option value="misleading">Misleading information</option><option value="inappropriate">Inappropriate content</option><option value="duplicate">Duplicate listing</option><option value="unavailable">No longer available</option><option value="other">Other concern</option></select><Field label="Report details" name="body" as="textarea" required minLength={10} maxLength={2000} rows={3} /><button className="btn btn-outline-danger" disabled={mutation.isPending}>Send listing report</button></fieldset></form>}</details>
}

export function StudentReports() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['reports', page], queryFn: async () => (await api.get('/reports', { params: { page } })).data })
  return <section className="container page-space"><h1>Your reports</h1><p>Only you and administrators can read your report details. A report does not automatically hide a listing.</p>{query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? query.data.data.map(report => <article className="panel mb-3" key={report.id}><h2>{report.listing_title}</h2><p>Report #{report.id} · <strong>{report.status}</strong> · {report.category}</p><p className="preserve-lines">{report.body}</p><p className="small">Submitted {new Date(report.created_at).toLocaleString('en-PH')}</p></article>) : <p>No reports yet.</p>}<Pages data={query.data} page={page} setPage={setPage} /></section>
}

function ResolutionForm({ report, onSaved, onDirtyChange }) {
  const [dirty, setDirty] = useState(false)
  const clearUnsaved = useUnsavedChanges(dirty)
  const client = useQueryClient()
  const mutation = useMutation({ mutationKey: ['admin-report-write'], mutationFn: values => writeApi('post', '/admin/reports/' + report.id + '/resolve', { status: values.status, reason: values['reason-' + report.id], revision: report.revision }), onSuccess: () => { clearUnsaved(); setDirty(false); client.invalidateQueries({ queryKey: ['admin-reports'] }); client.invalidateQueries({ queryKey: ['audit'] }); client.invalidateQueries({ queryKey: ['dashboard'] }); onDirtyChange?.(false); onSaved?.() } })
  return <form onChange={() => { setDirty(true); onDirtyChange?.(true) }} onSubmit={event => { event.preventDefault(); mutation.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={mutation.isPending}><ErrorNotice error={mutation.error} /><label className="form-label" htmlFor={'resolution-' + report.id}>Report outcome</label><select id={'resolution-' + report.id} name="status" className="form-select mb-3"><option value="resolved">Resolved after handling the concern</option><option value="dismissed">Dismissed after review</option></select><Field label="Private resolution notes" name={'reason-' + report.id} as="textarea" required minLength={10} maxLength={2000} /><p className="small">Closing a report records the outcome. Use listing or account controls separately when a restriction is needed.</p><button className="btn btn-primary" disabled={mutation.isPending}>Close report #{report.id}</button></fieldset></form>
}

export function ReportQueue() {
  return <AdminReports renderResolution={(report, onSaved, onDirtyChange) => <ResolutionForm key={report.id} report={report} onSaved={onSaved} onDirtyChange={onDirtyChange} />} />
}

export function LifecycleControls({ property, admin = false }) {
  const client = useQueryClient()
  const form = useRef(null)
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const [confirmed, setConfirmed] = useState(false)
  const actions = admin ? (['archived', 'suspended'].includes(property.status) ? ['restore', ...(property.status === 'suspended' ? ['archive'] : [])] : ['suspend', 'archive']) : property.status === 'archived' ? ['restore'] : property.status !== 'suspended' ? ['archive'] : []
  const mutation = useMutation({ mutationKey: ['property-write', property.id], mutationFn: values => writeApi('post', admin ? '/admin/properties/' + property.id + '/moderation' : '/landlord/properties/' + property.id + '/lifecycle', { action: values.action, reason: values['listing-reason'], revision: property.revision }), onSuccess: async data => { clearUnsaved(); setDirty(false); form.current?.reset(); setConfirmed(false); client.setQueryData([admin ? 'review' : 'property', String(property.id)], data); await Promise.all(['properties', 'admin-properties', 'reviews', 'listings', 'audit', 'dashboard', 'notifications'].map(key => client.invalidateQueries({ queryKey: [key] }))) } })
  return <section className="panel mt-4"><h2>{admin ? 'Listing moderation' : 'Archive and restore'}</h2><p>Current status: <strong>{property.status.replaceAll('_', ' ')}</strong></p>{admin && <Link to={'/admin/users?id=' + property.landlord_id}>Manage owner account</Link>}<p className="small">Archiving hides the listing and preserves inquiry history. Suspension also freezes replies. Restoration creates a draft that must pass review again.</p><ErrorNotice error={mutation.error} />{actions.length ? <form ref={form} onChange={() => setDirty(true)} onSubmit={event => { event.preventDefault(); if (!canReplaceOthers()) return; mutation.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={mutation.isPending}><label className="form-label" htmlFor="listing-action">Listing action</label><select className="form-select mb-3" id="listing-action" name="action">{actions.map(action => <option key={action} value={action}>{action === 'restore' ? 'Restore to draft' : action === 'archive' ? 'Archive listing' : 'Suspend listing'}</option>)}</select><Field label="Reason for listing action" name="listing-reason" as="textarea" required minLength={10} maxLength={2000} /><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I understand how this listing action affects publication and replies.</span></label><button className="btn btn-outline-danger" disabled={!confirmed || mutation.isPending}>Apply listing action</button></fieldset></form> : <p>Only an administrator can restore a suspended listing.</p>}</section>
}

function AccountAction({ user, onSaved, onDirtyChange }) {
  const client = useQueryClient()
  const form = useRef(null)
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const [confirmed, setConfirmed] = useState(false)
  const action = user.status === 'active' ? 'suspend' : 'reactivate'
  const mutation = useMutation({ mutationKey: ['admin-account-write'], mutationFn: values => writeApi('post', '/admin/users/' + user.id + '/moderation', { reason: values.reason, revision: user.moderation_revision, action }), onSuccess: async () => { clearUnsaved(); setDirty(false); form.current?.reset(); setConfirmed(false); await Promise.all(['admin-users', 'admin-properties', 'reviews', 'listings', 'audit', 'dashboard', 'notifications'].map(key => client.invalidateQueries({ queryKey: [key] }))); onDirtyChange?.(false); onSaved?.() } })
  return <form ref={form} onChange={() => { setDirty(true); onDirtyChange?.(true) }} onSubmit={event => { event.preventDefault(); if (!canReplaceOthers()) return; const values = Object.fromEntries(new FormData(event.currentTarget)); mutation.mutate({ reason: values['account-reason-' + user.id] }) }}><fieldset disabled={mutation.isPending}><ErrorNotice error={mutation.error} /><Field label={'Reason for account action #' + user.id} name={'account-reason-' + user.id} as="textarea" required minLength={10} maxLength={2000} /><p className="small">Suspension revokes sessions, freezes replies, and hides published or pending listings. Reactivation requires a new login; hidden listings remain drafts.</p><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Confirm {action} account #{user.id}</span></label><button className="btn btn-outline-danger" disabled={!confirmed || mutation.isPending}>{action === 'suspend' ? 'Suspend' : 'Reactivate'} account #{user.id}</button></fieldset></form>
}

export function AccountModeration() {
  return <AdminAccounts renderAction={(user, onSaved, onDirtyChange) => <AccountAction key={user.id} user={user} onSaved={onSaved} onDirtyChange={onDirtyChange} />} />
}

export function AdminListings() { return <ListingDirectory /> }
export function AuditHistory() { return <AdminAudit /> }

export function Notifications() {
  const { data: user } = useCurrentUser()
  const to = user?.role === 'admin' ? '/admin' : user?.role === 'landlord' ? '/landlord' : '/account'
  return <Navigate to={to} replace state={{ notifications: 'expanded' }} />
}
