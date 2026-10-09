import { useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fieldErrors, writeApi } from './lib/api'
import { useCurrentUser } from './lib/auth'
import { ErrorNotice, Field, Loading } from './components/Feedback'
import Brand from './components/Brand'
import { RoomManager, SubmissionPanel } from './components/RoomOptions'
import { Listings, ListingDetails, Comparison } from './components/ListingPages'
import { ReviewQueue, ReviewDetails } from './components/ReviewPages'
import { InquiryList, InquiryThread } from './components/InquiryPages'
import ComparisonProvider from './components/ComparisonProvider'

function Layout({ children }) {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: () => writeApi('post', '/auth/logout'),
    onSuccess: () => { client.clear(); client.setQueryData(['me'], null); navigate('/') },
  })
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><div className="container d-flex align-items-center justify-content-between gap-3">
      <Link className="brand-link" to="/" aria-label="DormFinder home"><Brand /></Link>
      <nav aria-label="Main navigation" className="d-flex align-items-center gap-2 gap-md-3">
        <Link className="nav-link" to="/listings">Browse</Link>
        <span className="campus-nav d-none d-md-inline">TIP Manila</span>
        {user ? <>
          <Link className="nav-link" to={user.role === 'landlord' ? '/landlord' : user.role === 'admin' ? '/admin' : '/account'}>{user.role === 'admin' ? 'Reviews' : 'My space'}</Link>
          {['student', 'landlord'].includes(user.role) && <Link className="nav-link" to="/inquiries">Inquiries</Link>}
          {user.role === 'student' && <Link className="nav-link" to="/favorites">Favorites</Link>}
          <Link className="nav-link d-none d-sm-inline" to="/profile">Profile</Link>
          <button className="btn btn-outline-secondary btn-sm" disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</button>
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
      <span>TIP Manila first. More campuses in the future.</span>
    </div></footer>
  </>
}

function Home() {
  return <>
    <section className="hero"><div className="container"><div className="row align-items-center g-5">
      <div className="col-lg-6">
        <span className="eyebrow"><span className="status-dot" /> STARTING WITH TIP MANILA</span>
        <h1>A place to stay.<br /><span>A little closer<br className="d-none d-lg-block" /> to your future.</span></h1>
        <p className="hero-copy">Less searching through scattered posts. More clarity about the place you’ll call home during your student years.</p>
        <div className="d-flex flex-wrap gap-3 mt-4">
          <Link className="btn btn-primary btn-lg" to="/listings">Browse listings <span aria-hidden="true">↗</span></Link>
          <Link className="btn btn-link text-dark" to="/register?role=landlord">List your property</Link>
        </div>
        <p className="small text-secondary mt-3">Explore reviewed listings, compare room costs, and ask owners privately.</p>
      </div>
      <div className="col-lg-6"><div className="hero-art" aria-label="An illustration of a student room near campus" role="img">
        <svg viewBox="0 0 600 460" className="room-illustration" aria-hidden="true">
          <rect x="30" y="25" width="540" height="410" rx="28" fill="#e1ebe6" />
          <path d="M60 80h480v300H60z" fill="#f6f3e9" />
          <path d="m60 380 240-80 240 80v35H60z" fill="#d7c5a6" />
          <path d="M300 80v220" stroke="#dbd8ca" strokeWidth="2" />
          <rect x="340" y="112" width="146" height="140" rx="8" fill="#b8d9cd" />
          <path d="M345 211q36-52 70-20t66-7v61H345z" fill="#91b9a9" />
          <circle cx="453" cy="142" r="19" fill="#f8e3a3" />
          <path d="M413 114v136m-69-64h138" stroke="#fffdf7" strokeWidth="8" />
          <rect x="95" y="207" width="156" height="81" rx="10" fill="#e0bda7" />
          <path d="m95 268 159 2 60 49-168 12Z" fill="#fffdf7" />
          <path d="m146 307 168-6v43H146z" fill="#244d49" />
          <path d="m95 270 51 37v37l-51-43z" fill="#367369" />
          <path d="M112 305v52m180-14v25" stroke="#726350" strokeWidth="9" />
          <path d="m112 271 58-2 21 18-60 4z" fill="#f5eddd" />
          <rect x="371" y="295" width="133" height="12" rx="4" fill="#a67b53" />
          <path d="M382 307v68m108-68v68" stroke="#a67b53" strokeWidth="9" />
          <rect x="408" y="262" width="58" height="33" rx="3" fill="#284844" />
          <rect x="414" y="267" width="46" height="23" rx="2" fill="#b4d0bc" />
          <path d="M474 285v-27l17-15" fill="none" stroke="#b39253" strokeWidth="5" />
          <path d="m482 240 24 8-24 12z" fill="#d8b85c" />
          <path d="M335 354v-74" stroke="#54816b" strokeWidth="5" />
          <path d="M335 311q-48-35-39-53 41 0 39 53m0-15q44-48 53-27-10 28-53 27" fill="#699983" />
          <path d="M316 339h41l-8 46h-25z" fill="#c68f6b" />
          <rect x="128" y="116" width="80" height="58" rx="4" fill="#fff" />
          <path d="m140 161 24-30 30 30z" fill="#d6bd78" />
          <circle cx="187" cy="131" r="8" fill="#e9ad8d" />
        </svg>
        <div className="art-note"><span className="note-icon" aria-hidden="true">⌂</span><div><strong>Your next chapter starts here.</strong><small>Find your place near campus.</small></div></div>
        <span className="illustration-caption">An illustration of the possibilities.</span>
      </div></div>
    </div></div></section>
    <section className="container values-section">
      <div className="row g-4">
        {[
          ['01', 'Know what you’re paying for', 'Monthly rent, deposits, and utility terms belong together. No more guessing from a caption.'],
          ['02', 'Put campus in the picture', 'Understand where a property is and its approximate straight-line distance from your campus.'],
          ['03', 'Start a conversation', 'A dedicated place for students and property owners to ask questions and keep their replies together.'],
        ].map(([number, title, description]) => <div className="col-md-4" key={number}><article className="value-card"><span>{number}</span><h2>{title}</h2><p>{description}</p></article></div>)}
      </div>
    </section>
  </>
}

function AuthPage({ register = false }) {
  const [role, setRole] = useState(() => new URLSearchParams(window.location.search).get('role') === 'landlord' ? 'landlord' : 'student')
  const navigate = useNavigate()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => writeApi('post', register ? '/auth/register/' + role : '/auth/login', values),
    onSuccess: (user) => { client.setQueryData(['me'], user); navigate(user.role === 'landlord' ? '/landlord' : user.role === 'admin' ? '/admin' : '/account') },
  })
  function submit(event) {
    event.preventDefault()
    mutation.mutate(Object.fromEntries(new FormData(event.currentTarget)))
  }
  const errors = fieldErrors(mutation.error)
  return <div className="container page-space"><div className="auth-grid">
    <aside className="auth-intro"><span className="eyebrow">A LITTLE CLOSER TO CAMPUS</span><h1>{register ? 'Make room for your next chapter.' : 'Welcome back to your space.'}</h1><p>{register ? 'A clearer housing search starts with a simple introduction.' : 'Your listings and conversations, all in one place.'}</p><div className="campus-card">⌖ <span>Technological Institute of the Philippines<strong>Manila</strong></span></div></aside>
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
      <p className="small mt-4 mb-0">{register ? 'Already have an account? ' : 'New to DormFinder? '}<Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="small text-secondary mt-3 mb-0">Administrator accounts are created through a controlled process. No email recovery is available during early access.</p>
    </section>
  </div></div>
}

function Protected({ children, role }) {
  const query = useCurrentUser()
  if (query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /></div>
  if (!query.data) return <Navigate to="/login" replace />
  if (role && !(Array.isArray(role) ? role : [role]).includes(query.data.role)) return <Navigate to="/account" replace />
  return children
}

function Account() {
  const { data: user } = useCurrentUser()
  if (user?.role === 'landlord') return <Navigate to="/landlord" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  return <section className="container page-space"><span className="eyebrow">MY SPACE</span><h1>Welcome, {user?.name}.</h1><div className="panel empty-state mt-4"><span className="empty-icon" aria-hidden="true">⌂</span><h2>Find a place that fits your student life.</h2><p>Browse reviewed listings, compare selected room options, and keep your questions in private conversations.</p><div className="d-flex justify-content-center gap-3 flex-wrap"><Link className="btn btn-primary" to="/listings">Browse listings</Link><Link className="btn btn-outline-primary" to="/inquiries">Your inquiries</Link></div></div></section>
}

function Landlord() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['properties', page], queryFn: async () => (await api.get('/landlord/properties', { params: { page } })).data, retry: false, refetchInterval: 240_000 })
  return <section className="container page-space">
    <div className="page-heading"><div><span className="eyebrow">PROPERTY OWNER WORKSPACE</span><h1>Your properties</h1><p>Start with the details. Keep everything in one place.</p></div><Link to="/landlord/properties/new" className="btn btn-primary">+ Add a property</Link></div>
    <div className="info-strip"><strong>A good listing starts with clarity.</strong><span>Prepare your property details and photos. Drafts are only visible to you.</span></div>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> :
      query.data.data.length ? <div className="row g-4 mt-1">{query.data.data.map((property) => <div className="col-md-6 col-xl-4" key={property.id}>
        <article className="property-card">
          <div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} /> : <span aria-hidden="true">⌂</span>}<span className="status-badge">{property.status.replaceAll('_', ' ')}</span></div>
          <div className="p-4"><p className="small text-secondary text-uppercase mb-2">{property.property_type.replaceAll('_', ' ')}</p><h2>{property.title}</h2><p className="text-secondary">{property.address || property.city}</p><Link className="stretched-link" to={'/landlord/properties/' + property.id}>Manage property <span aria-hidden="true">→</span></Link></div>
        </article>
      </div>)}</div> : <div className="panel empty-state"><span className="empty-icon" aria-hidden="true">⌂</span><h2>Make a little room for possibility.</h2><p>Add your first property and prepare it for students looking near TIP Manila.</p><Link className="btn btn-outline-primary" to="/landlord/properties/new">Create your first draft</Link></div>}
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
  const client = useQueryClient()
  const navigate = useNavigate()
  const editable = !property || ['draft', 'rejected', 'approved'].includes(property.status)
  const mutation = useMutation({
    mutationFn: (values) => writeApi(property ? 'patch' : 'post', '/landlord/properties' + (property ? '/' + property.id : ''), values),
    onSuccess: async (saved) => {
      client.setQueryData(['property', String(saved.id)], saved)
      await client.invalidateQueries({ queryKey: ['properties'] })
      navigate('/landlord/properties/' + saved.id)
    },
  })
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
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
      <form onSubmit={submit}><fieldset disabled={!editable}>
        <Field label="Property name" name="title" defaultValue={property?.title} required maxLength={150} placeholder="e.g. Casal Student Residence" error={errors} />
        <div className="mb-3"><label className="form-label" htmlFor="property_type">Property type</label><select className="form-select" id="property_type" name="property_type" defaultValue={property?.property_type || 'dormitory'}>
          <option value="dormitory">Dormitory</option><option value="apartment">Apartment</option><option value="boarding_house">Boarding house</option><option value="rental_room">Rental room</option>
        </select></div>
        <Field as="textarea" label="About the property" name="description" defaultValue={property?.description} rows={4} maxLength={5000} hint="Describe the property honestly. Do not include private contact details." error={errors} />
        <Field label="Street address" name="address" defaultValue={property?.address} maxLength={255} error={errors} />
        <Field label="City" name="city" defaultValue={property?.city || 'Manila'} required maxLength={100} error={errors} />
        <div className="row"><div className="col-sm-6"><Field label="Latitude (optional)" name="latitude" type="number" step="any" min="-90" max="90" defaultValue={property?.latitude} error={errors} /></div><div className="col-sm-6"><Field label="Longitude (optional)" name="longitude" type="number" step="any" min="-180" max="180" defaultValue={property?.longitude} error={errors} /></div></div>
        <button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save draft'}</button>
      </fieldset></form>
    </section>{property && <RoomManager property={property} />}</div><div className="col-lg-5">
      {property ? <PhotoManager property={property} /> : <aside className="panel muted-panel"><span className="empty-icon" aria-hidden="true">▧</span><h2 className="section-title">Let your place speak for itself.</h2><p>Save your draft to add photos. Clear, recent images help students understand the space.</p></aside>}
      {property && <SubmissionPanel property={property} />}
      <aside className="editor-note mt-4"><h2>Good to know</h2><p>Drafts are private. Add room options and submit complete listings for review. Material changes require another review.</p><p className="mb-0">Content review is not a safety inspection or ownership verification.</p></aside>
    </div></div>
  </section>
}

function PhotoManager({ property }) {
  const client = useQueryClient()
  const [inputKey, setInputKey] = useState(0)
  const editable = ['draft', 'rejected', 'approved'].includes(property.status)
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['property', String(property.id)] }),
      client.invalidateQueries({ queryKey: ['properties'] }),
    ])
  }
  const upload = useMutation({
    mutationFn: (data) => writeApi('post', '/landlord/properties/' + property.id + '/photos', data),
    onSuccess: async () => { setInputKey((key) => key + 1); await refresh() },
    onError: refresh,
  })
  const remove = useMutation({
    mutationFn: (photoId) => writeApi('delete', '/landlord/properties/' + property.id + '/photos/' + photoId, { revision: property.revision }),
    onSettled: refresh,
  })
  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    form.set('upload_id', crypto.randomUUID())
    form.set('revision', String(property.revision))
    upload.mutate(form)
  }
  return <section className="panel"><h2 className="section-title">Property photos <span className="text-secondary small">({property.photos.length}/8)</span></h2>
    <p className="small text-secondary">JPEG, PNG or WebP. Up to 3MB and 12 megapixels each. Photos remain private while your property is a draft.</p>
    <ErrorNotice error={upload.error || remove.error} />
    <div className="photo-grid">{property.photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.caption} /><figcaption>{photo.caption}</figcaption>{editable && <button className="btn btn-sm btn-outline-danger" disabled={remove.isPending || upload.isPending} onClick={() => remove.mutate(photo.id)} aria-label={'Remove ' + photo.caption}>Remove</button>}</figure>)}</div>
    {editable && property.photos.length < 8 && <form key={inputKey} onSubmit={submit} className="upload-form">
      <Field label="Choose a photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
      <Field label="Photo description" name="caption" placeholder="e.g. Shared room facing the courtyard" maxLength={160} />
      <button className="btn btn-outline-primary w-100" disabled={upload.isPending || remove.isPending}>{upload.isPending ? 'Uploading…' : 'Upload photo'}</button>
    </form>}
  </section>
}

function Profile() {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const nameChange = useMutation({ mutationFn: (data) => writeApi('patch', '/me', data), onSuccess: (data) => client.setQueryData(['me'], data) })
  const passwordChange = useMutation({
    mutationFn: (data) => writeApi('patch', '/me/password', data),
    onSuccess: () => { client.clear(); client.setQueryData(['me'], null); navigate('/login') },
  })
  return <section className="container page-space narrow-page"><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1>
    <div className="panel mt-4"><h2 className="section-title">About you</h2><p className="text-secondary">{user?.email} · {user?.role}</p><ErrorNotice error={nameChange.error} />
      <form onSubmit={(event) => { event.preventDefault(); nameChange.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}>
        <Field label="Your name" name="name" defaultValue={user?.name} required maxLength={100} />
        <button className="btn btn-primary" disabled={nameChange.isPending}>Save name</button>
        {nameChange.isSuccess && <span className="ms-3 text-success" role="status">Saved.</span>}
      </form></div>
    <div className="panel mt-4"><h2 className="section-title">Change password</h2><p className="small text-secondary">Changing your password signs you out of all sessions.</p><ErrorNotice error={passwordChange.error} />
      <form onSubmit={(event) => { event.preventDefault(); passwordChange.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}>
        <Field label="Current password" name="current_password" type="password" autoComplete="current-password" required />
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters, including letters and numbers." />
        <Field label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" required />
        <button className="btn btn-outline-primary" disabled={passwordChange.isPending}>Change password</button>
      </form></div>
  </section>
}

export default function App() {
  return <BrowserRouter><ComparisonProvider><Layout><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage register />} />
    <Route path="/listings" element={<Listings />} />
    <Route path="/listings/:id" element={<ListingDetails />} />
    <Route path="/compare" element={<Protected role="student"><Comparison /></Protected>} />
    <Route path="/favorites" element={<Protected role="student"><Listings favorites /></Protected>} />
    <Route path="/admin" element={<Protected role="admin"><ReviewQueue /></Protected>} />
    <Route path="/admin/reviews/:id" element={<Protected role="admin"><ReviewDetails /></Protected>} />
    <Route path="/inquiries" element={<Protected role={['student', 'landlord']}><InquiryList /></Protected>} />
    <Route path="/inquiries/:id" element={<Protected role={['student', 'landlord']}><InquiryThread /></Protected>} />
    <Route path="/account" element={<Protected><Account /></Protected>} />
    <Route path="/profile" element={<Protected><Profile /></Protected>} />
    <Route path="/landlord" element={<Protected role="landlord"><Landlord /></Protected>} />
    <Route path="/landlord/properties/new" element={<Protected role="landlord"><PropertyEditor /></Protected>} />
    <Route path="/landlord/properties/:id" element={<Protected role="landlord"><PropertyEditor /></Protected>} />
    <Route path="*" element={<section className="container page-space"><h1>We couldn’t find that page.</h1><Link to="/">Return home</Link></section>} />
  </Routes></Layout></ComparisonProvider></BrowserRouter>
}

