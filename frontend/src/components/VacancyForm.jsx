import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useFormChanges } from '../lib/useUnsavedChanges'
import { ErrorNotice, Field } from './Feedback'
import AvailabilityStatus from './AvailabilityStatus'

export default function VacancyForm({ property, option, onSaved, confirmSave = () => true }) {
  const [dirty, setDirty] = useState(false)
  const { clear: clearUnsaved, canReplaceOthers } = useFormChanges(dirty)
  const [editedCount, setCount] = useState(option.available_units)
  const count = dirty ? editedCount : option.available_units
  const mutation = useMutation({ mutationKey: ['property-write', property.id], mutationFn: () => writeApi('patch', '/landlord/properties/' + property.id + '/availability', { revision:property.revision, options:[{ id:option.id, available_units:Number(count) }] }), onSuccess: data => { clearUnsaved(); setDirty(false); onSaved(data) } })
  return <form className="vacancy-form mt-3" onSubmit={event => { event.preventDefault(); if (canReplaceOthers() && confirmSave()) mutation.mutate() }}><h3>Refresh availability</h3><p className="small">Confirm the actual vacancies, even if the number is unchanged. Expired rooms will appear again. Prices and room details still need review when edited.</p><AvailabilityStatus option={option} /><ErrorNotice error={mutation.error} />{mutation.isSuccess && <p role="status">Availability confirmed today.</p>}<Field name={'vacancy-' + option.id} label={'Available units for ' + option.name} type="number" required min="0" max={option.total_units} value={count} disabled={mutation.isPending} onChange={event => { setCount(event.target.value); setDirty(event.target.value !== String(option.available_units)) }} /><button className="btn btn-outline-primary btn-sm" disabled={mutation.isPending}>{mutation.isPending ? 'Confirming…' : 'Confirm vacancies today'}</button></form>
}
