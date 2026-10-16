import { useId } from 'react'
import { pesos } from '../lib/money'

export default function RoomChoice({ options, selectedId, onChange }) {
  const name = useId()
  return <fieldset className="room-choices">
    <legend>Choose a room option</legend>
    {options.map(option => <label className={'room-choice' + (option.id === selectedId ? ' is-chosen' : '')} key={option.id}>
      <input type="radio" name={name} value={option.id} checked={option.id === selectedId} onChange={() => onChange(option.id)} />
      <span className="room-choice-content">
        <strong>{option.name}</strong>
        <span className="room-choice-price">{pesos(option.monthly_rent_centavos)} <small>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</small></span>
        <span className="room-choice-meta">{option.capacity}-person room · <span className={option.available_units === 0 || option.availability_stale ? 'room-caution' : ''}>{option.available_units === 0 ? 'Sold out' : `${option.available_units} ${option.inventory_type === 'bedspace' ? (option.available_units === 1 ? 'bed' : 'beds') : (option.available_units === 1 ? 'room' : 'rooms')} available`}{option.availability_stale ? ' · Needs confirmation' : ''}</span></span>
      </span>
      <span className="room-choice-check" aria-hidden="true">{option.id === selectedId ? '✓' : ''}</span>
    </label>)}
  </fieldset>
}
