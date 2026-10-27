import { Component } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { useRequireSavedChanges } from '../lib/useUnsavedChanges'
import { AdminLayout } from './AdminTools'

class ContentBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() { return this.state.error ? <Recovery error={this.state.error} /> : this.props.children }
}

function Recovery({ error }) {
  const { data: user } = useCurrentUser()
  const { pathname } = useLocation()
  const requireSaved = useRequireSavedChanges()
  const refreshNeeded = /dynamically imported|loading chunk|chunkloaderror|module script/i.test(error?.message || '')
  const title = refreshNeeded ? 'This page needs a refresh.' : 'This page could not open.'
  const workspace = user?.role === 'admin' ? '/admin' : user?.role === 'landlord' ? '/landlord' : user ? '/account' : '/'
  const returnTo = pathname === workspace ? user?.role === 'admin' ? '/admin/listings' : '/listings' : workspace
  const returnLabel = pathname === workspace ? user?.role === 'admin' ? 'Open listing directory' : 'Browse listings' : user ? 'Return to workspace' : 'Return home'
  const content = <div className="page-recovery" role="alert"><p>{refreshNeeded ? 'A page download failed or the app was updated. Refresh to load the current version.' : 'Try refreshing this page. You can also return to your workspace and continue from there.'}</p><div className="d-flex gap-3 flex-wrap align-items-center"><button className="btn btn-primary" onClick={() => { if (requireSaved()) window.location.reload() }}>Refresh page</button><Link to={returnTo}>{returnLabel}</Link></div></div>
  return user?.role === 'admin' ? <AdminLayout title={title} description="Your saved work is still available.">{content}</AdminLayout> : <section className="container page-space"><h1>{title}</h1>{content}</section>
}

export default function PageRecovery({ children }) {
  const { pathname } = useLocation()
  return <ContentBoundary key={pathname}>{children}</ContentBoundary>
}
