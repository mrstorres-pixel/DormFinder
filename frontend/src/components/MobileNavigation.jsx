import { NavLink, useLocation } from 'react-router-dom'
import { browseLink } from '../lib/housing'
import './mobile-navigation.css'

const paths = {
  browse: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  saved: <path d="M20.8 4.6a5.6 5.6 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  properties: <><path d="m3 10 9-7 9 7v11H3z" /><path d="M9 21v-8h6v8" /></>,
  messages: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l1.6-5A8.5 8.5 0 1 1 21 11.5Z" />,
  viewings: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3" /></>,
}

export default function MobileNavigation({ user }) {
  const { pathname } = useLocation()
  if (!['student', 'landlord'].includes(user?.role)) return null
  const entries = [
    { key: 'browse', label: 'Browse', to: user.preferred_campus_id ? browseLink(user.preferred_campus_id) : '/listings', active: pathname === '/find' || pathname.startsWith('/listings') },
    user.role === 'student' ? { key: 'saved', label: 'Saved places', to: '/saved', active: ['/saved', '/compare', '/favorites', '/shortlists'].includes(pathname) } : { key: 'properties', label: 'Properties', to: '/landlord', active: pathname.startsWith('/landlord') },
    { key: 'messages', label: 'Messages', to: '/inquiries', active: pathname.startsWith('/inquiries') },
    { key: 'viewings', label: 'Viewings', to: '/viewings', active: pathname === '/viewings' },
  ]
  return <nav className="mobile-navigation" aria-label="Mobile navigation">{entries.map(entry => <NavLink key={entry.key} to={entry.to} className={'mobile-navigation-link' + (entry.active ? ' is-current' : '')} aria-current={entry.active ? 'page' : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[entry.key]}</svg><span>{entry.label}</span></NavLink>)}</nav>
}
