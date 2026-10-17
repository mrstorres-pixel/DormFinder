import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { browseLink } from '../lib/housing'
import Avatar from './Avatar'

const navigationClass = ({ isActive }) => 'nav-link mobile-tab-destination' + (isActive ? ' is-current' : '')

export default function SiteNavigation({ user, menuOpen, closeMenu, onSignOut, signingOut }) {
  const navigation = useRef(null)
  const location = useLocation()
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
      {user.role === 'admin' && <NavLink className={navigationClass} to="/admin">Reviews</NavLink>}
      {['student', 'landlord'].includes(user.role) && <><NavLink className={navigationClass} to="/inquiries">Messages</NavLink><NavLink className={navigationClass} to="/viewings">Viewings</NavLink></>}
      <details className={'navigation-menu account-menu ' + (['/account', '/profile'].includes(location.pathname) ? 'is-current' : '')}><summary><Avatar src={user.avatar_url} name={user.name} size="small" /><span>Account</span></summary><div className="navigation-popover">{user.role === 'student' && <NavLink className={navigationClass} to={accountPath}>Your space</NavLink>}<NavLink className={navigationClass} to="/profile">Profile</NavLink><button className="navigation-signout" disabled={signingOut} onClick={onSignOut}>Sign out</button></div></details>
    </> : <div className="guest-navigation"><NavLink className="btn btn-primary btn-sm" to="/login">Sign in</NavLink></div>}
  </nav>
}
