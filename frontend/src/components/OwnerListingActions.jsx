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
  return <section className={compact ? 'owner-card-removal' : 'owner-listing-actions'} aria-label="Listing visibility">
    {!compact && <><h2>Listing visibility</h2><p>{restricted ? 'This listing is restricted by an administrator. Read the review feedback for details.' : removed ? 'This property is archived. Restore it as a draft when you want to offer it again.' : property.owner_paused ? 'Advertising is paused. Review the current vacancy counts to resume. Messages and existing viewing requests remain available.' : 'Pause advertising temporarily, or archive the property when withdrawing it. Use Update availability when rooms fill up or become available.'}</p></>}
    {notice && <p className="owner-save-feedback" role="status">{notice}</p>}
    {!compact && property.owner_paused && property.status === 'approved' && <OwnerAvailabilityPanel property={property} resume label="Resume listing" />}
    {property.status === 'approved' && !property.owner_paused && <button type="button" className="btn btn-outline-secondary" onClick={() => open('pause')}>Pause listing</button>}
    {!restricted && <button type="button" className={compact ? (removed ? 'btn btn-primary' : undefined) : 'btn ' + (removed ? 'btn-outline-primary' : 'btn-outline-danger')} onClick={() => open(removed ? 'restore' : 'archive')}>{removed ? 'Restore as draft' : 'Archive listing'}</button>}
    {!compact && removed && <Link className="btn btn-link" to="/landlord?view=archived">View archived properties</Link>}
    <ActionDialog open={!!action} title={title} closeDisabled={mutation.isPending} onClose={() => { if (!mutation.isPending) setAction(null) }}>
      <p>{title}: <strong>{property.title}</strong>?</p>
      <p>{action?.action === 'pause' ? 'This hides the property from Browse without removing its approval. Messages and existing viewing requests stay available. Confirm current vacancies when resuming.' : action?.action === 'restore' ? 'It stays hidden from students until you check the details and submit it for a new review.' : 'Photos, messages and viewing history are kept. You can restore it as a draft from Archived later.'}</p>
      <ErrorNotice error={mutation.error} />
      <div className="owner-action-confirmation"><button type="button" className="btn btn-outline-secondary" disabled={mutation.isPending} onClick={() => setAction(null)}>Cancel</button><button type="button" className={'btn ' + (action?.action === 'archive' ? 'btn-danger' : 'btn-primary')} disabled={mutation.isPending} onClick={() => { if (requireSaved()) mutation.mutate(action) }}>{mutation.isPending ? 'Saving…' : title}</button></div>
    </ActionDialog>
  </section>
}
