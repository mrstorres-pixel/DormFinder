import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi, fieldErrors } from '../lib/api'
import { pesos, toCentavos } from '../lib/money'
import { ErrorNotice, Field } from './Feedback'

export function RoomCharges({ option }) {
  return <div className="room-charges">
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
    <p className={'small ' + (option.availability_stale ? 'text-danger' : 'text-secondary')}>Availability confirmed {new Date(option.availability_confirmed_at).toLocaleDateString('en-PH')}{option.availability_stale ? ' · More than 14 days old. Ask the owner to confirm.' : ''}</p>
    <p className="small text-secondary">Totals cover the stated pricing basis. Variable utilities and rent not covered by the advance are additional. This is an inquiry service; no booking or payment is made here.</p>
  </div>
}

export function RoomManager({ property }) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [formVersion, setFormVersion] = useState(0)
  const editable = ['draft', 'rejected', 'approved'].includes(property.status)
  async function saved(data) {
    client.setQueryData(['property', String(property.id)], data)
    await client.invalidateQueries({ queryKey: ['properties'] })
    await client.invalidateQueries({ queryKey: ['listings'] })
    setEditing(null)
    setFormVersion(version => version + 1)
  }
  const remove = useMutation({ mutationFn: id => writeApi('delete', `/landlord/properties/${property.id}/room-options/${id}`, { revision: property.revision }), onSuccess: saved })
  return <section className="panel mt-4"><h2 className="section-title">Room options and charges</h2>
    <p className="text-secondary small">Describe separate groups of equivalent beds or whole rooms. Do not count the same inventory twice. Saving an option confirms today’s availability and returns a published listing to draft.</p>
    <ErrorNotice error={remove.error} />
    {(property.room_options || []).map(option => <article className="room-option mb-4" key={option.id}><h3>{option.name}</h3><RoomCharges option={option} />{editable && <div className="d-flex gap-2"><button className="btn btn-sm btn-outline-primary" onClick={() => setEditing(option)}>Edit {option.name}</button><button className="btn btn-sm btn-outline-danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${option.name}? Existing inquiries will be kept.`)) remove.mutate(option.id) }}>Remove option</button></div>}</article>)}
    {editable ? <RoomOptionForm key={editing?.id || 'new-' + formVersion} property={property} option={editing} onSaved={saved} onCancel={() => setEditing(null)} /> : <p className="alert alert-info">Room edits are locked while this listing is {property.status.replaceAll('_', ' ')}.</p>}
  </section>
}

function RoomOptionForm({ property, option, onSaved, onCancel }) {
  const [inventory, setInventory] = useState(option?.inventory_type || 'bedspace')
  const [fees, setFees] = useState(() => (option?.fees || []).map(fee => ({ ...fee, key: crypto.randomUUID(), amount: String(fee.amount_centavos / 100) })))
  const mutation = useMutation({
    mutationFn: values => writeApi(option ? 'patch' : 'post', `/landlord/properties/${property.id}/room-options${option ? '/' + option.id : ''}`, values),
    onSuccess: onSaved,
  })
  const [amountError, setAmountError] = useState(null)
  const errors = fieldErrors(mutation.error)
  function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      setAmountError(null)
      mutation.mutate({ name: data.name, inventory_type: inventory, price_basis: inventory === 'bedspace' ? 'per_person' : 'per_room', capacity: Number(data.capacity), total_units: Number(data.total_units), available_units: Number(data.available_units), monthly_rent_centavos: toCentavos(data.rent), deposit_centavos: toCentavos(data.deposit), advance_months: Number(data.advance_months), utilities_notes: data.utilities_notes, revision: property.revision, fees: fees.map(fee => ({ name: fee.name, frequency: fee.frequency, amount_centavos: toCentavos(fee.amount) })) })
    } catch (error) { setAmountError(error) }
  }
  function changeFee(key, field, value) { setFees(current => current.map(fee => fee.key === key ? { ...fee, [field]: value } : fee)) }
  return <form onSubmit={submit} className="room-form"><h3>{option ? 'Edit room option' : 'Add a room option'}</h3>
    <ErrorNotice error={mutation.error} />{amountError && <p role="alert" className="alert alert-danger">{amountError.message}</p>}
    <Field label="Room option name" name="name" defaultValue={option?.name} maxLength={100} required error={errors} />
    <label className="form-label" htmlFor="inventory_type">Inventory and price basis</label><select className="form-select mb-3" id="inventory_type" value={inventory} onChange={event => setInventory(event.target.value)}><option value="bedspace">Bedspace · price per person</option><option value="whole_room">Whole room · price per room</option></select>
    <div className="row"><div className="col-sm-4"><Field label="Room capacity" name="capacity" type="number" min="1" max="20" defaultValue={option?.capacity || 1} required error={errors} /></div><div className="col-sm-4"><Field label="Total units" name="total_units" type="number" min="1" max="1000" defaultValue={option?.total_units || 1} required error={errors} /></div><div className="col-sm-4"><Field label="Available units" name="available_units" type="number" min="0" max="1000" defaultValue={option?.available_units ?? 1} required error={errors} /></div></div>
    <div className="row"><div className="col-sm-6"><Field label="Monthly rent (PHP)" name="rent" type="number" min="0.01" max="1000000" step="0.01" defaultValue={option ? option.monthly_rent_centavos / 100 : ''} required error={{ rent: errors.monthly_rent_centavos }} /></div><div className="col-sm-6"><Field label="Deposit (PHP)" name="deposit" type="number" min="0" max="1000000" step="0.01" defaultValue={option ? option.deposit_centavos / 100 : 0} required error={{ deposit: errors.deposit_centavos }} /></div></div>
    <Field label="Advance rent in months" name="advance_months" type="number" min="0" max="12" defaultValue={option?.advance_months || 0} required error={errors} />
    <Field label="Utilities and other charge terms" name="utilities_notes" as="textarea" rows={3} defaultValue={option?.utilities_notes} maxLength={2000} hint="State what is included, what varies, and how variable charges are calculated." required error={errors} />
    <fieldset><legend className="section-title">Additional fixed fees</legend>{fees.map((fee, index) => <div className="fee-row" key={fee.key}>
      <Field label={`Fee ${index + 1} name`} name={'fee-name-' + fee.key} value={fee.name} onChange={event => changeFee(fee.key, 'name', event.target.value)} required maxLength={100} />
      <Field label={`Fee ${index + 1} amount (PHP)`} name={'fee-amount-' + fee.key} type="number" min="0" max="1000000" step="0.01" value={fee.amount} onChange={event => changeFee(fee.key, 'amount', event.target.value)} required />
      <label className="form-label" htmlFor={'fee-frequency-' + fee.key}>Fee {index + 1} frequency</label><select className="form-select mb-2" id={'fee-frequency-' + fee.key} value={fee.frequency} onChange={event => changeFee(fee.key, 'frequency', event.target.value)}><option value="monthly">Monthly</option><option value="one_time">One time</option></select>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setFees(current => current.filter(item => item.key !== fee.key))}>Remove fee {index + 1}</button>
    </div>)}{fees.length < 10 && <button className="btn btn-sm btn-outline-secondary mb-3" type="button" onClick={() => setFees(current => [...current, { key: crypto.randomUUID(), name: '', amount: '', frequency: 'monthly' }])}>Add fixed fee</button>}</fieldset>
    <div className="d-flex gap-2"><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : option ? 'Save room option' : 'Add room option'}</button>{option && <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel edit</button>}</div>
  </form>
}

export function SubmissionPanel({ property }) {
  const client = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const mutation = useMutation({ mutationFn: () => writeApi('post', `/landlord/properties/${property.id}/submit`, { revision: property.revision, inventory_confirmed: confirmed }), onSuccess: async data => { client.setQueryData(['property', String(property.id)], data); await client.invalidateQueries({ queryKey: ['properties'] }) } })
  return <section className="panel mt-4"><h2 className="section-title">Listing review</h2><p>Status: <strong>{property.status.replaceAll('_', ' ')}</strong></p>
    {property.moderation_reason && <p className="alert alert-warning">Review feedback: {property.moderation_reason}</p>}
    <ErrorNotice error={mutation.error} />
    {['draft', 'rejected'].includes(property.status) ? <><p className="small">Add a description, street address, both coordinates, at least one photo, and room options with current availability. Review checks content and charges; it does not certify safety or ownership.</p><label className="d-flex gap-2 mb-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>These options describe separate inventory and do not double-count the same beds or rooms.</span></label><button className="btn btn-primary" disabled={!confirmed || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Submitting…' : 'Submit for review'}</button></> : <p className="small text-secondary">{property.status === 'pending_review' ? 'Your listing is waiting for administrator review. Edits are locked during review.' : property.status === 'approved' ? 'Your listing is public. Material edits return it to draft and require another review.' : 'This listing is currently locked.'}</p>}
  </section>
}
