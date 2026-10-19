import { useState } from 'react'
import { Link } from 'react-router-dom'
import { pesos } from '../lib/money'

const demoCovers = {
  '[DEMO] Near Campus Twin Dorm': { url: '/images/demo/twin-room.webp', caption: 'AI-generated illustration of a fictional twin student dorm' },
  '[DEMO] Premium Study Loft': { url: '/images/demo/studio-room.webp', caption: 'AI-generated illustration of a fictional student study studio' },
  '[DEMO] Mixed Availability Dorm': { url: '/images/demo/shared-room.webp', caption: 'AI-generated illustration of a fictional shared student dorm' },
}

function Cover({ photo }) {
  const [failed, setFailed] = useState(false)
  return photo && !failed ? <img src={photo.url} alt={photo.caption || ''} loading="lazy" onError={() => setFailed(true)} /> : <span className="featured-placeholder">{failed ? 'Photo unavailable' : 'Photos not provided'}</span>
}

export function ListingCover({ property }) {
  const illustration = property.is_demo && demoCovers[property.title]
  const photo = illustration || property.photos?.[0]
  const generated = illustration || (property.is_demo && photo?.caption?.startsWith('AI-generated demo interior'))
  return <div className="featured-cover"><Cover key={photo?.url || 'no-photo'} photo={photo} />{property.is_demo && <span className="status-badge" title={generated ? 'AI-generated interior concept for a fictional demo listing; not a photo of the property.' : undefined}>{generated ? 'AI demo illustration' : 'Synthetic demo'}</span>}</div>
}

export default function HomeListingCard({ property, option, campusId, browse = '/listings', saved = false }) {
  const to = '/listings/' + property.id + (option ? '?option=' + option.id : '') + (campusId ? (option ? '&' : '?') + 'campus_id=' + campusId : '')
  return <article className="featured-home"><Link to={to} state={{ browse }}>
    <ListingCover property={property} />
    <div className="featured-copy"><h3>{property.title}</h3>{option && <div className="featured-facts"><span><strong>{pesos(option.monthly_rent_centavos).replace(/\.00$/, '')}</strong> / {option.price_basis === 'per_person' ? 'person' : 'room'} / month</span>{Number.isFinite(option.capacity) && <span>{option.capacity}-person room</span>}</div>}{saved && (!option || option.available_units === 0 || option.availability_stale) && <p className="saved-room-caution">{!option ? 'Check room details' : option.available_units === 0 ? 'No vacancies in this room option' : 'Availability needs confirmation'}</p>}</div>
  </Link></article>
}
