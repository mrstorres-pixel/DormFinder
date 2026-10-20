import { Link } from 'react-router-dom'
import { useComparison } from '../lib/comparison'
import { preferredOption } from '../lib/housing'
import { pesos } from '../lib/money'
import { ListingCover } from './HomeListingCard'
import { savedDetails } from '../lib/savedPlaces'
import './saved-places.css'
import AvailabilityStatus from './AvailabilityStatus'
import SavePlaceButton from './SavePlaceButton'

export default function SavedPlaceCard({ row, collection, onEdit, compact = false }) {
  const compare = useComparison() || { selections: [] }
  const details = savedDetails(row, collection)
  const listing = row.listing
  const title = listing?.title || details.listing_snapshot?.title || row.listing_snapshot.title
  const option = listing?.room_options.find(room => room.id === details.room_option_id)
  const starting = !details.room_option_id && listing ? preferredOption(listing.room_options) : null
  const display = option || starting
  const selected = !!option && compare.selections.some(item => item.property_id === row.property_id && item.room_option_id === option.id)
  const hasProperty = compare.selections.some(item => item.property_id === row.property_id)
  const destination = '/listings/' + row.property_id + (option ? '?option=' + option.id : '')
  const cover = listing ? <ListingCover property={listing} /> : <div className="saved-cover-unavailable">Listing unavailable</div>
  const notes = details.note ? [{ note: details.note, label: details.collection_name }] : !collection ? (row.contexts || []).filter(item => item.note).map(item => ({ note: item.note, label: item.collection_name })) : []
  return <article className="saved-place-card" aria-label={'Saved place ' + title}>
    <div className="saved-card-heart"><SavePlaceButton propertyId={row.property_id} title={title} optionId={option?.id} compact iconOnly /></div>
    {listing ? <Link className="saved-cover-link" to={destination} state={{ browse: '/saved' }}>{cover}</Link> : cover}
    <div className="saved-place-copy"><h2>{listing ? <Link to={destination} state={{ browse: '/saved' }}>{title}</Link> : title}</h2>
      {display && <p className="saved-price">{starting ? 'From ' : ''}<strong>{pesos(display.monthly_rent_centavos).replace(/\.00$/, '')}</strong><span> / {display.price_basis === 'per_person' ? 'person' : 'room'} / month</span>{option && <small>{option.capacity}-person room</small>}</p>}
      {display && <AvailabilityStatus option={display} />}{option && <p className="saved-room-name">{option.name}</p>}{!option && details.room_option_id && <p className="saved-caution">Saved room unavailable{details.listing_snapshot?.room_name ? ': ' + details.listing_snapshot.room_name : ''}</p>}{option && (option.available_units === 0 || option.availability_stale) && <p className="saved-caution">{option.available_units === 0 ? 'No vacancies in this room option' : 'Availability needs confirmation'}</p>}
      {!compact && <>{row.contexts?.length > 0 && <div className="saved-collection-tags">{row.contexts.map(item => <span key={item.collection_id} title={item.listing_snapshot?.room_name || ''}>{item.collection_name}</span>)}</div>}{notes.length > 0 && <p className="saved-note-preview">{notes[0].label && <strong>{notes[0].label}: </strong>}{notes[0].note}{notes.length > 1 && <span> · Notes in {notes.length} collections</span>}</p>}
      <div className="saved-card-actions"><button type="button" onClick={event => onEdit(row.property_id, event.currentTarget)}>{!option && listing ? 'Choose room & organize' : 'Notes & collections'}</button>{option && <button type="button" aria-pressed={selected} disabled={!hasProperty && compare.selections.length >= 3} onClick={() => compare.choose(row.property_id, option.id, !selected)}>{selected ? '✓ Comparing' : 'Compare room'}</button>}</div></>}
    </div>
  </article>
}
