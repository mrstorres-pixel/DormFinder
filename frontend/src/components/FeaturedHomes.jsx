import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { preferredOption, browseLink } from '../lib/housing'
import { pesos } from '../lib/money'
import { ErrorNotice, Loading } from './Feedback'

function Cover({ photo }) {
  const [failed, setFailed] = useState(false)
  return photo && !failed ? <img src={photo.url} alt={photo.caption} loading="lazy" onError={() => setFailed(true)} /> : <span className="featured-placeholder">{failed ? 'Photo unavailable' : 'Photos not provided'}</span>
}

export default function FeaturedHomes() {
  const { data: user } = useCurrentUser()
  const campusId = user?.preferred_campus_id
  const params = campusId ? { campus_id: campusId, radius_km: 2, sort: 'recommended', available_only: 1 } : { sort: 'newest', available_only: 1 }
  const query = useQuery({ queryKey: ['featured-homes', params], queryFn: async () => (await api.get('/listings', { params })).data.data, retry: false, refetchInterval: 240_000 })
  const rooms = (query.data || []).flatMap(property => {
    const option = preferredOption(property.room_options.filter(room => room.available_units > 0 && room.availability_stale === false))
    return option ? [{ property, option }] : []
  }).slice(0, 3)
  return <section className="container featured-homes" aria-labelledby="featured-heading"><div className="section-heading"><div><span className="eyebrow">A FEW PLACES TO START</span><h2 id="featured-heading">{campusId ? 'Near your saved campus' : 'Explore recently confirmed rooms'}</h2></div><Link to={campusId ? browseLink(campusId) : '/listings?available_only=1'}>Browse all →</Link></div>
    {query.isPending ? <Loading>Finding available rooms…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rooms.length ? <div className="featured-grid">{rooms.map(({ property, option }) => {
      return <article className="featured-home" key={property.id}><Link to={'/listings/' + property.id + '?option=' + option.id + (campusId ? '&campus_id=' + campusId : '')} state={{ browse: campusId ? browseLink(campusId) : '/listings?available_only=1' }}><div className="featured-cover"><Cover key={property.photos?.[0]?.url || 'no-photo'} photo={property.photos?.[0]} />{property.is_demo && <span className="status-badge">Synthetic demo</span>}</div><div className="featured-copy"><p className="featured-location">{property.city} · {option.name}</p><h3>{property.title}</h3><p className="featured-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><p className="featured-cost">{pesos(option.monthly_fixed_total_centavos)} known monthly · {option.available_units} available</p></div></Link></article>
    })}</div> : <div className="featured-empty"><p>{campusId ? 'No recently confirmed rooms within 2 km of your saved campus yet.' : 'No recently confirmed vacancies to show yet.'}</p><Link to={campusId ? browseLink(campusId) : '/listings'}>Explore listings and their confirmation dates →</Link></div>}
    <p className="featured-footnote">Prices use the stated room or per-person basis. Confirm availability and additional charges with the owner.</p>
  </section>
}
