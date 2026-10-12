import { lazy, Suspense, useRef, useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Link, Navigate, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fieldErrors, writeApi } from './lib/api'
import { useCurrentUser } from './lib/auth'
import { ErrorNotice, Field, Loading } from './components/Feedback'
import Brand from './components/Brand'
import CampusSearch from './components/CampusSearch'
import MapPinPicker from './components/MapPinPicker'
import { useCampuses } from './lib/discovery'
import { amenities, browseLink } from './lib/housing'
import { safeReturnTo, clearInquiryDrafts } from './lib/navigation'
import useUnsavedChanges, { useDiscardChanges, useClearUnsavedChanges, useFormChanges } from './lib/useUnsavedChanges'
import UnsavedChangesProvider from './components/UnsavedChangesProvider'
import { RoomManager, SubmissionPanel } from './components/RoomOptions'
import ComparisonProvider from './components/ComparisonProvider'
import { DashboardCounts, Notifications, StudentReports, ReportQueue, AccountModeration, AdminListings, AuditHistory, LifecycleControls } from './components/ModerationPages'

const Listings = lazy(() => import('./components/ListingPages').then(module => ({ default: module.Listings })))
const ListingDetails = lazy(() => import('./components/ListingPages').then(module => ({ default: module.ListingDetails })))
const Comparison = lazy(() => import('./components/ListingPages').then(module => ({ default: module.Comparison })))
const ReviewQueue = lazy(() => import('./components/ReviewPages').then(module => ({ default: module.ReviewQueue })))
const ReviewDetails = lazy(() => import('./components/ReviewPages').then(module => ({ default: module.ReviewDetails })))
const InquiryList = lazy(() => import('./components/InquiryPages').then(module => ({ default: module.InquiryList })))
const InquiryThread = lazy(() => import('./components/InquiryPages').then(module => ({ default: module.InquiryThread })))

function Layout({ children }) {
  const confirmDiscard = useDiscardChanges()
  const clearAllUnsaved = useClearUnsavedChanges()
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: () => writeApi('post', '/auth/logout'),
    onSuccess: () => { clearAllUnsaved(); clearInquiryDrafts(); setMenuOpen(false); client.clear(); client.setQueryData(['me'], null); navigate('/') },
  })
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><div className="container d-flex align-items-center justify-content-between gap-3">
      <Link className="brand-link" to="/" aria-label="DormFinder home"><Brand /></Link>
      <button type="button" className="btn btn-outline-primary menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(value => !value)}>Menu</button>
      <nav id="main-navigation" aria-label="Main navigation" className={'main-navigation ' + (menuOpen ? 'is-open' : '')} onClick={event => { if (event.target.closest('a')) setMenuOpen(false) }}>
        <Link className="nav-link" to={user?.preferred_campus_id ? browseLink(user.preferred_campus_id) : '/listings'}>Browse</Link>

        {user ? <>
          <Link className="nav-link" to={user.role === 'landlord' ? '/landlord' : user.role === 'admin' ? '/admin' : '/account'}>{user.role === 'admin' ? 'Reviews' : 'My space'}</Link>
          {['student', 'landlord'].includes(user.role) && <Link className="nav-link" to="/inquiries">Inquiries</Link>}
          {user.role === 'student' && <Link className="nav-link" to="/favorites">Favorites</Link>}
          <Link className="nav-link" to="/notifications">Notifications</Link>
          <Link className="nav-link" to="/profile">Profile</Link>
          <button className="btn btn-outline-secondary btn-sm" disabled={logout.isPending} onClick={() => { if (confirmDiscard()) logout.mutate() }}>Sign out</button>
        </> : <>
          <Link className="nav-link" to="/login">Sign in</Link>
          <Link className="btn btn-primary btn-sm" to="/register">Get started</Link>
        </>}
      </nav>
    </div></header>
    <main id="main" tabIndex="-1">
      {logout.error && <div className="container mt-3"><ErrorNotice error={logout.error} /></div>}
      {children}
    </main>
    <footer className="site-footer"><div className="container d-flex flex-wrap justify-content-between gap-2">
      <span>DormFinder · Made for student life.</span>
      <span>Find a place near your college or university.</span>
    </div></footer>
  </>
}

function Home() {
  const navigate = useNavigate()
  const campuses = useCampuses()
  const { data: user } = useCurrentUser()
  const [selection, setSelection] = useState(null)
  const [error, setError] = useState('')
  const campusId = selection ?? String(user?.preferred_campus_id || '')
  function search(event) {
    event.preventDefault()
    if (!campusId) { setError('Choose a specific campus to find nearby housing.'); return }
    navigate(browseLink(campusId))
  }
  return <>
    <section className="hero campus-hero"><div className="container"><div className="row align-items-center g-5">
      <div className="col-lg-7"><span className="eyebrow">YOUR CAMPUS. YOUR NEXT CHAPTER.</span><h1>Find your place.<br /><span>Feel closer to campus.</span></h1>
        <p className="hero-copy">From your first class to your first home away from home. Explore rooms near your college, understand the costs, and ask owners directly.</p>
        <form className="home-campus-form panel" onSubmit={search}>
          {campuses.isPending ? <Loading>Loading campus directory…</Loading> : campuses.error ? <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} /> : <CampusSearch campuses={campuses.data} value={campusId} onChange={value => { setSelection(value); setError('') }} />}
          {error && <p role="alert" className="text-danger">{error}</p>}
          <button className="btn btn-primary btn-lg w-100" disabled={campuses.isPending || !!campuses.error}>Find housing near my campus</button>
        </form>
        <div className="d-flex gap-3 flex-wrap mt-3"><Link to="/listings">Explore all listings</Link><Link to="/register?role=landlord">List your property</Link></div>
      </div>
      <div className="col-lg-5"><aside className="campus-story panel"><span className="eyebrow">A LITTLE MORE CLARITY</span><div className="story-house" aria-hidden="true">⌂</div><h2>A good fit starts with the details.</h2><ul><li>Your specific campus, in the picture.</li><li>Rent, fixed charges, and move-in costs together.</li><li>Availability dates you can actually check.</li><li>Private questions, directly to the owner.</li></ul><p className="small text-secondary">Our directory is growing across Metro Manila. Housing supply varies by campus.</p></aside></div>
    </div></div></section>
    <section className="container values-section"><div className="row g-4">
      {[['01','Start with your university','Select the right campus, then narrow by distance, budget, room type, and facilities.'],['02','See your options together','Connect prices on the map with listing details and compare up to three places.'],['03','Decide with clear information','Understand known costs and confirmation dates. Ask the owner about anything missing.']].map(([number,title,description]) => <div className="col-md-4" key={number}><article className="value-card"><span>{number}</span><h2>{title}</h2><p>{description}</p></article></div>)}
    </div></section>
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
      navigate(safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'), fallback), { replace: true })
    },
  })
  function submit(event) {
    event.preventDefault()
    mutation.mutate(Object.fromEntries(new FormData(event.currentTarget)))
  }
  const errors = fieldErrors(mutation.error)
  return <div className="container page-space"><div className="auth-grid">
    <aside className="auth-intro"><span className="eyebrow">A LITTLE CLOSER TO CAMPUS</span><h1>{register ? 'Make room for your next chapter.' : 'Welcome back to your space.'}</h1><p>{register ? 'A clearer housing search starts with a simple introduction.' : 'Your listings and conversations, all in one place.'}</p><div className="campus-card">⌖ <span>Your college. Your campus.<strong>Your next chapter.</strong></span></div></aside>
    <section className="panel auth-panel"><h2>{register ? 'Create your account' : 'Sign in'}</h2><p className="text-secondary">{register ? 'Choose how you’ll use DormFinder.' : 'Enter the email and password for your account.'}</p>
      {register && <fieldset className="role-picker mb-4"><legend className="visually-hidden">Account type</legend>
        {['student', 'landlord'].map((value) => <label key={value} className={role === value ? 'selected' : ''}>
          <input type="radio" name="account_type" value={value} checked={role === value} onChange={() => setRole(value)} />
          {value === 'student' ? 'I’m a student' : 'I’m a property owner'}
        </label>)}
      </fieldset>}
      <ErrorNotice error={mutation.error} />
      <form onSubmit={submit}>
        {register && <Field label="Your name" name="name" autoComplete="name" maxLength={100} required error={errors} />}
        <Field label="Email address" name="email" type="email" autoComplete="email" maxLength={254} required error={errors} />
        <Field label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} required error={errors} hint={register ? 'At least 12 characters, including letters and numbers.' : undefined} />
        {register && <Field label="Confirm password" name="password_confirmation" type="password" autoComplete="new-password" required error={errors} />}
        <button className="btn btn-primary w-100 mt-2" disabled={mutation.isPending}>{mutation.isPending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="small mt-4 mb-0">{register ? 'Already have an account? ' : 'New to DormFinder? '}<Link to={(register ? '/login' : '/register') + window.location.search}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="small text-secondary mt-3 mb-0">Administrator accounts are created through a controlled process. No email recovery is available during early access.</p>
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
  return <section className="container page-space"><span className="eyebrow">MY SPACE</span><h1>Welcome, {user?.name}.</h1><DashboardCounts /><Link to="/reports">Your reports</Link><div className="panel empty-state mt-4"><span className="empty-icon" aria-hidden="true">⌂</span><h2>Find a place that fits your student life.</h2><p>Browse reviewed listings, compare selected room options, and keep your questions in private conversations.</p><div className="d-flex justify-content-center gap-3 flex-wrap"><Link className="btn btn-primary" to={user?.preferred_campus_id ? browseLink(user.preferred_campus_id) : '/listings'}>Browse listings</Link><Link className="btn btn-outline-primary" to="/inquiries">Your inquiries</Link></div></div></section>
}

function Landlord() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['properties', page], queryFn: async () => (await api.get('/landlord/properties', { params: { page } })).data, retry: false, refetchInterval: 240_000 })
  return <section className="container page-space">
    <div className="page-heading"><div><span className="eyebrow">PROPERTY OWNER WORKSPACE</span><h1>Your properties</h1><p>Start with the details. Keep everything in one place.</p></div><Link to="/landlord/properties/new" className="btn btn-primary">+ Add a property</Link></div>
    <DashboardCounts /><div className="info-strip"><strong>A good listing starts with clarity.</strong><span>Prepare your property details and photos. Drafts are only visible to you.</span></div>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> :
      query.data.data.length ? <div className="row g-4 mt-1">{query.data.data.map((property) => <div className="col-md-6 col-xl-4" key={property.id}>
        <article className="property-card">
          <div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} /> : <span aria-hidden="true">⌂</span>}<span className="status-badge">{property.status.replaceAll('_', ' ')}</span></div>
          <div className="p-4"><p className="small text-secondary text-uppercase mb-2">{property.property_type.replaceAll('_', ' ')}</p><h2>{property.title}</h2><p className="text-secondary">{property.address || property.city}</p><p className="small mb-3">{property.status === 'draft' ? 'Finish details, photos and room options, then submit for review.' : property.status === 'rejected' ? 'Read the review feedback and update your draft before resubmitting.' : property.status === 'pending_review' ? 'Awaiting administrator review. Editing is paused.' : property.status === 'approved' ? 'Public listing. Confirm vacancies at least every 14 days.' : 'Open the listing to check its status and available actions.'}</p><Link className="stretched-link" to={'/landlord/properties/' + property.id}>Manage property <span aria-hidden="true">→</span></Link></div>
        </article>
      </div>)}</div> : <div className="panel empty-state"><span className="empty-icon" aria-hidden="true">⌂</span><h2>Make a little room for possibility.</h2><p>Add your first property and prepare it for students looking near their campus.</p><Link className="btn btn-outline-primary" to="/landlord/properties/new">Create your first draft</Link></div>}
    {query.data?.meta.last_page > 1 && <nav aria-label="Property pages" className="d-flex align-items-center gap-3 mt-4">
      <button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page} of {query.data.meta.last_page}</span>
      <button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </section>
}

function PropertyEditor() {
  const { id } = useParams()
  const isNew = !id
  const query = useQuery({
    queryKey: ['property', id], enabled: !isNew,
    queryFn: async () => (await api.get('/landlord/properties/' + id)).data.data, retry: false, refetchInterval: 240_000,
  })
  if (!isNew && query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /></div>
  return <PropertyForm key={id || 'new'} property={query.data} />
}

function PropertyForm({ property }) {
  const [coordinates, setCoordinates] = useState({ latitude:property?.latitude ?? '', longitude:property?.longitude ?? '' })
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const client = useQueryClient()
  const navigate = useNavigate()
  const editable = !property || ['draft', 'rejected', 'approved'].includes(property.status)
  const mutation = useMutation({
    mutationFn: (values) => writeApi(property ? 'patch' : 'post', '/landlord/properties' + (property ? '/' + property.id : ''), values),
    onSuccess: async (saved) => {
      clearUnsaved()
      setDirty(false)
      client.setQueryData(['property', String(saved.id)], saved)
      await client.invalidateQueries({ queryKey: ['properties'] })
      navigate('/landlord/properties/' + saved.id)
    },
  })
  function submit(event) {
    event.preventDefault()
    if (property?.status === 'approved' && !canReplaceOthers()) return
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(form)
    values.amenities = form.getAll('amenities')
    values.latitude = values.latitude || null
    values.longitude = values.longitude || null
    if (property) values.revision = property.revision
    mutation.mutate(values)
  }
  const errors = fieldErrors(mutation.error)
  return <section className="container page-space">
    <Link className="back-link" to="/landlord">← Your properties</Link>
    <div className="page-heading mt-4"><div><span className="eyebrow">{property ? 'PROPERTY DETAILS' : 'A NEW BEGINNING'}</span><h1>{property ? property.title : 'Add your property'}</h1><p>Give students a clear picture of your place.</p></div>{property && <span className="status-badge position-static">{property.status.replaceAll('_', ' ')} · {property.status === 'approved' ? 'public' : 'private'}</span>}</div>
    <div className="row g-4"><div className="col-lg-7"><section className="panel"><h2 className="section-title">The essentials</h2>
      <ErrorNotice error={mutation.error} />
      {mutation.isSuccess && <p className="alert alert-success" role="status">Your draft has been saved.</p>}
      <form onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={!editable || mutation.isPending}>
        <Field label="Property name" name="title" defaultValue={property?.title} required maxLength={150} placeholder="e.g. Casal Student Residence" error={errors} />
        <div className="mb-3"><label className="form-label" htmlFor="property_type">Property type</label><select className="form-select" id="property_type" name="property_type" defaultValue={property?.property_type || 'dormitory'}>
          <option value="dormitory">Dormitory</option><option value="apartment">Apartment</option><option value="boarding_house">Boarding house</option><option value="rental_room">Rental room</option>
        </select></div>
        <Field as="textarea" label="About the property" name="description" defaultValue={property?.description} rows={4} maxLength={5000} hint="Describe the property honestly. Do not include private contact details." error={errors} />
        <Field label="Street address" name="address" defaultValue={property?.address} maxLength={255} error={errors} />
        <Field label="City" name="city" defaultValue={property?.city || 'Manila'} required maxLength={100} error={errors} />
        <fieldset className="mb-3"><legend className="h3">Shared facilities</legend><p className="small">Select only facilities available at this property.</p><div className="amenity-list">{Object.entries(amenities).map(([value,label]) => <label key={value}><input type="checkbox" name="amenities" value={value} defaultChecked={property?.amenities?.includes(value)} /> {label}</label>)}</div></fieldset><Field label="House rules" name="house_rules" as="textarea" defaultValue={property?.house_rules} maxLength={2000} rows={3} hint="Describe quiet hours, visitor rules, and other restrictions honestly." error={errors} /><p className="small">Coordinates are optional for a draft and required before submitting for review.</p>
        <MapPinPicker latitude={coordinates.latitude} longitude={coordinates.longitude} onChange={value => { setCoordinates(value); setDirty(true) }} />
        <div className="row"><div className="col-sm-6"><Field label="Latitude (optional)" name="latitude" type="number" step="any" min="-90" max="90" value={coordinates.latitude} onChange={event => setCoordinates(current => ({ ...current,latitude:event.target.value }))} error={errors} /></div><div className="col-sm-6"><Field label="Longitude (optional)" name="longitude" type="number" step="any" min="-180" max="180" value={coordinates.longitude} onChange={event => setCoordinates(current => ({ ...current,longitude:event.target.value }))} error={errors} /></div></div>
        <button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save draft'}</button>
      </fieldset></form>
    </section>{property && <RoomManager property={property} />}</div><div className="col-lg-5">
      {property ? <PhotoManager property={property} /> : <aside className="panel muted-panel"><span className="empty-icon" aria-hidden="true">▧</span><h2 className="section-title">Let your place speak for itself.</h2><p>Save your draft to add photos. Clear, recent images help students understand the space.</p></aside>}
      {property && <SubmissionPanel property={property} />}
      {property && <LifecycleControls property={property} />}
      <aside className="editor-note mt-4"><h2>Good to know</h2><p>Drafts are private. Add room options and submit complete listings for review. Material changes require another review.</p><p className="mb-0">Content review is not a safety inspection or ownership verification.</p></aside>
    </div></div>
  </section>
}

function PhotoManager({ property }) {
  const client = useQueryClient()
  const [inputKey, setInputKey] = useState(0)
  const uploadIdentity = useRef({ file: null, caption: '', id: '' })
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const editable = ['draft', 'rejected', 'approved'].includes(property.status)
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['property', String(property.id)] }),
      client.invalidateQueries({ queryKey: ['properties'] }),
    ])
  }
  const upload = useMutation({
    mutationFn: (data) => writeApi('post', '/landlord/properties/' + property.id + '/photos', data),
    onSuccess: async () => { clearUnsaved(); setDirty(false); uploadIdentity.current = { file: null, caption: '', id: '' }; setInputKey((key) => key + 1); await refresh() },
    onError: refresh,
  })
  const order = useMutation({ mutationFn: ids => writeApi('put', '/landlord/properties/' + property.id + '/photos/order', { revision:property.revision, photo_ids:ids }), onSettled:refresh })
  function reorder(index, target) {
    if (property.status === 'approved' && !canReplaceOthers()) return
    const ids = property.photos.map(photo => photo.id); const [id] = ids.splice(index,1); ids.splice(target,0,id); order.mutate(ids)
  }
  const remove = useMutation({
    mutationFn: (photoId) => writeApi('delete', '/landlord/properties/' + property.id + '/photos/' + photoId, { revision: property.revision }),
    onSettled: refresh,
  })
  function submit(event) {
    event.preventDefault()
    if (property?.status === 'approved' && !canReplaceOthers()) return
    const form = new FormData(event.currentTarget)
    const file = event.currentTarget.elements.photo.files[0]
    const caption = form.get('caption') || ''
    if (uploadIdentity.current.file !== file || uploadIdentity.current.caption !== caption) {
      uploadIdentity.current = { file, caption, id: crypto.randomUUID() }
    }
    form.set('upload_id', uploadIdentity.current.id)
    form.set('revision', String(property.revision))
    upload.mutate(form)
  }
  return <section className="panel"><h2 className="section-title">Property photos <span className="text-secondary small">({property.photos.length}/8)</span></h2>
    <p className="small text-secondary">JPEG, PNG or WebP. Up to 3MB and 12 megapixels each. Photos remain private while your property is a draft.</p>
    <ErrorNotice error={upload.error || remove.error || order.error} />
    <div className="photo-grid">{property.photos.map((photo,index) => <figure key={photo.id}><img src={photo.url} alt={photo.caption} /><figcaption>{index === 0 ? 'Cover - ' : ''}{photo.caption}</figcaption>{editable && <div className="d-flex gap-1 flex-wrap mb-2"><button className="btn btn-sm btn-outline-primary" disabled={index === 0 || order.isPending || upload.isPending || remove.isPending} onClick={() => reorder(index,0)}>Make cover</button><button className="btn btn-sm btn-outline-secondary" aria-label={'Move photo ' + (index+1) + ' earlier'} disabled={index === 0 || order.isPending || upload.isPending || remove.isPending} onClick={() => reorder(index,index-1)}>Earlier</button><button className="btn btn-sm btn-outline-secondary" aria-label={'Move photo ' + (index+1) + ' later'} disabled={index === property.photos.length-1 || order.isPending || upload.isPending || remove.isPending} onClick={() => reorder(index,index+1)}>Later</button></div>}{editable && <button className="btn btn-sm btn-outline-danger" disabled={remove.isPending || upload.isPending || order.isPending} onClick={() => { if (property.status !== 'approved' || canReplaceOthers()) remove.mutate(photo.id) }} aria-label={'Remove ' + photo.caption}>Remove</button>}</figure>)}</div>
    {editable && property.photos.length < 8 && <form key={inputKey} onSubmit={submit} onChange={() => setDirty(true)} className="upload-form"><fieldset disabled={upload.isPending || remove.isPending || order.isPending}>
      <Field label="Choose a photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
      <Field label="Photo description" name="caption" placeholder="e.g. Shared room facing the courtyard" maxLength={160} />
      <button className="btn btn-outline-primary w-100" disabled={upload.isPending || remove.isPending || order.isPending}>{upload.isPending ? 'Uploading…' : 'Upload photo'}</button>
    </fieldset></form>}
  </section>
}

function Profile() {
  const [profileDirty, setProfileDirty] = useState(false)
  const [passwordDirty, setPasswordDirty] = useState(false)
  const clearProfile = useUnsavedChanges(profileDirty)
  useUnsavedChanges(passwordDirty)
  const clearAllUnsaved = useClearUnsavedChanges()
  const campuses = useCampuses()
  const [selectedCampus, setSelectedCampus] = useState(null)
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const nameChange = useMutation({ mutationFn: (data) => writeApi('patch', '/me', data), onSuccess: (data) => { clearProfile(); setProfileDirty(false); client.setQueryData(['me'], data) } })
  const passwordChange = useMutation({
    mutationFn: (data) => writeApi('patch', '/me/password', data),
    onSuccess: () => { clearAllUnsaved(); setProfileDirty(false); setPasswordDirty(false); client.clear(); client.setQueryData(['me'], null); navigate('/login') },
  })
  return <section className="container page-space narrow-page"><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1>
    <div className="panel mt-4"><h2 className="section-title">About you</h2><p className="text-secondary">{user?.email} · {user?.role}</p><ErrorNotice error={nameChange.error} />
      <form onChange={() => setProfileDirty(true)} onSubmit={(event) => { event.preventDefault(); nameChange.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={nameChange.isPending || passwordChange.isPending}>
        <Field label="Your name" name="name" defaultValue={user?.name} required maxLength={100} />
        {user?.role === 'student' && <><CampusSearch campuses={campuses.data || []} value={selectedCampus ?? String(user?.preferred_campus_id || '')} onChange={value => { setSelectedCampus(value); setProfileDirty(true) }} name="preferred_campus_id" /><ErrorNotice error={campuses.error} retry={() => campuses.refetch()} /></>}
        <button className="btn btn-primary" disabled={nameChange.isPending}>Save profile</button>
        {nameChange.isSuccess && <span className="ms-3 text-success" role="status">Saved.</span>}
      </fieldset></form></div>
    <div className="panel mt-4"><h2 className="section-title">Change password</h2><p className="small text-secondary">Changing your password signs you out of all sessions.</p><ErrorNotice error={passwordChange.error} />
      <form onChange={event => setPasswordDirty([...new FormData(event.currentTarget).values()].some(value => String(value).length > 0))} onSubmit={(event) => { event.preventDefault(); if (profileDirty && !window.confirm('Changing your password signs you out. Discard your unsaved profile changes?')) return; passwordChange.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={passwordChange.isPending || nameChange.isPending}>
        <Field label="Current password" name="current_password" type="password" autoComplete="current-password" required />
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters, including letters and numbers." />
        <Field label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" required />
        <button className="btn btn-outline-primary" disabled={passwordChange.isPending}>Change password</button>
      </fieldset></form></div>
  </section>
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route errorElement={<section className="container page-space"><h1>Something went wrong.</h1><p>Your saved work is still available. Reload this page to try again.</p><button className="btn btn-primary me-3" onClick={() => window.location.reload()}>Reload page</button><Link to="/">Return home</Link></section>} element={<UnsavedChangesProvider><ComparisonProvider><Layout><Suspense fallback={<div className="container page-space"><Loading>Loading page...</Loading></div>}><Outlet /></Suspense></Layout></ComparisonProvider></UnsavedChangesProvider>}>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage register />} />
    <Route path="/listings" element={<Listings />} />
    <Route path="/listings/:id" element={<ListingDetails />} />
    <Route path="/compare" element={<Comparison />} />
    <Route path="/favorites" element={<Protected role="student"><Listings favorites /></Protected>} />
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
    <Route path="/landlord" element={<Protected role="landlord"><Landlord /></Protected>} />
    <Route path="/landlord/properties/new" element={<Protected role="landlord"><PropertyEditor /></Protected>} />
    <Route path="/landlord/properties/:id" element={<Protected role="landlord"><PropertyEditor /></Protected>} />
    <Route path="*" element={<section className="container page-space"><h1>We couldn’t find that page.</h1><Link to="/">Return home</Link></section>} />
  </Route>
))

export default function App() {
  return <RouterProvider router={router} />
}

