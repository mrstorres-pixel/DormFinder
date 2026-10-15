import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { preferredOption, browseLink } from '../lib/housing'
import { ErrorNotice, Loading } from './Feedback'

const demoCovers = {
  '[DEMO] Near Campus Twin Dorm': { url: '/images/demo/twin-room.webp', caption: 'AI-generated illustration of a fictional twin student dorm' },
  '[DEMO] Premium Study Loft': { url: '/images/demo/studio-room.webp', caption: 'AI-generated illustration of a fictional student study studio' },
  '[DEMO] Mixed Availability Dorm': { url: '/images/demo/shared-room.webp', caption: 'AI-generated illustration of a fictional shared student dorm' },
}

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
  return <section className="container featured-homes" aria-labelledby="featured-heading"><div className="section-heading"><div><h2 id="featured-heading">{campusId ? 'Near your saved campus' : 'Find a place to call yours.'}</h2></div><Link to={campusId ? browseLink(campusId) : '/listings?available_only=1'}>Browse all →</Link></div>
    {query.isPending ? <Loading>Finding available rooms…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rooms.length ? <div className="featured-grid">{rooms.map(({ property, option }) => {
      const illustration = property.is_demo && demoCovers[property.title]
      const photo = illustration || property.photos?.[0]
      return <article className="featured-home" key={property.id}><Link to={'/listings/' + property.id + '?option=' + option.id + (campusId ? '&campus_id=' + campusId : '')} state={{ browse: campusId ? browseLink(campusId) : '/listings?available_only=1' }}><div className="featured-cover"><Cover key={photo?.url || 'no-photo'} photo={photo} />{property.is_demo && <span className="status-badge" title={illustration ? 'AI-generated interior concept for a fictional demo listing; not a photo of the property.' : undefined}>{illustration ? 'AI demo illustration' : 'Synthetic demo'}</span>}</div><div className="featured-copy"><h3>{property.title}</h3></div></Link></article>
    })}</div> : <div className="featured-empty"><p>{campusId ? 'No recently confirmed rooms within 2 km of your saved campus yet.' : 'No recently confirmed vacancies to show yet.'}</p><Link to={campusId ? browseLink(campusId) : '/listings'}>Explore listings and their confirmation dates →</Link></div>}
  </section>
}
