import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { browseLink } from '../lib/housing'
import Avatar from './Avatar'
import { useWalkthrough } from '../lib/walkthroughContext'

const navigationClass = ({ isActive }) => 'nav-link mobile-tab-destination' + (isActive ? ' is-current' : '')

export default function SiteNavigation({ user, menuOpen, closeMenu, onSignOut, signingOut }) {
  const navigation = useRef(null)
  const location = useLocation()
  const walkthrough = useWalkthrough()
  useEffect(() => {
    for (const menu of navigation.current.querySelectorAll('details[open]')) menu.open = false
  }, [location.pathname, location.search])
  useEffect(() => {
    function dismiss(event) {
      for (const menu of navigation.current.querySelectorAll('details[open]')) {
        if (event.type === 'keydown' && event.key === 'Escape') {
          menu.open = false
          menu.querySelector('summary').focus()
        } else if (event.type === 'pointerdown' && !menu.contains(event.target)) menu.open = false
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [])
  const accountPath = user?.role === 'landlord' ? '/landlord' : user?.role === 'admin' ? '/admin' : '/account'
  return <nav ref={navigation} id="main-navigation" aria-label="Main navigation" className={'main-navigation ' + (menuOpen ? 'is-open' : '')} onClick={event => { if (event.target.closest('a')) closeMenu() }}>
    <NavLink className={navigationClass} to={user?.preferred_campus_id ? browseLink(user.preferred_campus_id) : '/listings'}>Browse</NavLink>
    {user ? <>
      {user.role === 'student' && <NavLink className={({ isActive }) => 'nav-link mobile-tab-destination' + (isActive || ['/compare', '/favorites', '/shortlists'].includes(location.pathname) ? ' is-current' : '')} to="/saved">Saved places</NavLink>}
      {user.role === 'landlord' && <NavLink className={navigationClass} to="/landlord">My space</NavLink>}
      {user.role === 'admin' && <NavLink className={navigationClass} to="/admin">Admin workspace</NavLink>}
      {['student', 'landlord'].includes(user.role) && <><NavLink className={navigationClass} to="/inquiries">Messages</NavLink><NavLink className={navigationClass} to="/viewings">Viewings</NavLink></>}
      <details className={'navigation-menu account-menu ' + (['/account', '/profile'].includes(location.pathname) ? 'is-current' : '')}><summary><Avatar src={user.avatar_url} name={user.name} size="small" /><span>Account</span></summary><div className="navigation-popover">{user.role === 'student' && <NavLink className={navigationClass} to={accountPath}>Your space</NavLink>}<NavLink className={navigationClass} to="/profile">Profile</NavLink><button className="navigation-signout" disabled={signingOut} onClick={onSignOut}>Sign out</button></div></details>
      {walkthrough && <button type="button" className="walkthrough-help" aria-label={walkthrough.resumable ? 'Resume walkthrough' : 'Start walkthrough'} title={walkthrough.resumable ? 'Resume walkthrough' : 'Take a guided tour'} disabled={walkthrough.active} onClick={walkthrough.start}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.2-1.5 2.5" /><path d="M12 16.5v.2" strokeWidth="2.5" strokeLinecap="round" /></svg></button>}
    </> : <div className="guest-navigation"><NavLink className="btn btn-primary btn-sm" to="/login">Sign in</NavLink></div>}
  </nav>
}
