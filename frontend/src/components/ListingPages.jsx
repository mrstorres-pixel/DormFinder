import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { pesos } from '../lib/money'
import { useCampuses, distanceLabel } from '../lib/discovery'
import { useComparison } from '../lib/comparison'
import { ErrorNotice, Loading } from './Feedback'
import { RoomCharges } from './RoomOptions'
import { ComparisonTray, SearchFilters, ListingCard, PhotoGallery, ListingMap } from './Discovery'
import { ReportForm } from './ModerationPages'
import CampusMap from './CampusMap'
import ListingInformation from './ListingInformation'
import { preferredOption, searchParameters } from '../lib/housing'
import ListingActions from './ListingActions'
import AvailabilityStatus from './AvailabilityStatus'
import { browseKey, readBrowseState, saveBrowseState } from '../lib/browseState'
import { ListingSort } from './SearchFilters'
import CampusResultsSearch from './CampusResultsSearch'
import FavoriteButton from './SavePlaceButton'
import RoomChoice from './RoomChoice'
import MapListingPreview from './MapListingPreview'

export function Listings({ favorites = false }) {
  const [params] = useSearchParams()
  const searchKey = browseKey(params)
  return <ListingResults key={(favorites ? 'favorites:' : 'browse:') + searchKey} favorites={favorites} searchKey={searchKey} />
}

function ListingResults({ favorites, searchKey }) {
  const compare = useComparison()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const campuses = useCampuses()
  const [browse, setBrowse] = useState(() => (!favorites && readBrowseState(searchKey)) || { showMap: window.innerWidth >= 992, selectedId: null, choices: {}, viewport: null })
  const { showMap, selectedId, choices, viewport } = browse
  useEffect(() => { if (!favorites) saveBrowseState(searchKey, browse) }, [favorites, searchKey, browse])
  function setShowMap(value) { setBrowse(current => ({ ...current, showMap: typeof value === 'function' ? value(current.showMap) : value })) }
  function setSelectedId(value) { setBrowse(current => ({ ...current, selectedId: value })) }
  function setChoices(update) { setBrowse(current => ({ ...current, choices: update(current.choices) })) }
  function rememberViewport(value) {
    setBrowse(current => ({ ...current, viewport: value }))
    saveBrowseState(searchKey, { ...browse, viewport: value })
  }
  const query = useQuery({ queryKey: [favorites ? 'favorites' : 'listings', params.toString()], queryFn: async () => (await api.get(favorites ? '/favorites' : '/listings', { params: favorites ? { page } : searchParameters(params) })).data, retry: false, refetchInterval: 240_000 })
  const mapParams = searchParameters(params); delete mapParams.page
  const mapQuery = useQuery({ queryKey: ['listings-map', mapParams], enabled: !favorites && !!campuses.data && showMap, queryFn: async () => (await api.get('/listings-map', { params: mapParams })).data, retry: false, refetchInterval: 240_000 })
  const rows = query.data?.data || []
  const campus = campuses.data?.find(item => String(item.id) === params.get('campus_id'))
  const markers = (mapQuery.data?.data || []).map(p => ({ ...p, selected_room_option_id: choices[p.id] }))
  const preview = markers.find(p => p.id === selectedId)
  const previewOption = preview?.room_options.find(o => o.id === choices[preview.id]) || preferredOption(preview?.room_options)
  const bounds = params.has('south') ? [[Number(params.get('south')), Number(params.get('west'))], [Number(params.get('north')), Number(params.get('east'))]] : undefined
  function turnPage(next) { setParams(current => { const result = new URLSearchParams(current); result.set('page', String(next)); return result }) }
  function changeSearch(values) {
    const next = new URLSearchParams(values)
    const sameCampus = next.get('campus_id') === params.get('campus_id')
    const sameRadius = next.get('radius_km') === params.get('radius_km')
    saveBrowseState(browseKey(next), { ...browse, selectedId: sameCampus ? selectedId : null, viewport: sameCampus && sameRadius ? viewport : null })
    setParams(next, { flushSync: true })
  }
  function searchArea(area) {
    setParams(current => { const next = new URLSearchParams(current); next.delete('page'); for (const [key,value] of Object.entries(area)) next.set(key, String(value)); return next })
  }
  function select(id) {
    setSelectedId(id); setShowMap(true)
    if (window.matchMedia('(min-width: 992px)').matches) document.getElementById('listing-card-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  return <section className={'container-fluid page-space discovery-page' + (favorites ? ' favorites-page' : ' map-discovery-page')}>
    <div className={'discovery-layout ' + (showMap && !favorites ? 'with-map' : 'list-only')}>
    <div className="discovery-controls"><div className="page-heading"><div><span className="eyebrow">{params.has('campus_id') ? campus?.name || 'YOUR CAMPUS' : 'FIND YOUR CAMPUS. FIND YOUR PLACE.'}</span><h1>{favorites ? 'Your favorites' : 'Places for your student life'}</h1><p>{favorites ? 'Your saved listings. Confirm availability and terms with the owner.' : 'Explore rooms, compare costs, and see what’s nearby.'}</p></div>{favorites && <Link to="/listings" className="btn btn-outline-primary">Browse listings</Link>}</div>
    <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
    {!favorites && <div className="results-search-bar"><CampusResultsSearch key={'search:' + (params.get('campus_id') || '') + ':' + (params.get('q') || '')} params={params} campuses={campuses.data} pending={campuses.isPending} onSearch={changeSearch} /><SearchFilters key={'filters:' + params.toString()} params={params} onSearch={changeSearch} /></div>}
    <ComparisonTray />
    {favorites && query.data?.meta.unavailable_ids?.length > 0 && <div className="alert alert-info"><p role="status">{query.data.meta.unavailable_ids.length} saved listing(s) are currently unpublished. They remain saved and will return here if approved again.</p><div className="d-flex gap-2 flex-wrap">{query.data.meta.unavailable_ids.map(id => <FavoriteButton key={id} propertyId={id} title={'unpublished listing ' + id} />)}</div></div>}
    {!favorites && <div className="discovery-toolbar"><p className="small mb-0" role="status">{query.data ? query.data.meta.total + ' listings found · Page ' + page + ' of ' + query.data.meta.last_page : 'Searching housing…'}</p><ListingSort params={params} onSearch={changeSearch} /><button className="btn btn-outline-primary btn-sm" aria-pressed={showMap} onClick={() => setShowMap(value => !value)}>{showMap ? 'List only' : 'Show map'}</button></div>}
    </div>
      <div className="discovery-results">
        {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rows.length ? <div className="listing-grid">{rows.map(property => <ListingCard key={property.id} property={property} campus={campus} chosenOptionId={choices[property.id]} selectedId={selectedId} onSelect={favorites ? undefined : select} onOptionChange={(id,optionId) => setChoices(current => ({ ...current, [id]: optionId }))} />)}</div> : <div className="panel empty-state"><h2>{favorites ? 'No published favorites to show.' : 'No listings match your search.'}</h2><p>{favorites ? 'Save a reviewed listing to find it here later.' : 'This campus may not have nearby listings yet, or your filters may be too narrow.'}</p>{!favorites && <div className="d-flex gap-2 flex-wrap justify-content-center"><button className="btn btn-outline-primary" onClick={() => setParams(current => { const next = new URLSearchParams(current); for (const key of ['radius_km','south','north','west','east','page']) next.delete(key); return next })}>Remove distance limits</button><button className="btn btn-link" onClick={() => setParams({})}>Clear all filters</button></div>}</div>}
        {query.data?.meta.last_page > 1 && <nav className="d-flex gap-3 align-items-center mt-4" aria-label="Listing pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => turnPage(page - 1)}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => turnPage(page + 1)}>Next</button></nav>}
      </div>
      {!favorites && <aside className="discovery-map-column" aria-label="Explore listings on the map" hidden={!showMap}>
        {mapQuery.isPending ? <Loading>Preparing map results…</Loading> : mapQuery.error ? <ErrorNotice error={mapQuery.error} retry={() => mapQuery.refetch()} /> : <><div className="map-heading"><span>Explore the neighborhood</span><p>{mapQuery.data?.meta.total || 0} matching listings across all pages{mapQuery.data?.meta.limited ? ' · Showing the first 200; narrow your search for more detail.' : ''}</p></div><CampusMap properties={markers} campus={campus} radius={params.get('radius_km')} bounds={bounds} viewport={viewport} onViewportChange={rememberViewport} selectedId={selectedId} onSelect={select} onAreaSearch={searchArea}>
          {walking => preview && <MapListingPreview key={preview.id} property={preview} option={previewOption} campus={campus} browse={'/listings?' + params.toString()} walking={walking} onClose={() => { setSelectedId(null); document.querySelector('.map-workspace [aria-label="Listing map"]')?.focus({ preventScroll: true }) }} onOptionChange={optionId => { setChoices(current => ({ ...current, [preview.id]: optionId })); if (compare.selections.some(item => item.property_id === preview.id)) compare.choose(preview.id, optionId) }} compareDisabled={compare.selections.length >= 3 && !compare.selections.some(item => item.property_id === preview.id)} onCompare={() => previewOption && compare.choose(preview.id, previewOption.id)} />}</CampusMap></>}
      </aside>}
    </div>
  </section>
}

export function ListingDetails() {
  const location = useLocation()
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data: user } = useCurrentUser()
  const { selections, choose } = useComparison()
  const campuses = useCampuses()
  const [choice, setChoice] = useState('')
  const [viewingDirty, setViewingDirty] = useState(false)
  const query = useQuery({ queryKey: ['listing', id, params.get('campus_id')], queryFn: async () => (await api.get('/listings/' + id, { params: { campus_id: params.get('campus_id') || undefined } })).data.data, retry: false, refetchInterval: viewingDirty ? false : 240_000 })
  if (query.isPending) return <div className="container page-space"><Loading /></div>
  if (query.error) return <div className="container page-space"><ErrorNotice error={query.error} retry={() => query.refetch()} /><Link to="/listings">Browse other listings</Link></div>
  const property = query.data
  const option = property.room_options.find(item => item.id === Number(choice || params.get('option'))) || preferredOption(property.room_options)
  const campus = campuses.data?.find(item => String(item.id) === params.get('campus_id'))
  const checked = selections.some(item => item.property_id === property.id)
  return <section className="container page-space listing-detail-page"><Link className="back-link" to={location.state?.browse || '/listings?' + (params.get('campus_id') ? 'campus_id=' + params.get('campus_id') + '&sort=recommended&radius_km=2' : '')}>← Browse listings</Link><div className="page-heading mt-4"><div><span className="eyebrow">{property.property_type.replaceAll('_', ' ')}</span><h1>{property.title}</h1><p>{property.address}, {property.city}</p></div></div>
    <ComparisonTray />
    <div className="listing-detail-layout"><div className="listing-detail-gallery"><PhotoGallery key={property.id} photos={property.photos} refresh={() => query.refetch()} /></div><div className="listing-detail-main"><section className="panel mb-4"><h2>About this property</h2><p className="preserve-lines">{property.description}</p><p className="small text-secondary">{campus && distanceLabel(property.distance_from_campus, campus)}</p><p className="small text-secondary">Reviewed for listing content. This does not certify safety, legal compliance or ownership.</p></section><ListingInformation property={property} /><ListingMap properties={[property]} campus={campus} />{user?.role === 'student' && <ReportForm key={'report-' + property.id} property={property} />}</div><div className="listing-detail-aside"><section className="panel" id="rooms-and-costs" aria-label="Selected room summary"><h2>Rooms and costs</h2>{option ? <><RoomChoice options={property.room_options} selectedId={option.id} onChange={optionId => { if (viewingDirty && !window.confirm('Discard your unsent viewing request before changing room options?')) return; setChoice(String(optionId)); if (checked) choose(property.id, optionId) }} /><div className="room-cost-overview"><p className="room-overview-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><dl className="cost-quick-list"><div><dt>Known monthly charges</dt><dd>{pesos(option.monthly_fixed_total_centavos)}</dd></div><div><dt>Deposit, advance & one-time fees</dt><dd>{pesos(option.move_in_fixed_total_centavos)}</dd></div></dl><p className="small">{option.capacity}-person room · {option.available_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'} available{option.availability_stale ? ' · Needs confirmation' : ' · Recently confirmed'}</p></div><AvailabilityStatus option={option} /><details className="room-terms"><summary>Detailed charges and room terms</summary><RoomCharges option={option} /></details><div className="listing-decisions">{(!user || user.role === 'student') ? <ListingActions key={'actions-' + option.id} property={property} option={option} campus={campus} onDirtyChange={setViewingDirty} /> : <p className="small text-secondary">Students can request a visit or message the owner here.</p>}</div></> : <p>No room options currently available.</p>}</section></div></div>
  </section>
}

export { default as Comparison } from './ComparisonWorkspace'
