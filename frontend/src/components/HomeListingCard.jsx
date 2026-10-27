import { useState } from 'react'
import { Link } from 'react-router-dom'
import { pesos } from '../lib/money'
import AvailabilityStatus from './AvailabilityStatus'
import { listingTitle } from '../lib/listingPresentation'

const demoCovers = {
  'Near Campus Twin Dorm': { url: '/images/demo/twin-room.webp', caption: 'Twin student room interior' },
  'Premium Study Loft': { url: '/images/demo/studio-room.webp', caption: 'Student studio interior' },
  'Mixed Availability Dorm': { url: '/images/demo/shared-room.webp', caption: 'Shared student room interior' },
}

function Cover({ photo }) {
  const [failed, setFailed] = useState(false)
  return photo && !failed ? <img src={photo.url} alt={photo.caption || ''} loading="lazy" onError={() => setFailed(true)} /> : <span className="featured-placeholder">{failed ? 'Photo unavailable' : 'Photos not provided'}</span>
}

export function ListingCover({ property }) {
  const illustration = property.is_demo && demoCovers[listingTitle(property.title)]
  const photo = illustration || property.photos?.[0]
  return <div className="featured-cover"><Cover key={photo?.url || 'no-photo'} photo={photo} /></div>
}

export default function HomeListingCard({ property, option, campusId, browse = '/listings', saved = false }) {
  const to = '/listings/' + property.id + (option ? '?option=' + option.id : '') + (campusId ? (option ? '&' : '?') + 'campus_id=' + campusId : '')
  return <article className="featured-home"><Link to={to} state={{ browse }}>
    <ListingCover property={property} />
    <div className="featured-copy"><h3>{property.title}</h3>{option && <div className="featured-facts"><span><strong>{pesos(option.monthly_rent_centavos).replace(/\.00$/, '')}</strong> / {option.price_basis === 'per_person' ? 'person' : 'room'} / month</span>{Number.isFinite(option.capacity) && <span>{option.capacity}-person room</span>}</div>}{option && <AvailabilityStatus option={option} />}{saved && (!option || option.available_units === 0 || option.availability_stale) && <p className="saved-room-caution">{!option ? 'Check room details' : option.available_units === 0 ? 'No vacancies in this room option' : 'Availability needs confirmation'}</p>}</div>
  </Link></article>
}
