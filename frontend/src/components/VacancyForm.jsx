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
  return <form className="vacancy-form mt-3" onSubmit={event => { event.preventDefault(); if (canReplaceOthers() && confirmSave()) mutation.mutate() }}><h3>Refresh availability</h3><p className="small">Confirm the actual vacancies, even if the number is unchanged. Set available units to 0 when this option is taken. Expired rooms will appear again after confirmation; editing prices or room details still needs review.</p><AvailabilityStatus option={option} /><ErrorNotice error={mutation.error} />{mutation.isSuccess && <p role="status">{option.available_units === 0 ? 'Marked sold out. Availability confirmed today.' : 'Availability confirmed today.'}</p>}<Field name={'vacancy-' + option.id} label={'Available units for ' + option.name} hint={'Count only ' + (option.inventory_type === 'bedspace' ? 'beds' : 'rooms') + ' ready to rent now. Use 0 when all are taken.'} type="number" required min="0" max={option.total_units} value={count} disabled={mutation.isPending} onChange={event => { setCount(event.target.value); setDirty(event.target.value !== String(option.available_units)) }} /><button className="btn btn-outline-primary btn-sm" disabled={mutation.isPending}>{mutation.isPending ? 'Confirming…' : 'Confirm vacancies today'}</button></form>
}
