import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useDirectoryBrowse, adminDate } from '../lib/adminBrowse'
import { listingReadiness } from '../lib/listingReadiness'
import { ownerInventory, ownerListingState, ownerSorts, ownerStatuses } from '../lib/ownerWorkspace'
import { AdminFilterBar as DirectoryFilterBar, AdminPager as DirectoryPager, AdminResultsHeader as DirectoryResultsHeader, AdminListingImage as PropertyImage } from './AdminTools'
import { ErrorNotice, Loading } from './Feedback'
import { OwnerAvailability } from './AvailabilityStatus'
import OwnerListingActions from './OwnerListingActions'
import OwnerAvailabilityPanel from './OwnerAvailabilityPanel'

const propertyViews = [['active', 'Properties'], ['attention', 'Needs attention'], ['archived', 'Archived']]

export default function OwnerDirectory() {
  const location = useLocation()
  const navigate = useNavigate()
  const browse = useDirectoryBrowse('properties', '/landlord/properties', 'newest', { view: 'active' })
  const { params, query } = browse
  const rows = query.data?.data || []
  const workspacePath = '/landlord' + (params.size ? '?' + params.toString() : '')
  const filtered = ['q', 'status', 'availability', 'owner_state'].some(key => params.get(key))
  const removed = params.get('view') === 'archived'
  return <section className="container page-space owner-listings" data-tour="owner-workspace">
    <header className="page-heading owner-workspace-heading"><div><span className="eyebrow">PROPERTY OWNER WORKSPACE</span><h1>Your properties</h1><p>Prepare your listings, keep vacancies accurate and follow up with students.</p></div><Link to="/landlord/properties/new" className="btn btn-primary" data-tour="add-property">Add a property</Link></header>
    {location.state?.notice && <div className="owner-workspace-notice"><p className="alert alert-success" role="status">{location.state.notice}</p><div>{Number.isInteger(location.state.savedPropertyId) && <Link to={'/landlord/properties/' + location.state.savedPropertyId}>Continue editing the saved draft</Link>}<button type="button" className="btn btn-link btn-sm" onClick={() => navigate(workspacePath, { replace: true, state: { ...location.state, notice: null, savedPropertyId: null } })}>Dismiss confirmation</button></div></div>}
    <OwnerTasks />
    <section className="owner-property-directory" aria-labelledby="owner-property-directory-title"><h2 id="owner-property-directory-title" className="owner-directory-title">Manage your properties</h2>
      <nav className="owner-property-views" aria-label="Property views">{propertyViews.map(([value, label]) => {
        const current = (params.get('view') || 'active') === value
        return <button type="button" key={value} aria-current={current ? 'page' : undefined} onClick={() => browse.update({ view: value, status: '', owner_state: '', availability: '' })}>{label}</button>
      })}</nav>
      <DirectoryFilterBar browse={browse} searchLabel="Search your properties" sorts={ownerSorts} filters={[
        { name: 'view', hidden: true, label: 'Show properties', defaultValue: 'active', options: [['active', 'Current properties'], ['archived', 'Archived properties'], ['all', 'All properties']] },
        { name: 'status', hidden: true, label: 'Listing status', options: ownerStatuses },
        { name: 'owner_state', label: 'Property status', hidden: removed, options: [['', 'All statuses'], ['draft', 'Draft'], ['pending_review', 'Awaiting review'], ['live', 'Live'], ['taken', 'Fully occupied'], ['paused', 'Paused'], ['rejected', 'Changes requested'], ['suspended', 'Restricted'], ['expired', 'Hidden: confirmation expired'], ['location_check', 'Location needs correction']] },
        { name: 'availability', hidden: true, label: 'Availability', options: [['', 'All availability'], ['needs_confirmation', 'Needs confirmation'], ['taken', 'All rooms taken']] },
      ]} />
      <DirectoryResultsHeader browse={browse} noun="properties" order={ownerSorts.find(([value]) => value === (params.get('sort') || 'newest'))?.[1]} />
      {query.isPending ? <Loading>Loading your properties…</Loading> : query.error && !query.data ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rows.length ? <div className={'owner-property-grid' + (rows.length === 1 ? ' is-single' : rows.length === 2 ? ' is-pair' : '')}>{rows.map(property => <OwnerPropertyCard key={property.id} property={property} workspacePath={workspacePath} refreshedAt={query.dataUpdatedAt} />)}</div> : <div className="owner-empty panel"><h3>{filtered ? 'No properties match this view' : browse.page > 1 ? 'No properties on this page' : removed ? 'No archived properties' : 'Create your first property draft'}</h3><p>{filtered ? 'Try a different name, address or city, or reset the filters.' : removed ? 'Properties you remove are kept here with their photos and conversation history.' : browse.page > 1 ? 'Return to the first page to see your current results.' : 'Start with a name and city. We’ll guide you through photos, rooms, location and review.'}</p><div>{browse.page > 1 && <button type="button" className="btn btn-outline-primary" onClick={() => browse.setPage(1)}>Back to first page</button>}{filtered || removed ? <button type="button" className="btn btn-outline-primary" onClick={browse.clear}>Show current properties</button> : browse.page === 1 && <Link className="btn btn-primary" to="/landlord/properties/new">Create your first draft</Link>}</div></div>}
      {query.data && <DirectoryPager browse={browse} noun="properties" announceRange={false} />}
    </section>
  </section>
}

function OwnerTasks() {
  const { data: user } = useCurrentUser()
  const { data, error } = useQuery({ queryKey: ['dashboard', user?.id], enabled: user?.role === 'landlord', queryFn: async () => (await api.get('/dashboard')).data.data, staleTime: 30_000, retry: false })
  const tasks = [
    ['locations_need_correction', 'Check property locations', 'Correct pins outside our Philippines service area.', '/landlord?owner_state=location_check'],
    ['stale_listings', 'Availability updates', 'Confirm rooms that are due for an update.', '/landlord?availability=needs_confirmation'],
    ['awaiting_reply', 'Messages awaiting your reply', 'Follow up on student inquiries.', '/inquiries'],
    ['pending_viewings', 'Viewing requests', 'Review proposed visits and respond.', '/viewings'],
  ]
  if (!error && (!data || tasks.every(([key]) => !data[key]))) return null
  return <section className="owner-task-section" aria-labelledby="owner-task-title"><h2 id="owner-task-title">What needs attention</h2><div className="owner-task-grid">{tasks.filter(([key]) => Number.isInteger(data?.[key]) && data[key] > 0).map(([key, title, hint, path]) => <Link key={key} to={path}><div><h3>{title}</h3><p>{hint}</p></div>{Number.isInteger(data?.[key]) && <strong>{data[key]}</strong>}<span className="owner-task-open" aria-hidden="true">↗</span></Link>)}</div>{error && <p className="owner-fine-print">Workspace totals are unavailable. Your property list is still available below.</p>}</section>
}

function OwnerPropertyCard({ property, workspacePath, refreshedAt }) {
  const state = ownerListingState(property)
  const completed = listingReadiness(property).filter(item => item.ready).length
  const path = '/landlord/properties/' + property.id
  return <article className="property-card owner-property-card" aria-labelledby={'owner-property-' + property.id}>
    <Link className="property-cover" to={path + '#' + state.step} state={{ ownerReturn: workspacePath }} aria-label={'Open ' + property.title}><PropertyImage key={refreshedAt} photo={property.photos?.[0]} decorative /><span className={'status-badge owner-state state-' + state.tone}>{state.label}</span></Link>
    <div className="owner-property-copy"><p className="owner-property-type">{property.property_type?.replaceAll('_', ' ')}</p><h3 id={'owner-property-' + property.id}><Link to={path + '#' + state.step} state={{ ownerReturn: workspacePath }}>{property.title}</Link></h3><p className="owner-property-address">{[property.address, property.city].filter(Boolean).join(', ') || 'Add an address in your draft.'}</p><dl className="owner-card-facts"><div><dt>Room options</dt><dd>{property.room_options?.length || 0}</dd></div><div><dt>Vacancies</dt><dd>{ownerInventory(property)}</dd></div></dl>
      <div className={'owner-next-step tone-' + state.tone}><strong>{['draft', 'rejected'].includes(property.status) ? 'Your next step' : 'Listing status'}</strong><p>{state.note}</p>{property.status === 'draft' && <small>{completed} of 6 review requirements complete</small>}</div>
      {property.status === 'approved' && !property.owner_paused && property.room_options.some(option => option.available_units > 0) && property.availability && property.availability.status !== 'current' && <OwnerAvailability property={property} compact />}
      <div className="owner-card-actions">{property.status === 'archived' ? <OwnerListingActions property={property} compact /> : property.status === 'approved' && property.location_check?.status !== 'needs_correction' ? <OwnerAvailabilityPanel property={property} resume={property.owner_paused} label={property.owner_paused ? 'Resume listing' : 'Update availability'} /> : <Link className="btn btn-primary" to={path + '#' + state.step} state={{ ownerReturn: workspacePath }} aria-label={state.action + ' - Manage property: ' + property.title}>{state.action}</Link>}<Link to={path + '#preview'} state={{ ownerReturn: workspacePath }}>Preview saved listing</Link>{property.status === 'approved' && <Link to={path + '#rooms'} state={{ ownerReturn: workspacePath }}>Edit listing details</Link>}</div>
      {property.updated_at && <p className="owner-card-updated">Updated {adminDate(property.updated_at)}</p>}
    </div>
    {!['archived', 'suspended'].includes(property.status) && <OwnerListingActions property={property} compact />}
  </article>
}
