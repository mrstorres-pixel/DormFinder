import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { ErrorNotice, Field } from './Feedback'

export default function VacancyForm({ property, option, onSaved, confirmSave = () => true }) {
  const [count, setCount] = useState(option.available_units)
  const mutation = useMutation({ mutationFn: () => writeApi('patch', '/landlord/properties/' + property.id + '/availability', { revision:property.revision, options:[{ id:option.id, available_units:Number(count) }] }), onSuccess:onSaved })
  return <form className="vacancy-form mt-3" onSubmit={event => { event.preventDefault(); if (confirmSave()) mutation.mutate() }}><h3>Refresh availability</h3><p className="small">Keep this listing public while confirming vacancies. Prices and room details still need review when edited.</p><ErrorNotice error={mutation.error} /><Field name={'vacancy-' + option.id} label={'Available units for ' + option.name} type="number" required min="0" max={option.total_units} value={count} onChange={event => setCount(event.target.value)} /><button className="btn btn-outline-primary btn-sm" disabled={mutation.isPending}>{mutation.isPending ? 'Confirming…' : 'Confirm vacancies today'}</button></form>
}
