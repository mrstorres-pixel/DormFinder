import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi, fieldErrors } from '../lib/api'
import { pesos, toCentavos } from '../lib/money'
import { ErrorNotice, Field } from './Feedback'
import OwnerAvailabilityPanel from './OwnerAvailabilityPanel'
import AvailabilityStatus from './AvailabilityStatus'
import { listingReadiness } from '../lib/listingReadiness'
import { ownerRoomFingerprint } from '../lib/ownerWorkspace'
import { Link } from 'react-router-dom'
import { useRequireSavedChanges, useFormChanges } from '../lib/useUnsavedChanges'

export function RoomCharges({ option, detailsOnly = false }) {
  if (detailsOnly) return <div className="room-charges"><dl className="charge-list"><div><dt>Deposit</dt><dd>{pesos(option.deposit_centavos)}</dd></div><div><dt>Advance rent</dt><dd>{option.advance_months} {option.advance_months === 1 ? 'month' : 'months'}</dd></div>{(option.fees || []).map((fee, index) => <div key={index}><dt>{fee.name} · {fee.frequency === 'monthly' ? 'monthly' : 'one time'}</dt><dd>{pesos(fee.amount_centavos)}</dd></div>)}</dl>{option.utilities_notes && <p className="room-utility-terms">{option.utilities_notes}</p>}</div>
  return <div className="room-charges">
    <p className="availability-label">{option.available_units === 0 ? 'Sold out' : option.availability_stale ? 'Vacancies need confirmation' : 'Available - recently confirmed'}</p>
    <p className="room-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p>
    <dl className="charge-list">
      <div><dt>Inventory</dt><dd>{option.available_units} of {option.total_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'} available</dd></div>
      <div><dt>Room capacity</dt><dd>{option.capacity} people</dd></div>
      <div><dt>Deposit</dt><dd>{pesos(option.deposit_centavos)}</dd></div>
      <div><dt>Advance rent</dt><dd>{option.advance_months} {option.advance_months === 1 ? 'month' : 'months'}</dd></div>
      {option.fees.map((fee, index) => <div key={index}><dt>{fee.name} · {fee.frequency === 'monthly' ? 'monthly' : 'one time'}</dt><dd>{pesos(fee.amount_centavos)}</dd></div>)}
      <div><dt>Known monthly charges</dt><dd>{pesos(option.monthly_fixed_total_centavos)}</dd></div>
      <div><dt>Deposit, advance and one-time fees</dt><dd>{pesos(option.move_in_fixed_total_centavos)}</dd></div>
    </dl>
    <p className="small text-secondary">{option.utilities_notes}</p>
    <AvailabilityStatus option={option} />
    <p className="small text-secondary">Totals cover the stated pricing basis. This is an inquiry service; no booking or payment is made here.</p>
  </div>
}

export function RoomManager({ property, onDirtyChange, saveRef }) {
  const client = useQueryClient()
  const requireSaved = useRequireSavedChanges()
  const confirmRoomReplacement = useRef(() => true)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const editor = useRef(null)
  const [formVersion, setFormVersion] = useState(0)
  const editable = ['draft', 'rejected', 'approved'].includes(property.status)
  async function saved(data, mode = 'rooms') {
    setNotice(mode === 'availability' ? '' : property.status === 'approved' && data.status === 'draft' ? 'Room details saved. Your listing is now a draft and needs review before it is published again.' : 'Room information saved.')
    client.setQueryData(['property', String(property.id)], data)
    await Promise.all(['properties', 'listings', 'listing', 'listings-map', 'saved-places', 'favorites', 'featured-homes', 'comparison', 'notification-unread', 'notifications', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key] })))
    setEditing(null)
    setAdding(false)
    setFormVersion(version => version + 1)
  }
  const remove = useMutation({ mutationKey: ['property-write', property.id], mutationFn: id => writeApi('delete', `/landlord/properties/${property.id}/room-options/${id}`, { revision: property.revision }), onSuccess: saved })
  return <section className="panel mt-4"><h2 className="section-title">{property.status === 'approved' ? 'Rooms and availability' : 'Room options and charges'}</h2>
    <p className="text-secondary small">{property.status === 'approved' ? 'Confirm vacancies below to keep your listing current. Edit changes room details, prices or fees and requires another review.' : 'Describe separate groups of equivalent beds or whole rooms. Do not count the same inventory twice. Saving an option confirms today’s availability.'}</p>
    {property.status === 'approved' && <div className="owner-availability-explainer"><p><strong>Keep your availability current.</strong> Open Update availability, check every room and choose Confirm these counts, even if the number has not changed. Students see the date you confirm.</p><p>In-app reminders start after 14 days, with another warning at 27 days. A room option leaves Browse after 30 days without confirmation. Confirming its actual vacancies makes it visible again while the listing remains approved.</p><p>Reminders appear in your notifications when you return to DormFinder. You can update the count at any time; use 0 for rooms that are taken.</p></div>}
    {property.status === 'approved' && <div className="owner-room-availability-action"><OwnerAvailabilityPanel property={property} label="Update availability" />{property.owner_paused && <OwnerAvailabilityPanel property={property} resume label="Resume listing" className="btn btn-outline-primary" />}</div>}
    <ErrorNotice error={remove.error} />
    {notice && <p className="owner-save-feedback" aria-live="polite">{notice}</p>}
    {(property.room_options || []).map(option => <article className="room-option mb-4" key={option.id}><h3>{option.name}</h3><p className="room-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><p className="small text-secondary">{option.capacity}-person room · {option.available_units} of {option.total_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'} available{option.availability_stale ? ' · Needs confirmation' : ''}</p><details className="owner-room-terms"><summary>Costs and room terms</summary><RoomCharges option={option} /></details>{property.status === 'approved' && <AvailabilityStatus option={option} />}{editable && <div className="d-flex gap-2"><button className="btn btn-sm btn-outline-primary" onClick={() => { if (editing?.id !== option.id && confirmRoomReplacement.current()) { setEditing(option); requestAnimationFrame(() => editor.current?.querySelector('input')?.focus()) } }}>Edit {option.name}</button><button className="btn btn-sm btn-outline-danger" disabled={remove.isPending} onClick={() => { if (property.status === 'approved' && !requireSaved()) return; if (confirmRoomReplacement.current() && window.confirm(`Remove ${option.name}? Existing inquiries will be kept.`)) remove.mutate(option.id) }}>Remove option</button></div>}</article>)}
    {editable && property.status === 'approved' && property.room_options.length > 0 && !editing && !adding && <button type="button" className="btn btn-outline-primary" onClick={() => { setAdding(true); requestAnimationFrame(() => editor.current?.querySelector('input')?.focus()) }}>Add another room option</button>}
    <div ref={editor}>{editable ? (property.status !== 'approved' || editing || adding || !property.room_options.length) && <RoomOptionForm saveRef={saveRef} confirmReplacementRef={confirmRoomReplacement} key={editing ? 'edit-' + editing.id : 'new-' + formVersion} property={property} option={editing} onSaved={saved} onDirtyChange={onDirtyChange} onCancel={() => { setEditing(null); setAdding(false); setFormVersion(value => value + 1) }} /> : <p className="alert alert-info">Room edits are locked while this listing is {property.status.replaceAll('_', ' ')}.</p>}</div>
  </section>
}

function RoomOptionForm({ property, option, onSaved, onCancel, confirmReplacementRef, onDirtyChange, saveRef }) {
  const formRef = useRef(null)
  const saving = useRef(false)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [dirty, setDirty] = useState(false)
  const baseline = useRef({ revision: property.revision, fingerprint: ownerRoomFingerprint(option) })
  function markDirty() { if (!dirty && !option) baseline.current.revision = property.revision; setDirty(true) }
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty, () => save(formRef.current))
  const [inventory, setInventory] = useState(option?.inventory_type || 'bedspace')
  const [values, setValues] = useState(() => ({
    name: option?.name ?? '', capacity: option?.capacity ?? 1,
    total_units: option?.total_units ?? 1, available_units: option?.available_units ?? 1,
    rent: option ? option.monthly_rent_centavos / 100 : '',
    deposit: option ? option.deposit_centavos / 100 : 0,
    advance_months: option?.advance_months ?? 0, utilities_notes: option?.utilities_notes ?? '',
  }))
  function editField(event) {
    const { name, value } = event.target
    setValues(current => ({ ...current, [name]: value }))
    markDirty()
  }
  const [fees, setFees] = useState(() => (option?.fees || []).map(fee => ({ ...fee, key: crypto.randomUUID(), amount: String(fee.amount_centavos / 100) })))
  const mutation = useMutation({
    mutationKey: ['property-write', property.id],
    mutationFn: values => writeApi(option ? 'patch' : 'post', `/landlord/properties/${property.id}/room-options${option ? '/' + option.id : ''}`, values),
    onSuccess: async data => { clearUnsaved(); setDirty(false); await onSaved(data) },
  })
  const pending = mutation.isPending
  useEffect(() => {
    confirmReplacementRef.current = () => !pending && (!dirty || window.confirm('Discard your unsaved room edits?'))
    return () => { confirmReplacementRef.current = () => true }
  }, [confirmReplacementRef, dirty, pending])
  const [amountError, setAmountError] = useState(null)
  const errors = fieldErrors(mutation.error)
  useImperativeHandle(saveRef, () => ({ save: () => save(formRef.current), isValid: () => formRef.current?.checkValidity() ?? true }))
  async function save(form) {
    if (saving.current) return null
    setValidationAttempted(true)
    if (!form.reportValidity()) return null
    if (property.status === 'approved' && !canReplaceOthers()) return null
    const data = Object.fromEntries(new FormData(form))
    if (Number(data.available_units) > Number(data.total_units)) { setAmountError(new Error('Available beds or rooms cannot exceed the total. Check both numbers.')); form.elements.available_units.focus(); return null }
    try {
      setAmountError(null)
      const payload = { name: data.name, inventory_type: inventory, price_basis: inventory === 'bedspace' ? 'per_person' : 'per_room', capacity: Number(data.capacity), total_units: Number(data.total_units), available_units: Number(data.available_units), monthly_rent_centavos: toCentavos(data.rent), deposit_centavos: toCentavos(data.deposit), advance_months: Number(data.advance_months), utilities_notes: data.utilities_notes, revision: option && ownerRoomFingerprint(property.room_options.find(item => item.id === option.id)) === baseline.current.fingerprint ? property.revision : baseline.current.revision, fees: fees.map(fee => ({ name: fee.name, frequency: fee.frequency, amount_centavos: toCentavos(fee.amount) })) }
      saving.current = true
      return await mutation.mutateAsync(payload)
    } catch (error) { if (!error.response) setAmountError(error); return null }
    finally { saving.current = false }
  }
  function changeFee(key, field, value) { setFees(current => current.map(fee => fee.key === key ? { ...fee, [field]: value } : fee)) }
  return <form ref={formRef} onSubmit={event => { event.preventDefault(); void save(event.currentTarget) }} onInvalidCapture={() => setValidationAttempted(true)} onChange={markDirty} className={'room-form' + (validationAttempted ? ' was-validated' : '')}><fieldset disabled={mutation.isPending}><h3>{option ? 'Edit room option' : 'Add a room option'}</h3>
    <p className="small text-secondary">Fill in this option, then choose Save and continue below to save it and move to location details. Use {option ? 'Save room option' : 'Add room option'} to stay here and add another option.</p>
    {validationAttempted && <p className="small text-secondary" role="status">Required fields are marked. Check any highlighted fields before saving.</p>}
    <ErrorNotice error={mutation.error} />{amountError && <p role="alert" className="alert alert-danger">{amountError.message}</p>}
    <Field label="Room option name" name="name" value={values.name} onChange={editField} maxLength={100} required error={errors} />
    <label className="form-label" htmlFor="inventory_type">Inventory and price basis</label><select className="form-select mb-3" id="inventory_type" value={inventory} onChange={event => setInventory(event.target.value)}><option value="bedspace">Bedspace · price per person</option><option value="whole_room">Whole room · price per room</option></select>
    <div className="row"><div className="col-sm-4"><Field label="Room capacity" name="capacity" type="number" min="1" max="20" value={values.capacity} onChange={editField} required hint="People sharing one room." error={errors} /></div><div className="col-sm-4"><Field label="Total units" name="total_units" type="number" min="1" max="1000" value={values.total_units} onChange={editField} required hint={inventory === 'bedspace' ? 'Total beds in this option.' : 'Total separate rooms in this option.'} error={errors} /></div><div className="col-sm-4"><Field label="Available units" name="available_units" type="number" min="0" max={values.total_units || 1000} value={values.available_units} onChange={editField} required hint="Ready to rent now. Use 0 if sold out." error={errors} /></div></div>
    <div className="row"><div className="col-sm-6"><Field label="Monthly rent (PHP)" name="rent" type="number" min="0.01" max="1000000" step="0.01" value={values.rent} onChange={editField} required error={{ rent: errors.monthly_rent_centavos }} /></div><div className="col-sm-6"><Field label="Deposit (PHP)" name="deposit" type="number" min="0" max="1000000" step="0.01" value={values.deposit} onChange={editField} required error={{ deposit: errors.deposit_centavos }} /></div></div>
    <Field label="Advance rent in months" name="advance_months" type="number" min="0" max="12" value={values.advance_months} onChange={editField} required error={errors} />
    <Field label="Utilities and other charge terms" name="utilities_notes" as="textarea" rows={3} value={values.utilities_notes} onChange={editField} maxLength={2000} hint="State what is included, what varies, and how variable charges are calculated." required error={errors} />
    <fieldset><legend className="section-title">Additional fixed fees</legend>{fees.map((fee, index) => <div className="fee-row" key={fee.key}>
      <Field label={`Fee ${index + 1} name`} name={'fee-name-' + fee.key} value={fee.name} onChange={event => changeFee(fee.key, 'name', event.target.value)} required maxLength={100} />
      <Field label={`Fee ${index + 1} amount (PHP)`} name={'fee-amount-' + fee.key} type="number" min="0" max="1000000" step="0.01" value={fee.amount} onChange={event => changeFee(fee.key, 'amount', event.target.value)} required />
      <label className="form-label" htmlFor={'fee-frequency-' + fee.key}>Fee {index + 1} frequency</label><select className="form-select mb-2" id={'fee-frequency-' + fee.key} value={fee.frequency} onChange={event => changeFee(fee.key, 'frequency', event.target.value)}><option value="monthly">Monthly</option><option value="one_time">One time</option></select>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { markDirty(); setFees(current => current.filter(item => item.key !== fee.key)) }}>Remove fee {index + 1}</button>
    </div>)}{fees.length < 10 && <button className="btn btn-sm btn-outline-secondary mb-3" type="button" onClick={() => { markDirty(); setFees(current => [...current, { key: crypto.randomUUID(), name: '', amount: '', frequency: 'monthly' }]) }}>Add fixed fee</button>}</fieldset>
    <div className="d-flex gap-2 flex-wrap"><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : option ? 'Save room option' : 'Add room option'}</button>{(option || dirty || property.status === 'approved') && <button type="button" className="btn btn-outline-secondary" onClick={() => { if (!dirty || window.confirm('Discard your unsaved room edits?')) { clearUnsaved(); onCancel() } }}>{option ? 'Cancel edit' : 'Clear room form'}</button>}</div>
  </fieldset></form>
}

export function SubmissionPanel({ property, onEditStep, workspaceHref = '/landlord' }) {
  const requireSaved = useRequireSavedChanges()
  const client = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const [confirmationError, setConfirmationError] = useState('')
  const confirmation = useRef(null)
  const mutation = useMutation({ mutationKey: ['property-write', property.id], mutationFn: () => writeApi('post', `/landlord/properties/${property.id}/submit`, { revision: property.revision, inventory_confirmed: confirmed }), onSuccess: async data => { client.setQueryData(['property', String(property.id)], data); await Promise.all(['properties', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key] }))) } })
  const missing = listingReadiness(property).filter(item => !item.ready)
  const submitting = ['draft', 'rejected'].includes(property.status)
  return <section className="panel review-preparation" data-tour="review-readiness" aria-label="Prepare for listing review"><h2>{submitting ? missing.length ? 'Before you submit' : 'Ready for review' : property.status === 'pending_review' ? 'In review' : 'Listing review'}</h2>
    {property.moderation_reason && ['rejected', 'suspended'].includes(property.status) && <p className="alert alert-warning">Review feedback: {property.moderation_reason}</p>}
    {submitting && (missing.length ? <><p className="review-missing-summary">Finish these {missing.length} required items to enable review. Choose an item to go to its section.</p><ul className="completion-list">{missing.map(item => <li key={item.label}>{onEditStep ? <button type="button" onClick={() => onEditStep(item.step)}>{item.label} →</button> : item.label}</li>)}</ul></> : <p className="small text-secondary">Your saved photos, room options and property details are ready to send for review.</p>)}
    <ErrorNotice error={mutation.error} />
    {submitting ? <>{!missing.length && <label className="review-confirmation mb-3"><input ref={confirmation} type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setConfirmationError('') }} /><span>These options describe separate inventory and do not double-count the same beds or rooms.</span></label>}{confirmationError && <p className="alert alert-warning" role="alert">{confirmationError}</p>}<button className="btn btn-primary" aria-describedby={"owner-review-scope-" + property.id} disabled={mutation.isPending} onClick={() => { if (missing.length) { onEditStep?.(missing[0].step); return } if (!confirmed) { setConfirmationError('Confirm that the room options describe separate inventory before submitting.'); confirmation.current?.focus(); return } if (requireSaved()) mutation.mutate() }}>{mutation.isPending ? 'Submitting…' : missing.length ? 'Finish required details' : 'Submit for review'}</button><p id={"owner-review-scope-" + property.id} className="owner-fine-print review-boundary-note">Review covers the listing information and charges. Ownership and property safety require separate verification.</p></> : <p className="small text-secondary">{property.status === 'pending_review' ? 'Your listing has been submitted. We will notify you when the administrator records a decision. Edits are locked during review.' : property.status === 'approved' ? 'This listing has administrator approval. Keep its vacancies current using Update availability. Changes to listing details or charges require another review.' : 'This listing is currently locked.'}</p>}
    {property.status === 'pending_review' && <Link className="btn btn-outline-primary" to={workspaceHref}>Return to your properties</Link>}
  </section>
}
