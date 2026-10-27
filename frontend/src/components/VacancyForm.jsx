import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { ErrorNotice, Field } from './Feedback'
import AvailabilityStatus from './AvailabilityStatus'
import { ownerRoomFingerprint } from '../lib/ownerWorkspace'

export default function VacancyForm({ property, option, onSaved, confirmSave = () => true }) {
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const [editedCount, setCount] = useState(option.available_units)
  const baseline = useRef(null)
  const confirmButton = useRef(null)
  const count = dirty ? editedCount : option.available_units
  function editCount(value) { if (!dirty) baseline.current = { revision: property.revision, fingerprint: ownerRoomFingerprint(option) }; setCount(value); setDirty(String(value) !== String(option.available_units)); mutation.reset() }
  const mutation = useMutation({ mutationKey: ['property-write', property.id], mutationFn: () => writeApi('patch', '/landlord/properties/' + property.id + '/availability', { revision:dirty && baseline.current?.fingerprint !== ownerRoomFingerprint(option) ? baseline.current.revision : property.revision, options:[{ id:option.id, available_units:Number(count) }] }), onSuccess: data => { clearUnsaved(); setDirty(false); baseline.current = null; onSaved(data) } })
  return <form className="vacancy-form mt-3" onSubmit={event => { event.preventDefault(); if (canReplaceOthers() && confirmSave()) mutation.mutate() }}><h3>Refresh availability</h3><p className="small">Confirm the count even when unchanged. Vacancy updates keep this listing approved.</p><AvailabilityStatus option={option} /><ErrorNotice error={mutation.error} />{mutation.isSuccess && <p role="status">{option.available_units === 0 ? 'Marked sold out. Availability confirmed today.' : 'Availability confirmed today.'}</p>}<Field name={'vacancy-' + option.id} label={'Available units for ' + option.name} hint={'Count only ' + (option.inventory_type === 'bedspace' ? 'beds' : 'rooms') + ' ready to rent now. Use 0 when all are taken.'} type="number" required min="0" max={option.total_units} value={count} disabled={mutation.isPending} onChange={event => editCount(event.target.value)} /><div className="owner-vacancy-actions"><button ref={confirmButton} className="btn btn-primary btn-sm" disabled={mutation.isPending}>{mutation.isPending ? 'Confirming…' : 'Confirm vacancies today'}</button>{Number(count) > 0 && <button type="button" className="btn btn-outline-secondary btn-sm" disabled={mutation.isPending} onClick={() => { editCount(0); confirmButton.current?.focus() }}>Set all as taken</button>}{dirty && <button type="button" className="btn btn-link btn-sm" disabled={mutation.isPending} onClick={() => { clearUnsaved(); setDirty(false); setCount(option.available_units); baseline.current = null; mutation.reset() }}>Cancel vacancy changes</button>}</div>{dirty && <p className="owner-save-feedback" aria-live="polite">{Number(count) === 0 ? 'All taken is not saved yet. Choose Confirm vacancies today to save zero vacancies.' : 'Vacancy changes are not saved yet. Confirm the current count to save.'}</p>}</form>
}
