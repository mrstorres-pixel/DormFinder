import { useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { ErrorNotice } from './Feedback'
import './admin-workspace.css'

const sections = [
  ['/admin', 'Reviews', 'Check new submissions', 'M8 4h8v4H8z M6 6H4v15h16V6h-2 M8 12h8 M8 16h5'],
  ['/admin/reports', 'Reports', 'Respond to concerns', 'M4 4h16v13H9l-5 4z M8 8h8 M8 12h5'],
  ['/admin/listings', 'All listings', 'Find any property', 'm3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8'],
  ['/admin/users', 'Accounts', 'Find students & owners', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4'],
  ['/admin/campuses', 'Campuses', 'Branches, entrances & requests', 'm3 9 9-6 9 6-9 6-9-6 M6 11v7c4 3 8 3 12 0v-7 M21 9v9'],
  ['/admin/audit', 'Audit history', 'Trace recorded decisions', 'M4 5h16v16H4z M8 3v4 M16 3v4 M8 11h8 M8 15h5'],
  ['/profile', 'Profile', 'Your account & security', 'M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
]

const resultNoun = (noun, count) => count === 1 ? ({ campuses: 'campus', requests: 'request', properties: 'property', listings: 'listing', accounts: 'account', reports: 'report', actions: 'action', submissions: 'submission', results: 'result' })[noun] || noun : noun

export function AdminNavigation() {
  const { pathname } = useLocation()
  return <aside className="admin-sidebar"><Link className="admin-workspace-name" to="/admin">Administration<span>DormFinder workspace</span></Link><nav aria-label="Administrator sections" className="admin-sections">{sections.map(([path, label, hint, icon], index) => <div key={path} className="admin-nav-item">{[0, 2, 5, 6].includes(index) && <span className="admin-nav-group">{index === 0 ? 'Daily work' : index === 2 ? 'Directory' : index === 5 ? 'Records' : 'Your account'}</span>}<Link to={path} aria-current={(path === '/admin' ? pathname === path || pathname.startsWith('/admin/reviews/') : pathname === path || (path === '/profile' && pathname.startsWith('/profile/'))) ? 'page' : undefined}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg><span>{label}<small>{hint}</small></span></Link></div>)}</nav><p className="admin-sidebar-note">Review the details. Record a reason. Keep owners informed.</p></aside>
}

export function AdminShell({ children, className = '' }) {
  return <section className={'container page-space admin-workspace ' + className}><AdminNavigation /><div className="admin-content">{children}</div></section>
}

export function AdminLayout({ title, description, children, className = '' }) {
  return <AdminShell className={className}><header className="admin-page-heading"><h1 tabIndex={-1}>{title}</h1><p>{description}</p></header><AdminOutcomeNotice />{children}</AdminShell>
}

function AdminOutcomeNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const outcome = location.state?.adminOutcome
  if (!outcome || !['approved', 'rejected'].includes(outcome.decision) || !Number.isInteger(outcome.id) || typeof outcome.title !== 'string') return null
  return <section className="admin-outcome" aria-live="polite"><div><h2>{outcome.decision === 'approved' ? 'Listing approved' : 'Feedback sent to the owner'}</h2><p>{outcome.title}</p><Link to={'/admin/reviews/' + outcome.id} state={{ adminReturn: location.pathname + location.search }}>View recorded decision</Link></div><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate(location.pathname + location.search + location.hash, { replace: true, state: { ...location.state, adminOutcome: null } })}>Dismiss confirmation</button></section>
}

export function AdminResultsHeader({ browse, noun = 'results', order, children }) {
  const { query } = browse
  const client = useQueryClient()
  const meta = query.data?.meta || query.data
  const total = meta?.total ?? query.data?.data?.length
  if (!query.data) return null
  return <><div className="admin-results-heading"><div><h2>{total ?? 'Your'} {resultNoun(noun, total)}</h2><p>{order}{query.dataUpdatedAt > 0 && <span>Last refreshed {new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(query.dataUpdatedAt)}</span>}</p></div><div className="admin-results-actions">{children}<button type="button" className="btn btn-outline-primary btn-sm" disabled={query.isFetching} onClick={() => { query.refetch(); client.invalidateQueries({ queryKey: ['dashboard'] }) }}>{query.isFetching ? 'Refreshing…' : 'Refresh results'}</button></div></div>{query.error && <div className="admin-retained-results"><p>The refresh failed. These are the last successfully loaded records.</p><ErrorNotice error={query.error} retry={() => query.refetch()} /></div>}</>
}

export function AdminListingImage({ photo, decorative = false, compact = false }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return photo?.url && failedUrl !== photo.url ? <img src={photo.url} alt={decorative ? '' : photo.caption || 'Listing cover'} loading="lazy" onError={() => setFailedUrl(photo.url)} /> : <span className={compact ? 'admin-property-placeholder' : 'admin-photo-fallback'}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6" /><circle cx="15" cy="8" r="1" /></svg>{!compact && <small>{photo?.url ? 'Photo unavailable' : 'No cover photo'}</small>}</span>
}

export function AdminWorkQueues() {
  const { data: user } = useCurrentUser()
  const { data, error } = useQuery({ queryKey: ['dashboard', user?.id], enabled: user?.role === 'admin', queryFn: async () => (await api.get('/dashboard')).data.data, staleTime: 30_000, retry: false })
  const { pathname } = useLocation()
  return <nav className="admin-work-queues" aria-label="Daily work queues">{[['/admin', 'Listing reviews', 'pending_reviews', 'Submissions awaiting a decision'], ['/admin/reports', 'Student reports', 'open_reports', 'Concerns awaiting an outcome']].map(([path, label, key, hint]) => <Link to={path} key={key} aria-current={pathname === path ? 'page' : undefined}><span>{label}<small>{hint}</small></span>{Number.isInteger(data?.[key]) && <strong>{data[key]}</strong>}</Link>)}{error && <span className="admin-summary-note">Queue totals are unavailable. You can still open each queue.</span>}</nav>
}

export function AdminViews({ browse, name, field, options, defaultValue = '' }) {
  const current = browse.params.get(field) || defaultValue
  return <nav className="admin-views" aria-label={name}>{options.map(([value, label]) => <button type="button" key={value} aria-current={current === value ? 'page' : undefined} onClick={() => browse.update({ [field]: value })}>{label}</button>)}</nav>
}

export function AdminFilterBar(props) {
  return <FilterForm {...props} />
}

function FilterForm({ browse, searchLabel = 'Search listings', filters = [], sorts = [['newest', 'Newest first'], ['oldest', 'Oldest first']], dates = false }) {
  const id = useId()
  const [expandedFor, setExpandedFor] = useState(null)
  const search = useRef(null)
  const { params, defaultSort } = browse
  const signature = params.toString()
  const [searchDraft, setSearchDraft] = useState({ signature, value: params.get('q') || '' })
  if (searchDraft.signature !== signature) setSearchDraft({ signature, value: params.get('q') || '' })
  const expanded = expandedFor === signature
  const active = [...params].filter(([key, value]) => value && !['page', 'per_page'].includes(key) && !(key === 'sort' && value === defaultSort) && !filters.some(filter => filter.name === key && value === filter.defaultValue))
  const labelFor = (key, value) => key === 'q' ? `Search: ${value}` : ['id', 'user_id', 'property_id'].includes(key) ? `${key === 'property_id' ? 'Listing' : 'Account'} #${value}` : key === 'sort' ? sorts.find(([option]) => option === value)?.[1] || value : key === 'from' ? `From: ${value}` : key === 'to' ? `To: ${value}` : filters.find(filter => filter.name === key)?.options.find(([option]) => option === value)?.[1] || `${key.replaceAll('_', ' ')}: ${value}`
  return <form className="admin-filter-bar" autoComplete="off" onSubmit={event => {
    event.preventDefault()
    browse.apply({ ...Object.fromEntries(params), ...Object.fromEntries(new FormData(event.currentTarget)) })
    setExpandedFor(null)
    search.current?.focus({ preventScroll: true })
  }}>
    <div className="admin-search-row"><div className="admin-search-field"><label htmlFor={id + '-q'}>{searchLabel}</label><input ref={search} className="form-control" id={id + '-q'} name="q" type="search" maxLength={100} value={searchDraft.value} onChange={event => setSearchDraft({ signature, value: event.target.value })} placeholder={searchLabel} /></div><button className="btn btn-primary" type="submit">Search</button><button className="btn btn-outline-primary admin-filter-toggle" type="button" aria-expanded={expanded} aria-controls={id + '-advanced'} onClick={() => setExpandedFor(expanded ? null : signature)}>Filters & sorting <span aria-hidden="true">{expanded ? '−' : '+'}</span></button></div>
    <fieldset key={signature} id={id + '-advanced'} className="admin-advanced" hidden={!expanded} disabled={!expanded}><legend>Refine these results</legend><div className="admin-filter-grid">
      {filters.filter(filter => !filter.hidden).map(filter => <div key={filter.name}><label htmlFor={id + '-' + filter.name}>{filter.label}</label><select className="form-select" id={id + '-' + filter.name} name={filter.name} defaultValue={params.get(filter.name) || filter.defaultValue || ''}>{filter.options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>)}
      <div><label htmlFor={id + '-sort'}>Sort by</label><select className="form-select" name="sort" id={id + '-sort'} defaultValue={params.get('sort') || defaultSort}>{sorts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      {dates && <><div><label htmlFor={id + '-from'}>From date</label><input className="form-control" type="date" id={id + '-from'} name="from" defaultValue={params.get('from') || ''} /></div><div><label htmlFor={id + '-to'}>To date</label><input className="form-control" type="date" id={id + '-to'} name="to" defaultValue={params.get('to') || ''} /></div></>}
    </div><div className="admin-filter-actions"><button className="btn btn-primary" type="submit">Apply filters</button><button className="btn btn-outline-primary" type="button" onClick={browse.clear}>Clear filters</button>{dates && <span>Dates use Philippine time.</span>}</div></fieldset>
    {active.length > 0 && <div className="admin-applied-filters" aria-label="Applied filters">{active.map(([key, value]) => <button key={key} type="button" aria-label={'Remove filter: ' + labelFor(key, value)} onClick={() => browse.update({ [key]: '' })}>{labelFor(key, value)} <span aria-hidden="true">×</span></button>)}<button className="admin-clear-filters" type="button" onClick={browse.clear}>Clear filters</button></div>}
  </form>
}

export function AdminPager({ browse, noun = 'results', announceRange = true }) {
  const id = useId()
  const { query, page, setPage } = browse
  const meta = query.data?.meta || query.data
  const total = meta?.total ?? query.data?.data?.length ?? 0
  const last = Math.max(1, meta?.last_page || 1)
  if (!total) return null
  const hasRows = query.data?.data?.length > 0
  return <div className="admin-pagination"><p role={announceRange ? 'status' : undefined} aria-live={announceRange ? undefined : 'polite'}>{hasRows ? `${meta?.from || (page - 1) * Number(browse.params.get('per_page') || 12) + 1}–${meta?.to || Math.min(total, page * Number(browse.params.get('per_page') || 12))} of ${total} ${resultNoun(noun, total)}` : `No ${noun} on this page · ${total} in total`}</p><div className="admin-page-size"><label htmlFor={id}>Per page</label><select className="form-select" id={id} value={browse.params.get('per_page') || '12'} onChange={event => browse.update({ per_page: event.target.value })}>{[12, 24, 48].map(value => <option key={value}>{value}</option>)}</select></div>{last > 1 && <nav aria-label="Result pages"><button className="btn btn-outline-primary btn-sm" type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {last}</span><button className="btn btn-outline-primary btn-sm" type="button" disabled={page >= last || query.isFetching} onClick={() => setPage(page + 1)}>Next</button></nav>}</div>
}

export function AdminEmpty({ title = 'No matching results', children, browse }) {
  return <div className="admin-empty"><h2>{title}</h2><div className="admin-empty-copy">{children || 'Try a different search or clear the filters.'}</div>{browse && <div className="admin-empty-actions">{browse.page > 1 && <button className="btn btn-outline-primary" type="button" onClick={() => browse.setPage(1)}>Back to first page</button>}{browse.params.size > 0 && <button className="btn btn-outline-primary" type="button" onClick={browse.clear}>Reset search</button>}</div>}</div>
}
