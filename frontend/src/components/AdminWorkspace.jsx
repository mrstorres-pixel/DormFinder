import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsMutating } from '@tanstack/react-query'
import { useAdminBrowse, adminDate, adminLabel } from '../lib/adminBrowse'
import { AdminLayout, AdminFilterBar, AdminPager, AdminEmpty } from './AdminTools'
import { ErrorNotice, Loading } from './Feedback'
import ActionDialog from './ActionDialog'
import Avatar from './Avatar'

const listingStates = ['', 'draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived'].map(value => [value, value ? adminLabel(value) : 'All statuses'])
const accountStates = [['', 'All statuses'], ['active', 'Active'], ['suspended', 'Suspended']]
const roles = [['', 'All roles'], ['student', 'Students'], ['landlord', 'Property owners']]
const categories = [['', 'All categories'], ['misleading', 'Misleading information'], ['inappropriate', 'Inappropriate content'], ['duplicate', 'Duplicate listing'], ['unavailable', 'No longer available'], ['other', 'Other concern']]
const status = value => <span className={'admin-state state-' + value}>{adminLabel(value)}</span>
const nameSorts = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name_asc', 'Name: A–Z'], ['name_desc', 'Name: Z–A']]
const titleSorts = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['title_asc', 'Listing: A–Z'], ['title_desc', 'Listing: Z–A']]
const types = [['', 'All property types'], ['dormitory', 'Dormitory'], ['apartment', 'Apartment'], ['boarding_house', 'Boarding house'], ['rental_room', 'Rental room']]

export function AdminListings() {
  const browse = useAdminBrowse('admin-properties', '/admin/properties')
  const rows = browse.query.data?.data || []
  return <AdminLayout title="All listings" description="Find a property, check its status and open its review workspace.">
    <AdminFilterBar browse={browse} sorts={titleSorts} filters={[{ name: 'status', label: 'Listing status', options: listingStates }, { name: 'property_type', label: 'Property type', options: types }]} />
    {browse.query.isPending ? <Loading /> : browse.query.error ? <ErrorNotice error={browse.query.error} retry={() => browse.query.refetch()} /> : rows.length ? <div className="admin-table-wrap"><table role="table" className="admin-table"><caption className="visually-hidden">Listings matching your filters</caption><thead><tr><th scope="col">Property</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{rows.map(property => <tr key={property.id}><td><div className="admin-property-cell">{property.photos?.[0]?.url ? <img src={property.photos[0].url} alt="" loading="lazy" /> : <span className="admin-property-placeholder" aria-hidden="true">⌂</span>}<div><strong>{property.title}</strong><small>{property.city} · {adminLabel(property.property_type)}</small></div></div></td><td data-label="Owner">{property.landlord_name || 'Owner #' + property.landlord_id}</td><td data-label="Status">{status(property.status)}</td><td data-label="Updated">{adminDate(property.updated_at)}</td><td><Link className="btn btn-outline-primary btn-sm" to={'/admin/reviews/' + property.id} state={{ adminReturn: '/admin/listings?' + browse.params.toString() }}>Inspect listing<span className="visually-hidden"> {property.title}</span></Link></td></tr>)}</tbody></table></div> : <AdminEmpty title="No matching listings" />}
    {browse.query.data && <AdminPager browse={browse} noun="listings" />}
  </AdminLayout>
}

export function AdminAccounts({ renderAction }) {
  const browse = useAdminBrowse('admin-users', '/admin/users')
  const [selected, setSelected] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const trigger = useRef(null)
  const pending = useIsMutating({ mutationKey: ['admin-account-write'] }) > 0
  const rows = browse.query.data?.data || []
  function close() { if (!pending && (!dirty || window.confirm('Discard your unsaved account action?'))) { setSelected(null); setDirty(false) } }
  return <AdminLayout title="Accounts" description="Find students and property owners. Open an account when a moderation action is needed.">
    {notice && <p className="alert alert-success" role="status">{notice}</p>}
    <AdminFilterBar browse={browse} searchLabel="Search account name or email" sorts={nameSorts} filters={[{ name: 'role', label: 'Account role', options: roles }, { name: 'status', label: 'Account status', options: accountStates }]} />
    {browse.query.isPending ? <Loading /> : browse.query.error ? <ErrorNotice error={browse.query.error} retry={() => browse.query.refetch()} /> : rows.length ? <div className="admin-table-wrap"><table role="table" className="admin-table"><caption className="visually-hidden">Accounts matching your filters</caption><thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{rows.map(user => <tr key={user.id}><td><div className="admin-account-cell"><Avatar name={user.name} size="small" /><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td data-label="Role">{user.role === 'landlord' ? 'Property owner' : 'Student'}</td><td data-label="Status">{status(user.status)}</td><td data-label="Joined">{adminDate(user.created_at)}</td><td><button className="btn btn-outline-primary btn-sm" type="button" aria-label={'Manage account: ' + user.name} onClick={event => { trigger.current = event.currentTarget; setDirty(false); setSelected(user) }}>Manage account</button></td></tr>)}</tbody></table></div> : <AdminEmpty title="No matching accounts" />}
    {browse.query.data && <AdminPager browse={browse} noun="accounts" />}
    {selected && <ActionDialog open title="Manage account" className="admin-action-dialog" returnFocus={trigger} onClose={close}><div className="admin-dialog-person"><Avatar name={selected.name} /><div><h3>{selected.name}</h3><p>{selected.email}</p>{status(selected.status)}</div></div>{renderAction(selected, () => { setSelected(null); setDirty(false); setNotice('Account updated successfully.') }, setDirty)}</ActionDialog>}
  </AdminLayout>
}

export function AdminReports({ renderResolution }) {
  const browse = useAdminBrowse('admin-reports', '/admin/reports', 'oldest')
  const [selected, setSelected] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const trigger = useRef(null)
  const pending = useIsMutating({ mutationKey: ['admin-report-write'] }) > 0
  const rows = browse.query.data?.data || []
  function close() { if (!pending && (!dirty || window.confirm('Discard your unsaved report resolution?'))) { setSelected(null); setDirty(false) } }
  return <AdminLayout title="Listing reports" description="Review student concerns, inspect the property and record a clear outcome.">
    {notice && <p className="alert alert-success" role="status">{notice}</p>}
    <AdminFilterBar browse={browse} searchLabel="Search reports" sorts={titleSorts.slice(0, 2)} filters={[{ name: 'status', label: 'Report status', defaultValue: 'open', options: [['open', 'Open reports'], ['all', 'All statuses'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']] }, { name: 'category', label: 'Concern', options: categories }]} />
    {browse.query.isPending ? <Loading /> : browse.query.error ? <ErrorNotice error={browse.query.error} retry={() => browse.query.refetch()} /> : rows.length ? <div className="admin-table-wrap"><table role="table" className="admin-table"><caption className="visually-hidden">Listing reports matching your filters</caption><thead><tr><th scope="col">Property and concern</th><th scope="col">Reported by</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{rows.map(report => <tr key={report.id}><td><strong>{report.listing_title}</strong><small>{categories.find(([value]) => value === report.category)?.[1] || adminLabel(report.category)}</small><p className="admin-report-preview">{report.body}</p></td><td data-label="Reported by">{report.student_name || 'Student #' + report.student_id}</td><td data-label="Status">{status(report.status)}</td><td data-label="Submitted">{adminDate(report.created_at)}</td><td><button type="button" className="btn btn-outline-primary btn-sm" aria-label={'Review report: ' + report.listing_title} onClick={event => { trigger.current = event.currentTarget; setDirty(false); setSelected(report) }}>Review report</button></td></tr>)}</tbody></table></div> : <AdminEmpty title="No matching reports">{browse.params.size ? 'Try different filters or clear the search.' : 'Student reports will appear here when they need review.'}</AdminEmpty>}
    {browse.query.data && <AdminPager browse={browse} noun="reports" />}
    {selected && <ActionDialog open title="Review report" className="admin-action-dialog" returnFocus={trigger} onClose={close}><h3>{selected.listing_title}</h3><p className="admin-dialog-meta">{selected.student_name || 'Student #' + selected.student_id} · {adminDate(selected.created_at)} · {adminLabel(selected.category)}</p><p className="preserve-lines admin-report-body">{selected.body}</p><Link className="btn btn-outline-primary mb-4" to={'/admin/reviews/' + selected.property_id} state={{ adminReturn: '/admin/reports?' + browse.params.toString() }}>Inspect reported listing</Link>{selected.status === 'open' ? renderResolution(selected, () => { setSelected(null); setDirty(false); setNotice('The report outcome has been saved.') }, setDirty) : <div className="admin-resolution"><strong>{adminLabel(selected.status)}</strong><p className="preserve-lines">{selected.resolution_reason || 'No resolution note recorded.'}</p></div>}</ActionDialog>}
  </AdminLayout>
}

export function AdminAudit() {
  const browse = useAdminBrowse('audit', '/admin/audit')
  const rows = browse.query.data?.data || []
  const actions = ['', 'listing_review', 'listing_status', 'listing_archive', 'listing_restore', 'listing_suspend', 'account_suspend', 'account_reactivate', 'account_listing_hidden', 'report_closed', 'availability_update'].map(value => [value, value ? adminLabel(value) : 'All actions'])
  return <AdminLayout title="Audit history" description="Trace review and moderation decisions. This history is read-only.">
    <AdminFilterBar browse={browse} searchLabel="Search actions, people or listings" dates filters={[{ name: 'action', label: 'Action', options: actions }]} />
    {browse.query.isPending ? <Loading /> : browse.query.error ? <ErrorNotice error={browse.query.error} retry={() => browse.query.refetch()} /> : rows.length ? <div className="admin-audit-list">{rows.map(row => <article className="admin-audit-entry" key={row.id}><div className="admin-audit-icon" aria-hidden="true">✓</div><div><header><h2>{adminLabel(row.action)}</h2><time dateTime={row.created_at}>{row.created_at ? new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Date unavailable'}</time></header><p className="admin-audit-context">{row.actor_name || 'Administrator #' + row.actor_id}{row.listing_title && <> · {row.listing_title}</>}{row.account_name && <> · {row.account_name}</>}</p><p className="admin-audit-transition">{status(row.before_status)}<span aria-hidden="true">→</span>{status(row.after_status)}</p><p className="preserve-lines">{row.reason}</p><div className="admin-audit-links">{row.property_id && <Link to={'/admin/reviews/' + row.property_id} state={{ adminReturn: '/admin/audit?' + browse.params.toString() }}>View listing</Link>}{row.user_id && <Link to={'/admin/users?id=' + row.user_id}>View account</Link>}<span>Revision {row.revision}</span></div></div></article>)}</div> : <AdminEmpty title="No matching activity" />}
    {browse.query.data && <AdminPager browse={browse} noun="actions" />}
  </AdminLayout>
}
