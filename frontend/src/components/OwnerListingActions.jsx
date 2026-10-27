import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useRequireSavedChanges } from '../lib/useUnsavedChanges'
import ActionDialog from './ActionDialog'
import { ErrorNotice } from './Feedback'

export default function OwnerListingActions({ property, compact = false }) {
  const client = useQueryClient()
  const requireSaved = useRequireSavedChanges()
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  const removed = property.status === 'archived'
  const restricted = property.status === 'suspended'
  const mutation = useMutation({ mutationKey: ['property-write', property.id], mutationFn: values => writeApi('post', `/landlord/properties/${property.id}/lifecycle`, { action: values.action, revision: values.revision, reason: values.action === 'archive' ? 'Removed by the property owner from their current listings.' : 'Property owner restored the listing to continue editing as a draft.' }), onSuccess: async data => {
    setAction(null)
    setNotice(data.status === 'archived' ? 'Listing removed. You can find it under Removed in Your properties.' : 'Restored as a draft. Check its details and submit it for review when ready.')
    client.setQueryData(['property', String(property.id)], data)
    await Promise.all(['properties', 'listings', 'listings-map', 'dashboard', 'notifications', 'audit'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
  function open() {
    if (!requireSaved()) return
    mutation.reset()
    setAction({ action: removed ? 'restore' : 'archive', revision: property.revision })
  }
  return <section className={compact ? 'owner-card-removal' : 'owner-listing-actions'} aria-label="Listing visibility">
    {!compact && <><h2>Listing visibility</h2><p>{restricted ? 'This listing is restricted by an administrator. Read the review feedback for details.' : removed ? 'This listing is removed from Browse. Restore it as a draft when you want to list it again.' : 'Remove this listing when you no longer want to offer the property. To keep it listed and update which rooms are taken, use Rooms & costs.'}</p></>}
    {notice && <p className="owner-save-feedback" role="status">{notice}</p>}
    {!restricted && <button type="button" className={compact ? undefined : 'btn ' + (removed ? 'btn-outline-primary' : 'btn-outline-danger')} onClick={open}>{removed ? 'Restore as draft' : 'Remove listing'}</button>}
    {!compact && removed && <Link className="btn btn-link" to="/landlord?view=archived">View removed properties</Link>}
    <ActionDialog open={!!action} title={action?.action === 'restore' ? 'Restore as draft' : 'Remove listing'} closeDisabled={mutation.isPending} onClose={() => { if (!mutation.isPending) setAction(null) }}>
      <p>{action?.action === 'restore' ? 'Restore' : 'Remove'} <strong>{property.title}</strong>{action?.action === 'restore' ? ' as a draft?' : ' from your current properties and Browse?'}</p>
      <p>{action?.action === 'restore' ? 'It stays hidden from students until you check the details and submit it for a new review.' : 'Photos, messages and viewing history are kept. You can restore it as a draft from Removed later.'}</p>
      <ErrorNotice error={mutation.error} />
      <div className="owner-action-confirmation"><button type="button" className="btn btn-outline-secondary" disabled={mutation.isPending} onClick={() => setAction(null)}>{action?.action === 'restore' ? 'Keep removed' : 'Keep listing'}</button><button type="button" className={'btn ' + (action?.action === 'restore' ? 'btn-primary' : 'btn-danger')} disabled={mutation.isPending} onClick={() => { if (requireSaved()) mutation.mutate(action) }}>{mutation.isPending ? 'Saving…' : action?.action === 'restore' ? 'Restore as draft' : 'Remove listing'}</button></div>
    </ActionDialog>
  </section>
}
