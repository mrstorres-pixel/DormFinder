import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fieldErrors, writeApi } from '../lib/api'
import { ErrorNotice, Field, Loading } from './Feedback'
import MapPinPicker from './MapPinPicker'
import { amenities } from '../lib/housing'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { RoomManager, SubmissionPanel } from './RoomOptions'
import { LifecycleControls } from './ModerationPages'
import ListingInformation from './ListingInformation'
import { RoomCharges } from './RoomOptions'
import PhotoGallery from './PhotoGallery'
import { pesos } from '../lib/money'
import { editorSteps, nextEditorStep, listingReadiness, hasLocationPin } from '../lib/listingReadiness'
import './landlord-workspace.css'
import { OwnerAvailability } from './AvailabilityStatus'
import ActionDialog from './ActionDialog'

export function Landlord() {
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [view, setView] = useState('active')
  const query = useQuery({ queryKey: ['properties', page, view], queryFn: async () => (await api.get('/landlord/properties', { params: { page, view } })).data, retry: false, refetchInterval: 240_000 })
  return <section className="container page-space owner-listings" data-tour="owner-workspace">
    <div className="page-heading"><div><span className="eyebrow">PROPERTY OWNER WORKSPACE</span><h1>Your properties</h1><p>Manage your listings and keep availability current.</p></div><Link to="/landlord/properties/new" className="btn btn-primary" data-tour="add-property">+ Add a property</Link></div>
    {location.state?.notice && <p className="alert alert-success" role="status">{location.state.notice}</p>}
    <label className="owner-listing-view">Show properties<select className="form-select" value={view} onChange={event => { setView(event.target.value); setPage(1) }}><option value="active">Active listings and drafts</option><option value="archived">Removed listings</option><option value="all">All properties</option></select></label>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> :
      query.data.data.length ? <div className="row g-4 mt-1">{query.data.data.map((property) => <div className="col-md-6 col-xl-4" key={property.id}>
        <article className="property-card">
          <div className="property-cover">{property.photos[0] ? <img src={property.photos[0].url} alt={property.photos[0].caption} /> : <span aria-hidden="true">⌂</span>}<span className="status-badge">{property.status === 'approved' && property.availability?.status === 'hidden' ? 'Hidden: confirm availability' : property.status.replaceAll('_', ' ')}</span></div>
          <div className="p-4"><p className="small text-secondary text-uppercase mb-2">{property.property_type.replaceAll('_', ' ')}</p><h2>{property.title}</h2><p className="text-secondary">{property.address || property.city}</p><p className="small mb-3">{property.status === 'draft' ? 'Finish details, photos and room options, then submit for review.' : property.status === 'rejected' ? 'Read the review feedback and update your draft before resubmitting.' : property.status === 'pending_review' ? 'Awaiting administrator review. Editing is paused.' : property.status === 'approved' ? '' : 'Open the listing to check its status and available actions.'}</p><OwnerAvailability property={property} compact /><Link className="stretched-link" to={'/landlord/properties/' + property.id + '#' + (property.availability?.status && property.availability.status !== 'current' ? 'rooms' : nextEditorStep(property))}>{property.availability?.status && property.availability.status !== 'current' ? 'Refresh availability' : 'Manage property'} <span aria-hidden="true">→</span></Link></div>
          {!['archived', 'suspended'].includes(property.status) && <OwnerListingRemoval property={property} />}
        </article>
      </div>)}</div> : <div className="panel empty-state"><span className="empty-icon" aria-hidden="true">⌂</span><h2>Make a little room for possibility.</h2><p>Add your first property and prepare it for students looking near their campus.</p><Link className="btn btn-outline-primary" to="/landlord/properties/new">Create your first draft</Link></div>}
    {query.data?.meta.last_page > 1 && <nav aria-label="Property pages" className="d-flex align-items-center gap-3 mt-4">
      <button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page} of {query.data.meta.last_page}</span>
      <button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </section>
}

function OwnerListingRemoval({ property }) {
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const remove = useMutation({ mutationFn: () => writeApi('post', `/landlord/properties/${property.id}/lifecycle`, { action: 'archive', revision: property.revision, reason: 'Removed by the property owner from their active listings.' }), onSuccess: async data => {
    setOpen(false)
    client.setQueryData(['property', String(property.id)], data)
    await Promise.all(['properties', 'listings', 'listings-map', 'dashboard', 'notifications'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
  return <div className="owner-card-removal"><button type="button" onClick={() => { remove.reset(); setOpen(true) }}>Remove listing</button><ActionDialog open={open} title="Remove listing" onClose={() => { if (!remove.isPending) setOpen(false) }}><p>Remove <strong>{property.title}</strong> from your active properties and public search?</p><p>It will be archived under Removed listings. Photos, messages and viewing history are kept. You can restore it as a draft later.</p><ErrorNotice error={remove.error} /><div className="d-flex gap-2"><button type="button" className="btn btn-outline-secondary" disabled={remove.isPending} onClick={() => setOpen(false)}>Keep listing</button><button type="button" className="btn btn-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Removing…' : 'Remove listing'}</button></div></ActionDialog></div>
}

export function PropertyEditor() {
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
  const location = useLocation()
  const [initialStep] = useState(() => property ? nextEditorStep(property) : 'location')
  const step = editorSteps.find(([key]) => '#' + key === location.hash)?.[0] || initialStep
  const existing = !!property
  const busy = useIsMutating({ mutationKey: ['property-write', property?.id || 'new'] }) > 0
  const [coordinates, setCoordinates] = useState({ latitude: property?.latitude ?? '', longitude: property?.longitude ?? '' })
  const [dirty, setDirty] = useState(false)
  const [photosDirty, setPhotosDirty] = useState(false)
  const [roomsDirty, setRoomsDirty] = useState(false)
  const [stepError, setStepError] = useState('')
  const [validationAttempted, setValidationAttempted] = useState(false)
  const locationForm = useRef(null)
  const roomForm = useRef(null)
  const stepMessage = useRef(null)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const client = useQueryClient()
  const navigate = useNavigate()
  const editable = !property || ['draft', 'rejected', 'approved'].includes(property.status)
  useLayoutEffect(() => {
    if (existing && location.hash) document.getElementById('editor-' + step)?.focus({ preventScroll: true })
  }, [existing, location.hash, step])
  const mutation = useMutation({
    mutationKey: ['property-write', property?.id || 'new'],
    mutationFn: ({ values }) => writeApi(property ? 'patch' : 'post', '/landlord/properties' + (property ? '/' + property.id : ''), values),
    onSuccess: async (saved, { intent }) => {
      clearUnsaved(); setDirty(false)
      client.setQueryData(['property', String(saved.id)], saved)
      await client.invalidateQueries({ queryKey: ['properties'] })
      setStepError('')
      if (intent === 'exit') navigate('/landlord', { state: { notice: 'Your draft has been saved. You can continue editing it here.' } })
      else navigate('/landlord/properties/' + saved.id + (property ? '#preview' : '#photos'))
    },
  })
  function submit(event) {
    event.preventDefault()
    if (!canReplaceOthers()) return
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(form)
    if (property) {
      values.amenities = form.getAll('amenities')
      values.latitude = values.latitude || null; values.longitude = values.longitude || null
      values.revision = property.revision
    }
    mutation.mutate({ values, intent: event.nativeEvent.submitter?.value || (property ? 'continue' : 'start') })
  }
  function explain(message) {
    const initiator = document.activeElement
    setStepError(message)
    requestAnimationFrame(() => { if (document.activeElement === initiator) stepMessage.current?.focus() })
  }
  async function go(next) {
    if (busy) return
    setStepError('')
    const target = editorSteps.findIndex(([key]) => key === next)
    const current = editorSteps.findIndex(([key]) => key === step)
    if (target > current && editable) {
      if (photosDirty) { explain('Upload your selected photo, or clear the photo form, before continuing.'); return }
      let savedProperty = property
      if (roomsDirty) {
        if (step !== 'rooms') { navigate('#rooms', { preventScrollReset: true }); explain('Finish your room option here, then save and continue.'); return }
        const saved = await roomForm.current?.save()
        if (!saved) return
        savedProperty = saved
      }
      if (step === 'location') {
        const description = locationForm.current.elements.description
        description.setCustomValidity([...(description.value || '').trim()].length < 40 ? 'Describe the property in at least 40 characters.' : '')
        setValidationAttempted(true)
        if (!locationForm.current.reportValidity()) { setStepError('Complete the highlighted required fields before continuing.'); return }
        if (!hasLocationPin(coordinates)) { explain('Place the property pin on the map, or enter a valid latitude and longitude, before continuing.'); return }
        locationForm.current?.requestSubmit()
        return
      }
      if (dirty) { explain('Save your location changes before continuing.'); navigate('#location', { preventScrollReset: true }); return }
      const missing = listingReadiness(savedProperty).find(item => !item.ready && editorSteps.findIndex(([key]) => key === item.step) < target)
      if (missing) { explain(missing.label + ' before continuing.'); if (missing.step !== step) navigate('#' + missing.step, { preventScrollReset: true }); return }
    }
    setStepError(''); navigate('#' + next, { preventScrollReset: true })
  }
  const errors = fieldErrors(mutation.error)
  if (!property) return <section className="container page-space owner-create">
    <Link className="back-link" to="/landlord">← Your properties</Link>
    <div className="owner-create-intro"><span className="eyebrow">YOUR NEXT LISTING</span><h1>Start with a name.</h1><p>Create a private draft, then add photos, rooms and your location.</p></div>
    <form className="panel" data-tour="listing-basics" onSubmit={submit} onChange={() => setDirty(true)}><ErrorNotice error={mutation.error} /><fieldset disabled={mutation.isPending}>
      <Field label="Property name" name="title" required maxLength={150} placeholder="e.g. Casal Student Residence" error={errors} />
      <label className="form-label" htmlFor="property_type">Property type</label><select className="form-select mb-3" id="property_type" name="property_type" defaultValue="dormitory"><option value="dormitory">Dormitory</option><option value="apartment">Apartment</option><option value="boarding_house">Boarding house</option><option value="rental_room">Rental room</option></select>
      <Field label="City" name="city" defaultValue="Manila" required maxLength={100} error={errors} />
      <button className="btn btn-primary" data-tour="start-listing" value="start" disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Start listing'}</button>
    </fieldset></form><p className="owner-fine-print">Your draft stays private until you submit it and an administrator approves it.</p>
  </section>
  return <section className="container page-space owner-editor">
    <Link className="back-link" to="/landlord">← Your properties</Link>
    <div className="page-heading mt-4"><div><span className="eyebrow">YOUR LISTING</span><h1>{property.title}</h1></div><span className="status-badge position-static">{property.status.replaceAll("_", " ")} · {property.status === "approved" ? (property.availability?.status === "hidden" ? "hidden" : "public") : "private"}</span></div>
    {property.status === 'approved' && <p className="owner-fine-print">Confirm vacancies to keep or restore public visibility. Changes to photos, room terms or property details return it to draft for review.</p>}
    <OwnerAvailability property={property} /><p className="editor-introduction">Complete photos, rooms and location before sending your listing for review. Required fields are marked; optional fields can be left blank.</p><nav className="editor-steps" aria-label="Listing editor steps">{editorSteps.map(([key, label], index) => { const complete = key !== 'preview' && listingReadiness(property).filter(item => item.step === key).every(item => item.ready); return <button type="button" key={key} disabled={busy} className={complete ? 'is-complete' : ''} title={label + (complete ? ': complete' : ': needs details')} aria-current={step === key ? 'step' : undefined} onClick={() => go(key)}><span aria-hidden="true">{complete ? '✓' : index + 1}</span>{label}</button> })}</nav>
    {stepError && <p className="alert alert-warning editor-step-message" role="alert" ref={stepMessage} tabIndex={-1}>{stepError}</p>}
    <div className="editor-stage" id="editor-photos" tabIndex={-1} hidden={step !== 'photos'}><PhotoManager property={property} onDirtyChange={setPhotosDirty} /></div>
    <div className="editor-stage" id="editor-rooms" tabIndex={-1} hidden={step !== 'rooms'}><RoomManager property={property} onDirtyChange={setRoomsDirty} saveRef={roomForm} /></div>
    <div className="editor-stage" id="editor-location" tabIndex={-1} hidden={step !== 'location'}><section className="panel"><h2>Location and property details</h2><ErrorNotice error={mutation.error} />{mutation.isSuccess && <p className="alert alert-success" role="status">Your draft has been saved.</p>}
      <p className="owner-fine-print">Required to continue: a description of at least 40 characters, the street address, city and property pin. Save draft keeps partial details and returns to My space.</p>
      <form ref={locationForm} className={validationAttempted ? 'was-validated' : ''} onInvalidCapture={() => { setValidationAttempted(true); setStepError('Complete the highlighted required fields before continuing.') }} onSubmit={submit} onChange={event => { event.target.setCustomValidity?.(''); setDirty(true); setStepError('') }}><fieldset disabled={!editable || mutation.isPending}>
        <Field label="Property name" name="title" defaultValue={property?.title} required maxLength={150} placeholder="e.g. Casal Student Residence" error={errors} />
        <div className="mb-3"><label className="form-label" htmlFor="property_type">Property type</label><select className="form-select" id="property_type" name="property_type" defaultValue={property?.property_type || 'dormitory'}>
          <option value="dormitory">Dormitory</option><option value="apartment">Apartment</option><option value="boarding_house">Boarding house</option><option value="rental_room">Rental room</option>
        </select></div>
        <Field as="textarea" label="About the property" name="description" defaultValue={property?.description} rows={4} required minLength={40} maxLength={5000} hint="At least 40 characters. Describe the rooms, surroundings and what students should know." error={errors} />
        <Field label="Street address" name="address" defaultValue={property?.address} required maxLength={255} error={errors} />
        <Field label="City" name="city" defaultValue={property?.city || 'Manila'} required maxLength={100} error={errors} />
        <fieldset className="mb-3"><legend className="h3">Shared facilities <small>(optional)</small></legend><p className="small">Select only facilities available at this property.</p><div className="amenity-list">{Object.entries(amenities).map(([value,label]) => <label key={value}><input type="checkbox" name="amenities" value={value} defaultChecked={property?.amenities?.includes(value)} /> {label}</label>)}</div></fieldset><Field label="House rules (optional)" name="house_rules" as="textarea" defaultValue={property?.house_rules} maxLength={2000} rows={3} hint="Include quiet hours, visitor policies, smoking rules or other restrictions." error={errors} /><h3 className="h5 mt-4">Property location <span className="required-field-mark">Required to continue</span></h3><p className="small">Place a pin at the property. A nearby campus only helps you find the area.</p>
        {step === 'location' && <MapPinPicker latitude={coordinates.latitude} longitude={coordinates.longitude} onChange={value => { setCoordinates(value); setDirty(true) }} />}
        <div className="row"><div className="col-sm-6"><Field label="Latitude" name="latitude" type="number" step="any" min="-90" max="90" value={coordinates.latitude} onChange={event => setCoordinates(current => ({ ...current,latitude:event.target.value }))} error={errors} /></div><div className="col-sm-6"><Field label="Longitude" name="longitude" type="number" step="any" min="-180" max="180" value={coordinates.longitude} onChange={event => setCoordinates(current => ({ ...current,longitude:event.target.value }))} error={errors} /></div></div>
        <button type="submit" value="exit" formNoValidate className="btn btn-outline-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save draft'}</button>
      </fieldset></form>
    </section></div>
    <div className="editor-stage" id="editor-preview" tabIndex={-1} hidden={step !== 'preview'}>
      <SubmissionPanel property={property} onEditStep={go} />
      <OwnerPreview property={property} refresh={() => client.invalidateQueries({ queryKey: ['property', String(property.id)] })} />
      <div className="owner-listing-settings"><LifecycleControls property={property} /></div>
    </div>
    <div className="editor-step-footer">{step !== 'photos' ? <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => go(editorSteps[editorSteps.findIndex(([key]) => key === step) - 1][0])}>Previous step</button> : <span />}{step !== 'preview' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => go(editorSteps[editorSteps.findIndex(([key]) => key === step) + 1][0])}>{editable && (step === 'location' || (step === 'rooms' && roomsDirty)) ? 'Save and continue' : 'Continue'}</button>}</div>
  </section>
}

function OwnerPreview({ property, refresh }) {
  const [chosen, setChosen] = useState('')
  const room = property.room_options.find(option => option.id === Number(chosen)) || property.room_options[0]
  return <section className="owner-preview" aria-label="Saved listing preview"><div className="section-heading"><h2>Student preview</h2><span className="owner-fine-print">Saved content · {property.status === 'approved' ? (property.availability?.status === 'hidden' ? 'hidden: confirm availability' : 'public') : 'private'}</span></div>
    <h3>{property.title}</h3><p>{[property.address, property.city].filter(Boolean).join(', ')}</p>
    <PhotoGallery photos={property.photos} refresh={refresh} />
    <div className="owner-preview-details"><div><h3>About this property</h3><p className="preserve-lines">{property.description || 'Add a description in Location & details.'}</p><ListingInformation property={property} /></div><section className="panel"><h3>Rooms and costs</h3>{room ? <><label className="form-label" htmlFor="owner-preview-room">Preview room option</label><select className="form-select" id="owner-preview-room" value={room.id} onChange={event => setChosen(event.target.value)}>{property.room_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><p className="room-price mt-3">{pesos(room.monthly_rent_centavos)} <span>/ month · {room.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><details><summary>Costs and room terms</summary><RoomCharges option={room} /></details></> : <p>Add a room option in Rooms & costs.</p>}</section></div>
  </section>
}

function PhotoManager({ property, onDirtyChange }) {
  const client = useQueryClient()
  const [inputKey, setInputKey] = useState(0)
  const uploadIdentity = useRef({ file: null, caption: '', id: '' })
  const [dirty, setDirty] = useState(false)
  useLayoutEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const editable = ['draft', 'rejected', 'approved'].includes(property.status)
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['property', String(property.id)] }),
      client.invalidateQueries({ queryKey: ['properties'] }),
    ])
  }
  const upload = useMutation({
    mutationKey: ['property-write', property.id],
    mutationFn: (data) => writeApi('post', '/landlord/properties/' + property.id + '/photos', data),
    onSuccess: async () => { clearUnsaved(); setDirty(false); uploadIdentity.current = { file: null, caption: '', id: '' }; setInputKey((key) => key + 1); await refresh() },
    onError: refresh,
  })
  const order = useMutation({ mutationKey: ['property-write', property.id], mutationFn: ids => writeApi('put', '/landlord/properties/' + property.id + '/photos/order', { revision:property.revision, photo_ids:ids }), onSettled:refresh })
  function reorder(index, target) {
    if (property.status === 'approved' && !canReplaceOthers()) return
    const ids = property.photos.map(photo => photo.id); const [id] = ids.splice(index,1); ids.splice(target,0,id); order.mutate(ids)
  }
  const remove = useMutation({
    mutationKey: ['property-write', property.id],
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
      {dirty && <button type="button" className="btn btn-link w-100 mt-2" disabled={upload.isPending} onClick={() => { clearUnsaved(); setDirty(false); uploadIdentity.current = { file: null, caption: '', id: '' }; setInputKey(key => key + 1) }}>Clear photo form</button>}
    </fieldset></form>}
  </section>
}
