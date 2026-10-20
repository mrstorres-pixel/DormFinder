import { useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './admin-workspace.css'

export function AdminNavigation() {
  const { pathname } = useLocation()
  const links = [['/admin', 'Reviews'], ['/admin/reports', 'Reports'], ['/admin/listings', 'All listings'], ['/admin/users', 'Accounts'], ['/admin/audit', 'Audit history']]
  return <nav aria-label="Administrator sections" className="admin-sections">{links.map(([path, label]) => <Link key={path} to={path} aria-current={(path === '/admin' ? pathname === path || pathname.startsWith('/admin/reviews/') : pathname === path) ? 'page' : undefined}>{label}</Link>)}</nav>
}

export function AdminLayout({ title, description, children, className = '' }) {
  return <section className={'container page-space admin-workspace ' + className}><AdminNavigation /><header className="admin-page-heading"><span className="eyebrow">ADMINISTRATOR WORKSPACE</span><h1 tabIndex={-1}>{title}</h1><p>{description}</p></header>{children}</section>
}

export function AdminFilterBar({ browse, searchLabel = 'Search listings', filters = [], sorts = [['newest', 'Newest first'], ['oldest', 'Oldest first']], dates = false }) {
  const id = useId()
  const { params, defaultSort } = browse
  return <form className="admin-filter-bar" key={params.toString()} onSubmit={event => { event.preventDefault(); browse.apply(Object.fromEntries(new FormData(event.currentTarget))) }}>
    {['id', 'property_id', 'user_id'].filter(key => params.has(key)).map(key => <input type="hidden" name={key} value={params.get(key)} key={key} />)}
    <div className="admin-filter-grid"><div className="admin-search-field"><label htmlFor={id + '-q'}>{searchLabel}</label><input className="form-control" id={id + '-q'} name="q" type="search" maxLength={100} defaultValue={params.get('q') || ''} placeholder={searchLabel} /></div>
      {filters.map(filter => <div key={filter.name}><label htmlFor={id + '-' + filter.name}>{filter.label}</label><select className="form-select" id={id + '-' + filter.name} name={filter.name} defaultValue={params.get(filter.name) || filter.defaultValue || ''}>{filter.options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>)}
      <div><label htmlFor={id + '-sort'}>Sort by</label><select className="form-select" name="sort" id={id + '-sort'} defaultValue={params.get('sort') || defaultSort}>{sorts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      <div><label htmlFor={id + '-per-page'}>Per page</label><select className="form-select" id={id + '-per-page'} name="per_page" defaultValue={params.get('per_page') || '12'}>{[12, 24, 48].map(value => <option key={value}>{value}</option>)}</select></div>
      {dates && <><div><label htmlFor={id + '-from'}>From date</label><input className="form-control" type="date" id={id + '-from'} name="from" defaultValue={params.get('from') || ''} /></div><div><label htmlFor={id + '-to'}>To date</label><input className="form-control" type="date" id={id + '-to'} name="to" defaultValue={params.get('to') || ''} /></div></>}
    </div><div className="admin-filter-actions"><button className="btn btn-primary" type="submit">Apply filters</button><button className="btn btn-outline-primary" type="button" onClick={browse.clear}>Clear filters</button>{dates && <span>Dates use Philippine time.</span>}</div>
  </form>
}

export function AdminPager({ browse, noun = 'results' }) {
  const { query, page, setPage } = browse
  const meta = query.data?.meta || query.data
  const total = meta?.total ?? query.data?.data?.length ?? 0
  const last = Math.max(1, meta?.last_page || 1)
  return <div className="admin-pagination"><p role="status">{total ? `${meta?.from || (page - 1) * Number(browse.params.get('per_page') || 12) + 1}–${meta?.to || Math.min(total, page * Number(browse.params.get('per_page') || 12))} of ${total} ${noun}` : `0 ${noun}`}</p><nav aria-label="Result pages"><button className="btn btn-outline-primary btn-sm" type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {last}</span><button className="btn btn-outline-primary btn-sm" type="button" disabled={page >= last || query.isFetching} onClick={() => setPage(page + 1)}>Next</button></nav></div>
}

export function AdminEmpty({ title = 'No matching results', children }) {
  return <div className="admin-empty"><span aria-hidden="true">⌕</span><h2>{title}</h2><p>{children || 'Try a different search or clear the filters.'}</p></div>
}
