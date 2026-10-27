import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useFormChanges, useRequireSavedChanges } from '../lib/useUnsavedChanges'
import ActionDialog from './ActionDialog'
import AvailabilityStatus from './AvailabilityStatus'
import { ErrorNotice, Field } from './Feedback'

export default function OwnerAvailabilityPanel({ property, resume = false, label = 'Update availability', className = 'btn btn-primary' }) {
  const [snapshot, setSnapshot] = useState(null)
  const [notice, setNotice] = useState('')
  const requireSaved = useRequireSavedChanges()
  const location = useLocation(), navigate = useNavigate()
  return <><button type="button" className={className} onClick={() => { if (requireSaved()) { setNotice(''); setSnapshot(structuredClone(property)) } }}>{label}</button>{notice && <p role="status" className="owner-quick-confirmation">{notice}</p>}{snapshot && <CountsDialog property={snapshot} resume={resume} onClose={() => setSnapshot(null)} onSaved={data => { setSnapshot(null); const message = resume ? 'Listing resumed. Availability confirmed today.' : data.room_options.every(option => option.available_units === 0) ? 'Marked fully occupied. Messages and viewing history are kept.' : 'Availability confirmed today. Students can see the updated counts.'; if (location.pathname === '/landlord') navigate(location.pathname + location.search, { replace: true, state: { ...location.state, notice: message } }); else setNotice(message) }} />}</>
}

function CountsDialog({ property, resume, onClose, onSaved }) {
  const [counts, setCounts] = useState(() => Object.fromEntries(property.room_options.map(option => [option.id, String(option.available_units)])))
  const [problem, setProblem] = useState('')
  const dirty = property.room_options.some(option => counts[option.id] !== String(option.available_units))
  const { clear, canReplaceOthers } = useFormChanges(dirty)
  const client = useQueryClient()
  const save = useMutation({ mutationKey: ['property-write', property.id], mutationFn: options => writeApi('patch', '/landlord/properties/' + property.id + '/availability', { revision: property.revision, options, ...(resume ? { resume: true } : {}) }), onSuccess: async data => {
    clear()
    client.setQueryData(['property', String(property.id)], data)
    onSaved(data)
    await Promise.all(['properties', 'listings', 'listings-map', 'dashboard', 'notifications', 'notification-unread', 'saved-places', 'favorites', 'compare'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
  function close() { if (!save.isPending && (!dirty || window.confirm('Discard these unsaved vacancy counts?'))) { clear(); onClose() } }
  function submit(event) {
    event.preventDefault()
    if (!canReplaceOthers()) return
    const options = property.room_options.map(option => ({ id: option.id, available_units: Number(counts[option.id]) }))
    if (resume && options.every(option => option.available_units === 0)) { setProblem('Enter at least one actual vacancy before resuming. You can keep the listing paused while every room is occupied.'); return }
    setProblem('')
    save.mutate(options)
  }
  return <ActionDialog open title={resume ? 'Resume listing' : 'Update availability'} closeDisabled={save.isPending} onClose={close}><div className="owner-counts-intro"><strong>{property.title}</strong><p>Check how many beds or rooms are available now. Confirm the counts even if nothing has changed.</p>{property.owner_paused && !resume && <p>This property stays paused after updating these counts.</p>}{resume && <p>Confirming these counts returns this approved property to Browse.</p>}</div><form onSubmit={submit}><fieldset disabled={save.isPending}><div className="owner-counts-list">{property.room_options.map(option => <section className="owner-count-row" key={option.id}><div><h3>{option.name}</h3><p>{option.total_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'} in total</p><AvailabilityStatus option={option} /></div><Field label={'Available ' + (option.inventory_type === 'bedspace' ? 'beds' : 'rooms') + ' — ' + option.name} name={'count-' + option.id} type="number" required min="0" max={option.total_units} step="1" value={counts[option.id]} onChange={event => { setCounts(current => ({ ...current, [option.id]: event.target.value })); setProblem(''); save.reset() }} /></section>)}</div><button type="button" className="btn btn-outline-secondary" onClick={() => { setCounts(Object.fromEntries(property.room_options.map(option => [option.id, '0']))); setProblem(''); save.reset() }}>Mark fully occupied</button><p className="owner-fine-print">This sets every count to zero. Your changes are saved only when you confirm below.</p><ErrorNotice error={save.error} />{problem && <p role="alert" className="alert alert-warning">{problem}</p>}<div className="owner-action-confirmation"><button className="btn btn-primary" type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : resume ? 'Confirm counts and resume' : 'Confirm these counts'}</button><button className="btn btn-outline-secondary" type="button" disabled={save.isPending} onClick={close}>Cancel</button></div></fieldset></form></ActionDialog>
}
