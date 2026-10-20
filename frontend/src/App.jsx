import { lazy, Suspense, useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Link, Navigate, Route, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldErrors, writeApi } from './lib/api'
import { useCurrentUser } from './lib/auth'
import { ErrorNotice, Field, Loading } from './components/Feedback'
import Brand from './components/Brand'
import SiteNavigation from './components/SiteNavigation'
import MobileNavigation from './components/MobileNavigation'
import NotificationBell from './components/NotificationBell'
import { personNamePattern, personNameHint } from './lib/personName'
import HousingSearchForm from './components/HousingSearchForm'
import FeaturedHomes from './components/FeaturedHomes'
import RoomEntrance from './components/RoomEntrance'
import { safeReturnTo, clearInquiryDrafts } from './lib/navigation'
import { useDiscardChanges, useClearUnsavedChanges } from './lib/useUnsavedChanges'
import UnsavedChangesProvider from './components/UnsavedChangesProvider'
import WalkthroughProvider from './components/WalkthroughProvider'
import { useWalkthrough } from './lib/walkthroughContext'
import ComparisonProvider from './components/ComparisonProvider'
import { Notifications, StudentReports, ReportQueue, AccountModeration, AdminListings, AuditHistory } from './components/ModerationPages'

const Landlord = lazy(() => import('./components/LandlordWorkspace').then(module => ({ default: module.Landlord })))
const PropertyEditor = lazy(() => import('./components/LandlordWorkspace').then(module => ({ default: module.PropertyEditor })))
const StudentHome = lazy(() => import('./components/StudentHome'))
const Profile = lazy(() => import('./components/ProfileSettings'))
const QuickGuide = lazy(() => import('./components/QuickGuide'))
const Listings = lazy(() => import('./components/ListingPages').then(module => ({ default: module.Listings })))
const ListingDetails = lazy(() => import('./components/ListingPages').then(module => ({ default: module.ListingDetails })))
const Comparison = lazy(() => import('./components/ListingPages').then(module => ({ default: module.Comparison })))
const CampusFinder = lazy(() => import('./components/CampusFinder'))
const SavedPlaces = lazy(() => import('./components/SavedPlaces'))
const SavedPlacesRedirect = lazy(() => import('./components/SavedPlaces').then(module => ({ default: module.SavedPlacesRedirect })))
const Viewings = lazy(() => import('./components/Viewings'))
const ReviewQueue = lazy(() => import('./components/ReviewPages').then(module => ({ default: module.ReviewQueue })))
const ReviewDetails = lazy(() => import('./components/ReviewPages').then(module => ({ default: module.ReviewDetails })))
const InquiryList = lazy(() => import('./components/InquiryPages').then(module => ({ default: module.InquiryList })))
const InquiryThread = lazy(() => import('./components/InquiryPages').then(module => ({ default: module.InquiryThread })))

function Layout({ children }) {
  const { pathname } = useLocation()
  const confirmDiscard = useDiscardChanges()
  const clearAllUnsaved = useClearUnsavedChanges()
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const walkthrough = useWalkthrough()
  const logout = useMutation({
    mutationFn: () => writeApi('post', '/auth/logout'),
    onSuccess: () => { clearAllUnsaved(); clearInquiryDrafts(); setMenuOpen(false); client.clear(); client.setQueryData(['me'], null); navigate('/') },
  })
  return <div className={'app-layout' + (['student', 'landlord'].includes(user?.role) ? ' has-mobile-tabs' : '') + (pathname === '/inquiries' || pathname.startsWith('/inquiries/') ? ' is-messaging' : '')}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><div className="site-header-inner d-flex align-items-center justify-content-between gap-3">
      <Link className="brand-link" to="/" aria-label="DormFinder home"><Brand /></Link>
      <button type="button" className="btn btn-outline-primary menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(value => !value)}>Menu</button>
      <SiteNavigation user={user} menuOpen={menuOpen} closeMenu={() => setMenuOpen(false)} signingOut={logout.isPending} onSignOut={() => { if (confirmDiscard()) logout.mutate() }} />
      {user && <NotificationBell userId={user.id} onOpen={() => setMenuOpen(false)} />}
    </div></header>
    <main id="main" tabIndex="-1">
      {logout.error && <div className="container mt-3"><ErrorNotice error={logout.error} /></div>}
      {children}
    </main>
    <MobileNavigation user={user} />
    <footer className="site-footer"><div className="container d-flex flex-wrap justify-content-between gap-2">
      <span>DormFinder · Made for student life.</span>
      <span>{user && <button type="button" className="walkthrough-footer-link" onClick={walkthrough.start}>{walkthrough.resumable ? 'Resume walkthrough' : 'Take a walkthrough'}</button>} Find a place near your college or university.</span>
    </div></footer>
  </div>
}

function Home() {
  return <>
    <RoomEntrance />
    <section id="find-housing" tabIndex="-1" className="hero campus-hero home-discovery-hero"><div className="container"><div className="home-introduction"><span className="eyebrow">STUDENT HOUSING, CLOSE TO CAMPUS</span><h2>Find your place near campus.</h2><p>Choose where you study. Find a room that fits. Talk to the owner when you're ready.</p></div><HousingSearchForm home /><div className="home-secondary"><Link to="/listings">Explore all listings →</Link><span>Have a place to share? <Link to="/register?role=landlord">List your property</Link></span></div></div></section>
    <FeaturedHomes />
  </>
}

function AuthPage({ register = false }) {
  const [role, setRole] = useState(() => new URLSearchParams(window.location.search).get('role') === 'landlord' ? 'landlord' : 'student')
  const navigate = useNavigate()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => writeApi('post', register ? '/auth/register/' + role : '/auth/login', values),
    onSuccess: (user) => {
      client.setQueryData(['me'], user)
      const fallback = user.role === 'landlord' ? '/landlord' : user.role === 'admin' ? '/admin' : '/account'
      const returnTo = new URLSearchParams(window.location.search).get('returnTo')
      navigate(register ? '/profile/setup' + (returnTo ? '?returnTo=' + encodeURIComponent(safeReturnTo(returnTo, user.role === 'landlord' ? '/landlord' : '/listings')) : '') : safeReturnTo(returnTo, fallback), { replace: true })
    },
  })
  function submit(event) {
    event.preventDefault()
    mutation.mutate(Object.fromEntries(new FormData(event.currentTarget)))
  }
  const errors = fieldErrors(mutation.error)
  return <div className="container page-space"><div className="auth-grid">
    <aside className="auth-intro"><span className="eyebrow">A LITTLE CLOSER TO CAMPUS</span><h1>{register ? 'Make room for your next chapter.' : 'Welcome back to your space.'}</h1><p>{register ? 'A clearer housing search starts with a simple introduction.' : 'Your listings and conversations, all in one place.'}</p><div className="campus-card"><span>Your college. Your campus.<strong>Your next chapter.</strong></span></div></aside>
    <section className="panel auth-panel"><h2>{register ? 'Create your account' : 'Sign in'}</h2><p className="text-secondary">{register ? 'Choose how you’ll use DormFinder.' : 'Enter the email and password for your account.'}</p>
      {register && <fieldset className="role-picker mb-4"><legend className="visually-hidden">Account type</legend>
        {['student', 'landlord'].map((value) => <label key={value} className={role === value ? 'selected' : ''}>
          <input type="radio" name="account_type" value={value} checked={role === value} onChange={() => setRole(value)} />
          {value === 'student' ? 'I’m a student' : 'I’m a property owner'}
        </label>)}
      </fieldset>}
      <ErrorNotice error={mutation.error} />
      <form onSubmit={submit}>
        {register && <Field label="Your name" name="name" autoComplete="name" pattern={personNamePattern} title={personNameHint} hint={personNameHint} minLength={2} maxLength={100} required error={errors} />}
        <Field label="Email address" name="email" type="email" autoComplete="email" maxLength={254} required error={errors} />
        <Field label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} required error={errors} hint={register ? 'At least 12 characters, including letters and numbers.' : undefined} />
        {register && <Field label="Confirm password" name="password_confirmation" type="password" autoComplete="new-password" required error={errors} />}
        <button className="btn btn-primary w-100 mt-2" disabled={mutation.isPending}>{mutation.isPending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="small mt-4 mb-0">{register ? 'Already have an account? ' : 'New to DormFinder? '}<Link to={(register ? '/login' : '/register') + window.location.search}>{register ? 'Sign in' : 'Create an account'}</Link></p>
    </section>
  </div></div>
}

function Protected({ children, role }) {
  const location = useLocation()
  const query = useCurrentUser()
  if (query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /></div>
  if (!query.data) return <Navigate to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)} replace />
  if (role && !(Array.isArray(role) ? role : [role]).includes(query.data.role)) return <Navigate to="/account" replace />
  return children
}

function Account() {
  const { data: user } = useCurrentUser()
  if (user?.role === 'landlord') return <Navigate to="/landlord" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  return user ? <StudentHome user={user} /> : null
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route errorElement={<section className="container page-space"><h1>Something went wrong.</h1><p>Your saved work is still available. Reload this page to try again.</p><button className="btn btn-primary me-3" onClick={() => window.location.reload()}>Reload page</button><Link to="/">Return home</Link></section>} element={<UnsavedChangesProvider><ComparisonProvider><WalkthroughProvider><Layout><Suspense fallback={<div className="container page-space"><Loading>Loading page...</Loading></div>}><Outlet /></Suspense></Layout></WalkthroughProvider></ComparisonProvider></UnsavedChangesProvider>}>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage register />} />
    <Route path="/find" element={<CampusFinder />} />
    <Route path="/saved" element={<Protected role="student"><SavedPlaces /></Protected>} />
    <Route path="/shortlists" element={<Protected role="student"><SavedPlacesRedirect /></Protected>} />
    <Route path="/viewings" element={<Protected role={['student', 'landlord']}><Viewings /></Protected>} />
    <Route path="/listings" element={<Listings />} />
    <Route path="/listings/:id" element={<ListingDetails />} />
    <Route path="/compare" element={<Comparison />} />
    <Route path="/favorites" element={<Protected role="student"><SavedPlacesRedirect /></Protected>} />
    <Route path="/admin" element={<Protected role="admin"><ReviewQueue /></Protected>} />
    <Route path="/admin/reports" element={<Protected role="admin"><ReportQueue /></Protected>} />
    <Route path="/admin/users" element={<Protected role="admin"><AccountModeration /></Protected>} />
    <Route path="/admin/listings" element={<Protected role="admin"><AdminListings /></Protected>} />
    <Route path="/admin/audit" element={<Protected role="admin"><AuditHistory /></Protected>} />
    <Route path="/reports" element={<Protected role="student"><StudentReports /></Protected>} />
    <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
    <Route path="/admin/reviews/:id" element={<Protected role="admin"><ReviewDetails /></Protected>} />
    <Route path="/inquiries" element={<Protected role={['student', 'landlord']}><InquiryList /></Protected>} />
    <Route path="/inquiries/:id" element={<Protected role={['student', 'landlord']}><InquiryThread /></Protected>} />
    <Route path="/account" element={<Protected><Account /></Protected>} />
    <Route path="/profile" element={<Protected><Profile /></Protected>} />
    <Route path="/profile/setup" element={<Protected><Profile setup /></Protected>} />
    <Route path="/guide" element={<Protected><QuickGuide /></Protected>} />
    <Route path="/landlord" element={<Protected role="landlord"><Landlord /></Protected>} />
    <Route path="/landlord/properties/new" element={<Protected role="landlord"><PropertyEditor /></Protected>} />
    <Route path="/landlord/properties/:id" element={<Protected role="landlord"><PropertyEditor /></Protected>} />
    <Route path="*" element={<section className="container page-space"><h1>We couldn’t find that page.</h1><Link to="/">Return home</Link></section>} />
  </Route>
))

export default function App() {
  return <RouterProvider router={router} />
}

