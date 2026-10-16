import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { pesos } from '../lib/money'
import { useCampuses, distanceLabel } from '../lib/discovery'
import { useComparison, parseSelections, comparisonItems, cleanSelections } from '../lib/comparison'
import { ErrorNotice, Loading } from './Feedback'
import { RoomCharges } from './RoomOptions'
import { ComparisonTray, SearchFilters, ListingCard, PhotoGallery, ListingMap } from './Discovery'
import { ReportForm } from './ModerationPages'
import CampusMap from './CampusMap'
import ListingInformation from './ListingInformation'
import { preferredOption, searchParameters, amenities } from '../lib/housing'
import { comparisonHighlights, detailedMatches } from '../lib/practical'
import ListingActions from './ListingActions'
import { browseKey, readBrowseState, saveBrowseState } from '../lib/browseState'
import { ListingSort } from './SearchFilters'
import CampusResultsSearch from './CampusResultsSearch'
import FavoriteButton from './SavePlaceButton'
import RoomChoice from './RoomChoice'

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
  const campus = campuses.data?.find(item => String(item.id) === (params.get('campus_id') || String(rows[0]?.distance_from_campus?.campus_id || ''))) || campuses.data?.find(item => item.slug === 'tip-manila-casal')
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
    setParams(next)
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
    {!favorites && <div className="results-search-bar"><CampusResultsSearch key={'campus:' + params.toString()} params={params} campuses={campuses.data} pending={campuses.isPending} onSearch={changeSearch} /><SearchFilters key={'filters:' + params.toString()} params={params} onSearch={changeSearch} /></div>}
    <ComparisonTray />
    {favorites && query.data?.meta.unavailable_ids?.length > 0 && <div className="alert alert-info"><p role="status">{query.data.meta.unavailable_ids.length} saved listing(s) are currently unpublished. They remain saved and will return here if approved again.</p><div className="d-flex gap-2 flex-wrap">{query.data.meta.unavailable_ids.map(id => <FavoriteButton key={id} propertyId={id} title={'unpublished listing ' + id} />)}</div></div>}
    {!favorites && <div className="discovery-toolbar"><p className="small mb-0" role="status">{query.data ? query.data.meta.total + ' listings found · Page ' + page + ' of ' + query.data.meta.last_page : 'Searching housing…'}</p><ListingSort params={params} onSearch={changeSearch} /><button className="btn btn-outline-primary btn-sm" aria-pressed={showMap} onClick={() => setShowMap(value => !value)}>{showMap ? 'List only' : 'Show map'}</button></div>}
    </div>
      <div className="discovery-results">
        {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rows.length ? <div className="listing-grid">{rows.map(property => <ListingCard key={property.id} property={property} campus={campus} chosenOptionId={choices[property.id]} selectedId={selectedId} onSelect={favorites ? undefined : select} onOptionChange={(id,optionId) => setChoices(current => ({ ...current, [id]: optionId }))} />)}</div> : <div className="panel empty-state"><h2>{favorites ? 'No published favorites to show.' : 'No listings match your search.'}</h2><p>{favorites ? 'Save a reviewed listing to find it here later.' : 'This campus may not have nearby listings yet, or your filters may be too narrow.'}</p>{!favorites && <div className="d-flex gap-2 flex-wrap justify-content-center"><button className="btn btn-outline-primary" onClick={() => setParams(current => { const next = new URLSearchParams(current); for (const key of ['radius_km','south','north','west','east','page']) next.delete(key); return next })}>Remove distance limits</button><button className="btn btn-link" onClick={() => setParams({})}>Clear all filters</button></div>}</div>}
        {query.data?.meta.last_page > 1 && <nav className="d-flex gap-3 align-items-center mt-4" aria-label="Listing pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => turnPage(page - 1)}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => turnPage(page + 1)}>Next</button></nav>}
      </div>
      {!favorites && campus && <aside className="discovery-map-column" aria-label="Explore listings on the map" hidden={!showMap}>
        {mapQuery.isPending ? <Loading>Preparing map results…</Loading> : mapQuery.error ? <ErrorNotice error={mapQuery.error} retry={() => mapQuery.refetch()} /> : <><div className="map-heading"><span>Explore the neighborhood</span><p>{mapQuery.data?.meta.total || 0} matching listings across all pages{mapQuery.data?.meta.limited ? ' · Showing the first 200; narrow your search for more detail.' : ''}</p></div><CampusMap properties={markers} campus={campus} radius={params.get('radius_km')} bounds={bounds} viewport={viewport} onViewportChange={rememberViewport} selectedId={selectedId} onSelect={select} onAreaSearch={searchArea}>
          {preview && <article className="map-preview panel" aria-label="Selected map listing"><button className="map-preview-close" aria-label="Close listing preview" onClick={event => { setSelectedId(null); event.currentTarget.closest('.map-workspace').querySelector('[aria-label="Listing map"]').focus() }}>×</button>{preview.photos?.[0] && <Link className="map-preview-image" aria-label={'Open listing: ' + preview.title} to={'/listings/' + preview.id + '?campus_id=' + campus.id + '&option=' + (previewOption?.id || '')} state={{ browse: '/listings?' + params.toString() }}><img src={preview.photos[0].url} alt={preview.photos[0].caption} /></Link>}<div><strong><Link to={'/listings/' + preview.id + '?campus_id=' + campus.id + '&option=' + (previewOption?.id || '')} state={{ browse: '/listings?' + params.toString() }}>{preview.title}</Link></strong><label className="form-label small mt-2" htmlFor="map-preview-room">Room in map preview</label><select className="form-select form-select-sm mb-2" id="map-preview-room" value={previewOption?.id || ''} onChange={event => { const optionId = Number(event.target.value); setChoices(current => ({ ...current, [preview.id]: optionId })); if (compare.selections.some(item => item.property_id === preview.id)) compare.choose(preview.id, optionId) }}>{preview.room_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><ul className="match-reasons">{detailedMatches(preview,params,previewOption).map(reason => <li key={reason}>{reason}</li>)}</ul><p className="small mb-1">{previewOption && <>{pesos(previewOption.monthly_fixed_total_centavos)} known monthly · {previewOption.price_basis === 'per_person' ? 'per person' : 'per room'}<br />{previewOption.available_units} available · {previewOption.availability_stale ? 'Needs confirmation' : 'Recently confirmed'}</>}</p><Link to={'/listings/' + preview.id + '?campus_id=' + campus.id + '&option=' + (previewOption?.id || '')} state={{ browse: '/listings?' + params.toString() }}>View listing</Link>{previewOption && <button className="btn btn-link btn-sm" disabled={compare.selections.length >= 3 && !compare.selections.some(item => item.property_id === preview.id)} onClick={() => compare.choose(preview.id, previewOption.id)}>Add to comparison</button>}</div></article>}</CampusMap></>}
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
  const campus = campuses.data?.find(item => item.id === property.distance_from_campus?.campus_id)
  const checked = selections.some(item => item.property_id === property.id)
  return <section className="container page-space listing-detail-page"><Link className="back-link" to={location.state?.browse || '/listings?' + (params.get('campus_id') ? 'campus_id=' + params.get('campus_id') + '&sort=recommended&radius_km=2' : '')}>← Browse listings</Link><div className="page-heading mt-4"><div><span className="eyebrow">{property.property_type.replaceAll('_', ' ')}</span><h1>{property.title}</h1><p>{property.address}, {property.city}</p></div><div className="listing-heading-actions">{property.is_demo && <span className="badge text-bg-warning">Synthetic demo listing</span>}</div></div>
    <ComparisonTray />
    <div className="listing-detail-layout"><div className="listing-detail-gallery"><PhotoGallery key={property.id} photos={property.photos} refresh={() => query.refetch()} /></div><div className="listing-detail-main"><section className="panel mb-4"><h2>About this property</h2><p className="preserve-lines">{property.description}</p><p className="small text-secondary">{distanceLabel(property.distance_from_campus, campus)}</p><p className="small text-secondary">Reviewed for listing content. This does not certify safety, legal compliance or ownership.</p></section><ListingInformation property={property} /><ListingMap properties={[property]} campus={campus} />{user?.role === 'student' && <ReportForm key={'report-' + property.id} property={property} />}</div><div className="listing-detail-aside"><section className="panel" id="rooms-and-costs" aria-label="Selected room summary"><h2>Rooms and costs</h2>{option ? <><RoomChoice options={property.room_options} selectedId={option.id} onChange={optionId => { if (viewingDirty && !window.confirm('Discard your unsent viewing request before changing room options?')) return; setChoice(String(optionId)); if (checked) choose(property.id, optionId) }} /><div className="room-cost-overview"><p className="room-overview-price">{pesos(option.monthly_rent_centavos)} <span>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</span></p><dl className="cost-quick-list"><div><dt>Known monthly charges</dt><dd>{pesos(option.monthly_fixed_total_centavos)}</dd></div><div><dt>Deposit, advance & one-time fees</dt><dd>{pesos(option.move_in_fixed_total_centavos)}</dd></div></dl><p className="small">{option.capacity}-person room · {option.available_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'} available{option.availability_stale ? ' · Needs confirmation' : ' · Recently confirmed'}</p><p className="small text-secondary">Variable utilities and rent not covered by the advance are additional.</p></div><details className="room-terms"><summary>Detailed charges and room terms</summary><RoomCharges option={option} /></details><div className="listing-decisions">{(!user || user.role === 'student') ? <ListingActions key={'actions-' + option.id} property={property} option={option} campus={campus} onDirtyChange={setViewingDirty} /> : <p className="small text-secondary">Students can request a visit or message the owner here.</p>}</div></> : <p>No room options currently available.</p>}</section></div></div>
  </section>
}

export function Comparison() {
  const [params, setParams] = useSearchParams()
  const { choose } = useComparison()
  const campuses = useCampuses()
  const selections = parseSelections(params.get('items'))
  const valid = selections.length > 0 && selections.length <= 3 && cleanSelections(selections).length === selections.length
  const query = useQuery({ queryKey: ['comparison', params.toString()], enabled: valid, queryFn: async () => writeApi('post', '/compare', { selections, campus_id: params.get('campus_id') || undefined }), retry: false, refetchInterval: 240_000 })
  const rows = query.data || []
  const highlights = comparisonHighlights(rows)
  const campus = campuses.data?.find(item => item.id === rows[0]?.distance_from_campus?.campus_id)
  function change(propertyId, optionId) {
    const next = selections.map(item => item.property_id === propertyId ? { ...item, room_option_id: Number(optionId) } : item)
    choose(propertyId, optionId)
    setParams(current => { const result = new URLSearchParams(current); result.set('items', comparisonItems(next)); return result })
  }
  function remove(propertyId) {
    choose(propertyId, 0, false)
    setParams(current => { const result = new URLSearchParams(current); result.set('items', comparisonItems(selections.filter(item => item.property_id !== propertyId))); return result })
  }
  const essentials = [
    ['Monthly base rent', (_, option) => <span className="comparison-price"><strong>{pesos(option.monthly_rent_centavos)}</strong><small>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</small></span>],
    ['Known monthly charges', (_, option) => <strong>{pesos(option.monthly_fixed_total_centavos)}</strong>],
    ['Deposit, advance and one-time fees', (_, option) => pesos(option.move_in_fixed_total_centavos)],
    ['Room capacity', (_, option) => `${option.capacity} people`],
    ['Available inventory', (_, option) => <span className={option.available_units === 0 || option.availability_stale ? 'room-caution' : ''}>{option.available_units} of {option.total_units} {option.inventory_type === 'bedspace' ? 'beds' : 'rooms'}{option.available_units === 0 ? ' · Sold out' : ''}{option.availability_stale ? ' · Needs confirmation' : ' · Recently confirmed'}</span>],
    ['Campus distance', property => distanceLabel(property.distance_from_campus, campus)],
  ]
  const terms = [
    ['Price basis', (_, option) => option.price_basis === 'per_person' ? 'Per person' : 'Per room'],
    ['Deposit', (_, option) => pesos(option.deposit_centavos)],
    ['Advance rent', (_, option) => `${option.advance_months} month(s)`],
    ['Fixed fees', (_, option) => option.fees.map(fee => `${fee.name}: ${pesos(fee.amount_centavos)} (${fee.frequency.replaceAll('_', ' ')})`).join('; ') || 'None stated'],
    ['Utilities and other terms', (_, option) => option.utilities_notes || 'Not provided'],
    ['Availability confirmation', (_, option) => option.availability_confirmed_at ? `${new Date(option.availability_confirmed_at).toLocaleDateString('en-PH')}${option.availability_stale ? ' · Needs confirmation' : ''}` : 'Not provided'],
    ['Property type', property => property.property_type.replaceAll('_', ' ')],
    ['Shared amenities', property => property.amenities == null ? 'Not provided' : property.amenities.map(key => amenities[key] || key).join(', ') || 'None listed'],
    ['House rules', property => property.house_rules || 'Not provided'],
    ['Address', property => `${property.address}, ${property.city}`],
  ]
  const destination = property => `/listings/${property.id}?option=${property.room_options[0].id}${campus ? '&campus_id=' + campus.id : ''}`
  const tableRows = cells => cells.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{rows.map(property => <td key={property.id}>{value(property, property.room_options[0])}</td>)}</tr>)
  return <section className="container-fluid page-space comparison-page" style={{ '--comparison-count': rows.length || 1 }}><Link className="back-link" to="/listings">← Choose listings</Link><h1 className="mt-4">Compare your options</h1><p className="comparison-intro">Your rooms, side by side. Compare the same price basis; per-person and per-room prices differ.</p>
    {!valid ? <div className="panel"><p>Select one to three distinct listings and their room options.</p><Link to="/listings">Browse listings</Link></div> : query.isPending ? <Loading /> : query.error ? <><ErrorNotice error={query.error} retry={() => query.refetch()} /><p>A selected listing or option may no longer be public. Remove it or choose another listing.</p><div className="d-flex gap-2 flex-wrap">{selections.map(item => <button key={item.property_id} className="btn btn-outline-secondary" onClick={() => remove(item.property_id)}>Remove listing {item.property_id}</button>)}</div></> : <>
      <section className="comparison-essential" aria-label="Comparison highlights">
        <p className="comparison-scroll-hint">Swipe across to see every room →</p>
        <div className="comparison-scroll" role="region" aria-label="Listing comparison table" tabIndex={0}><table className="table comparison-table" aria-label="Selected room essentials"><thead><tr><th scope="col"><span className="visually-hidden">Compare</span></th>{rows.map(property => <th scope="col" key={property.id}>
          <Link aria-label={'Open listing: ' + property.title} to={destination(property)}>{property.photos[0] ? <img className="comparison-photo" src={property.photos[0].url} alt={property.photos[0].caption} /> : <span className="comparison-photo-placeholder">No photo available</span>}</Link>
          <h2><Link to={destination(property)}>{property.title}</Link></h2>
          <label className="d-block">Room option<span className="visually-hidden"> for {property.title}</span><select aria-label={'Room option for ' + property.title} className="form-select mt-2" value={property.room_options[0].id} onChange={event => change(property.id, event.target.value)}>{property.alternative_room_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <div className="comparison-column-actions"><FavoriteButton compact propertyId={property.id} optionId={property.room_options[0].id} title={property.title} /><button className="btn btn-link btn-sm" aria-label={'Remove ' + property.title} onClick={() => remove(property.id)}>Remove</button></div>
          {highlights[property.id].length > 0 && <ul className="comparison-highlight-list">{highlights[property.id].map(reason => <li key={reason}>{reason}</li>)}</ul>}
        </th>)}</tr></thead><tbody>{tableRows(essentials)}<tr><th scope="row"><span className="visually-hidden">Next step</span></th>{rows.map(property => <td key={property.id}><Link className="btn btn-outline-primary" to={destination(property)}>View room</Link></td>)}</tr></tbody></table></div>
        <p className="comparison-footnote">Variable utilities and rent not covered by the advance are additional. Cost highlights use the same price basis and recently confirmed vacancies.</p>
      </section>
      <details className="comparison-terms"><summary>Full costs and property details</summary><div className="comparison-scroll" role="region" aria-label="Detailed comparison" tabIndex={0}><table className="table comparison-table" aria-label="Selected room fees and property terms"><thead><tr><th scope="col">Details</th>{rows.map(property => <th key={property.id} scope="col">{property.title}<br /><span className="small text-secondary">{property.room_options[0].name}</span></th>)}</tr></thead><tbody>{tableRows(terms)}</tbody></table></div></details>
      <ListingMap properties={rows} campus={campus} />
    </>}
  </section>
}
