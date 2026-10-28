import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import OwnerAvailabilityPanel from './OwnerAvailabilityPanel'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useRequireSavedChanges } from '../lib/useUnsavedChanges'
import ActionDialog from './ActionDialog'
import { ErrorNotice } from './Feedback'

export default function OwnerListingActions({ property, compact = false }) {
  const client = useQueryClient()
  const requireSaved = useRequireSavedChanges()
  const location = useLocation(), navigate = useNavigate()
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  const removed = property.status === 'archived'
  const restricted = property.status === 'suspended'
  const approved = property.status === 'approved'
  const mutation = useMutation({ mutationKey: ['property-write', property.id], mutationFn: values => writeApi('post', `/landlord/properties/${property.id}/${values.action === 'pause' ? 'visibility' : 'lifecycle'}`, { action: values.action, revision: values.revision, ...(values.action === 'pause' ? {} : { reason: values.action === 'archive' ? 'Archived by the property owner after withdrawing the property.' : 'Property owner restored the listing to continue editing as a draft.' }) }), onSuccess: async (data, values) => {
    setAction(null)
    const message = values.action === 'pause' ? 'Listing paused. Conversations and existing viewing requests stay available.' : data.status === 'archived' ? 'Listing archived. Find it under Archived in Your properties.' : 'Restored as a draft. Check its details and submit it for review when ready.'
    if (location.pathname === '/landlord') navigate(location.pathname + location.search, { replace: true, state: { ...location.state, notice: message } }); else setNotice(message)
    client.setQueryData(['property', String(property.id)], data)
    await Promise.all(['properties', 'listings', 'listings-map', 'dashboard', 'notifications', 'notification-unread', 'audit'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
  function open(value) {
    if (!requireSaved()) return
    mutation.reset()
    setAction({ action: value, revision: property.revision })
  }
  const title = action?.action === 'pause' ? 'Pause listing' : action?.action === 'restore' ? 'Restore as draft' : 'Archive listing'
  const controls = <>
    {!compact && approved && <OwnerAvailabilityPanel property={property} resume={property.owner_paused} label={property.owner_paused ? 'Resume listing' : 'Update availability'} />}
    {approved && !property.owner_paused && <button type="button" className="btn btn-outline-secondary" onClick={() => open('pause')}>Pause listing</button>}
    {!restricted && <button type="button" className={compact ? (removed ? 'btn btn-primary' : undefined) : 'btn ' + (removed ? 'btn-outline-primary' : 'btn-outline-danger')} onClick={() => open(removed ? 'restore' : 'archive')}>{removed ? 'Restore as draft' : 'Archive listing'}</button>}
    {!compact && removed && <Link className="btn btn-link" to="/landlord?view=archived">View archived properties</Link>}
  </>
  return <section className={compact ? 'owner-card-removal' : 'owner-listing-actions'} aria-label="Listing visibility">
    {!compact && <><h2>{property.status === 'draft' ? 'Draft visibility' : 'Listing visibility'}</h2><p>{visibilityDescription(property)}</p></>}
    {notice && <p className="owner-save-feedback" role="status">{notice}</p>}
    {compact ? controls : <div className="owner-visibility-controls">{controls}</div>}
    <ActionDialog open={!!action} title={title} closeDisabled={mutation.isPending} onClose={() => { if (!mutation.isPending) setAction(null) }}>
      <p>{title}: <strong>{property.title}</strong>?</p>
      <p>{action?.action === 'pause' ? 'This hides the property from Browse without removing its approval. Messages and existing viewing requests stay available. Confirm current vacancies when resuming.' : action?.action === 'restore' ? 'It stays hidden from students until you check the details and submit it for a new review.' : 'Photos, messages and viewing history are kept. You can restore it as a draft from Archived later.'}</p>
      <ErrorNotice error={mutation.error} />
      <div className="owner-action-confirmation"><button type="button" className="btn btn-outline-secondary" disabled={mutation.isPending} onClick={() => setAction(null)}>Cancel</button><button type="button" className={'btn ' + (action?.action === 'archive' ? 'btn-danger' : 'btn-primary')} disabled={mutation.isPending} onClick={() => { if (requireSaved()) mutation.mutate(action) }}>{mutation.isPending ? 'Saving…' : title}</button></div>
    </ActionDialog>
  </section>
}

function visibilityDescription(property) {
  if (property.status === 'draft') return 'This draft is private and does not appear in Browse. Complete the required details and submit it for review when ready. Archive it if you no longer plan to publish it.'
  if (property.status === 'pending_review') return 'Your listing is private while it awaits administrator review. Archiving it withdraws the submission. You can restore it as a draft later.'
  if (property.status === 'rejected') return 'Your listing is private while you make the requested changes. Resubmit it for review when ready, or archive it if you no longer plan to offer the property.'
  if (property.status === 'suspended') return 'An administrator has restricted this listing. It is hidden from Browse, and publishing actions are unavailable. Read the review feedback for details.'
  if (property.status === 'archived') return 'This property is archived and hidden from Browse. Restore it as a draft to check its details and submit it for a new review.'
  if (property.owner_paused) return 'Advertising is paused. Use Resume listing to check the current vacancy counts and advertise it again. Messages and existing viewing requests remain available.'
  if (property.room_options?.length && property.room_options.every(option => option.available_units === 0)) return 'Every room is marked occupied, so this listing is outside available Browse results. Use Update availability when a vacancy opens. You can also pause advertising or archive the property.'
  if (property.availability?.status === 'hidden') return 'Availability confirmation has expired, so this listing is outside Browse results. Use Update availability to confirm current vacancies. You can also pause advertising or archive the property.'
  return 'This approved listing can appear in Browse while vacancies are current. Update availability when beds or rooms fill up, pause advertising temporarily, or archive the property when you stop offering it.'
}
