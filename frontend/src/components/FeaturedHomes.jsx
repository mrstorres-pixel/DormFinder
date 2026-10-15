import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { preferredOption, browseLink } from '../lib/housing'
import { ErrorNotice, Loading } from './Feedback'
import HomeListingCard from './HomeListingCard'

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
    {query.isPending ? <Loading>Finding available rooms…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rooms.length ? <div className="featured-grid">{rooms.map(({ property, option }) => <HomeListingCard key={property.id} property={property} option={option} campusId={campusId} browse={campusId ? browseLink(campusId) : '/listings?available_only=1'} />)}</div> : <div className="featured-empty"><p>{campusId ? 'No recently confirmed rooms within 2 km of your saved campus yet.' : 'No recently confirmed vacancies to show yet.'}</p><Link to={campusId ? browseLink(campusId) : '/listings'}>Explore listings and their confirmation dates →</Link></div>}
  </section>
}
