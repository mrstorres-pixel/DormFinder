import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useCampuses } from '../lib/discovery'
import { cleanSelections, comparisonItems, parseSelections, useComparison } from '../lib/comparison'
import { comparisonHighlights } from '../lib/practical'
import { useComparisonWalkingRoutes, walkingLabel } from '../lib/walking'
import { pesos } from '../lib/money'
import { amenities } from '../lib/housing'
import { ErrorNotice, Loading } from './Feedback'
import CampusSearch from './CampusSearch'
import ListingLocationMap from './ListingLocationMap'
import SavePlaceButton from './SavePlaceButton'
import AvailabilityStatus from './AvailabilityStatus'
import './comparison-workspace.css'

export default function ComparisonWorkspace() {
  const [params, setParams] = useSearchParams()
  const { choose, replace } = useComparison()
  const campuses = useCampuses()
  const items = params.get('items') || ''
  const selections = parseSelections(items)
  const valid = selections.length >= 2 && selections.length <= 3 && cleanSelections(selections).length === selections.length
  const campus = campuses.data?.find(item => String(item.id) === params.get('campus_id'))
  const [routeChoice, setRouteChoice] = useState(null)
  const query = useQuery({ queryKey: ['comparison', items], enabled: valid, queryFn: () => writeApi('post', '/compare', { selections }), retry: false, refetchInterval: 240_000 })
  const rows = valid ? query.data || [] : []
  const walking = useComparisonWalkingRoutes(rows, campus)
  const routes = walking.data || {}
  const selectedRoute = rows.find(property => property.id === routeChoice && routes[property.id]?.route) || rows.find(property => routes[property.id]?.route)
  const highlights = comparisonHighlights(rows, routes)
  useEffect(() => {
    const parsed = parseSelections(items)
    if (parsed.length >= 2 && cleanSelections(parsed).length === parsed.length) replace(parsed)
  }, [items, replace])

  function change(propertyId, optionId) {
    choose(propertyId, optionId)
    setParams(current => { const next = new URLSearchParams(current); next.set('items', comparisonItems(selections.map(item => item.property_id === propertyId ? { ...item, room_option_id: Number(optionId) } : item))); return next })
  }
  function remove(propertyId) {
    choose(propertyId, 0, false)
    setParams(current => { const next = new URLSearchParams(current); next.set('items', comparisonItems(selections.filter(item => item.property_id !== propertyId))); return next })
  }
  function changeCampus(id) {
    setParams(current => { const next = new URLSearchParams(current); if (id) next.set('campus_id', id); else next.delete('campus_id'); return next })
  }
  function showRoute(propertyId) {
    setRouteChoice(propertyId)
    document.getElementById('comparison-map')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }
  function walkingCell(property) {
    if (!campus) return <span className="comparison-muted">Choose a campus above</span>
    if (walking.isFetching) return <span role="status">Calculating walk…</span>
    const result = routes[property.id]
    return result?.route ? <div className="comparison-walk"><strong>{walkingLabel(result.route)}</strong><button type="button" onClick={() => showRoute(property.id)} aria-label={'Show walking route from ' + property.title}>Show route on map</button></div> : <span className="comparison-route-error">{result?.error || 'Walking estimate unavailable.'}</span>
  }
  const essentials = [
    ['Monthly base rent', (_, option) => <span className="comparison-price"><strong>{pesos(option.monthly_rent_centavos)}</strong><small>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</small></span>],
    ['Known monthly charges', (_, option) => <strong>{pesos(option.monthly_fixed_total_centavos)}</strong>],
    ['Deposit, advance and one-time fees', (_, option) => pesos(option.move_in_fixed_total_centavos)],
    ['Room capacity', (_, option) => `${option.capacity} ${option.capacity === 1 ? 'person' : 'people'}`],
    ['Availability updated', (_, option) => <AvailabilityStatus option={option} />],
    ['Available inventory', (_, option) => `${option.available_units} of ${option.total_units} ${option.inventory_type === 'bedspace' ? 'beds' : 'rooms'}${option.available_units === 0 ? ' · Sold out' : option.availability_stale ? ' · Needs confirmation' : ''}`],
    ['Walk to campus', property => walkingCell(property)],
  ]
  const terms = [
    ['Price basis', (_, option) => option.price_basis === 'per_person' ? 'Per person' : 'Per room'],
    ['Deposit', (_, option) => pesos(option.deposit_centavos)],
    ['Advance rent', (_, option) => `${option.advance_months} month(s)`],
    ['Fixed fees', (_, option) => option.fees.map(fee => `${fee.name}: ${pesos(fee.amount_centavos)} (${fee.frequency.replaceAll('_', ' ')})`).join('; ') || 'None stated'],
    ['Utilities and other terms', (_, option) => option.utilities_notes || 'Not provided'],
    ['Property type', property => property.property_type.replaceAll('_', ' ')],
    ['Shared amenities', property => property.amenities == null ? 'Not provided' : property.amenities.map(key => amenities[key] || key).join(', ') || 'None listed'],
    ['House rules', property => property.house_rules || 'Not provided'],
    ['Address', property => `${property.address}, ${property.city}`],
  ]
  const destination = property => `/listings/${property.id}?option=${property.room_options[0].id}${campus ? '&campus_id=' + campus.id : ''}`
  const tableRows = cells => cells.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{rows.map(property => <td key={property.id}>{value(property, property.room_options[0])}</td>)}</tr>)
  const partialFailure = campus && !walking.isFetching && (walking.error || rows.some(property => routes[property.id]?.error))
  return <section className="container-fluid page-space comparison-page" style={{ '--comparison-count': rows.length || 2 }}>
    <Link className="back-link" to="/listings">← Choose listings</Link>
    <header className="comparison-heading"><h1>Compare your options</h1><p>Compare two or three places, their room costs and the walk to your campus.</p></header>
    {!valid ? <div className="panel comparison-empty"><h2>Choose at least two listings</h2><p>Select two or three different listings to compare their rooms.</p><Link className="btn btn-primary" to="/listings">Choose another listing</Link></div> : query.isPending ? <Loading /> : query.error ? <><ErrorNotice error={query.error} retry={() => query.refetch()} /><div className="comparison-recovery">{selections.map(item => <button className="btn btn-outline-primary" key={item.property_id} onClick={() => remove(item.property_id)}>Remove listing {item.property_id}</button>)}</div></> : <>
      <section className="comparison-campus" id="comparison-campus" aria-label="Comparison walking destination">
        <CampusSearch campuses={campuses.data || []} value={String(campus?.id || '')} onChange={changeCampus} label="Walking destination" requireQuery disabled={campuses.isPending || !!campuses.error} helper="Choose a campus to calculate each listing’s walking distance and estimated time." />
        <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />
        {campus && <p className="comparison-destination" role="status">{walking.isFetching ? 'Calculating walking routes to ' : 'Walking comparison to ' }<strong>{campus.name}</strong></p>}
        {partialFailure && <div className="comparison-routing-retry"><p>Some walking estimates could not be calculated. Available estimates are shown below.</p><button className="btn btn-outline-primary btn-sm" onClick={() => walking.refetch()}>Retry walking estimates</button></div>}
      </section>
      <section className="comparison-essential" aria-label="Comparison highlights">
        <p className="comparison-scroll-hint">Swipe across to see every room →</p>
        <div className="comparison-scroll" role="region" aria-label="Listing comparison table" tabIndex={0}><table className="table comparison-table" aria-label="Selected room essentials">
          <colgroup><col className="comparison-label-column" />{rows.map(property => <col key={property.id} />)}</colgroup>
          <thead><tr><th colSpan={rows.length + 1} className="comparison-selected-cell"><h2 className="visually-hidden">Selected places</h2><div className="comparison-selected-places">{rows.map(property => <article className="comparison-choice" key={property.id}>
            <Link aria-label={'Open listing: ' + property.title} to={destination(property)}>{property.photos[0] ? <img className="comparison-photo" src={property.photos[0].url} alt={property.photos[0].caption} /> : <span className="comparison-photo-placeholder">No photo available</span>}</Link>
            <div className="comparison-choice-heading"><h2><Link to={destination(property)}>{property.title}</Link></h2><p className="comparison-location">{property.city}</p></div>
            <div><label className="form-label" htmlFor={'comparison-room-' + property.id}>Room option<span className="visually-hidden"> for {property.title}</span></label><select id={'comparison-room-' + property.id} className="form-select" value={property.room_options[0].id} onChange={event => change(property.id, event.target.value)}>{property.alternative_room_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
            <div className="comparison-column-actions"><SavePlaceButton compact propertyId={property.id} optionId={property.room_options[0].id} title={property.title} /><button className="btn btn-link btn-sm" aria-label={'Remove ' + property.title} onClick={() => remove(property.id)}>Remove</button></div>
            <div>{highlights[property.id]?.length > 0 && <ul className="comparison-highlight-list">{highlights[property.id].map(reason => <li key={reason}>{reason}</li>)}</ul>}</div>
          </article>)}</div></th></tr><tr className="comparison-room-row"><th scope="col" className="comparison-column-label">Room comparison</th>{rows.map(property => <th key={property.id} scope="col">{property.title}</th>)}</tr></thead><tbody>{tableRows(essentials)}<tr><th scope="row">Listing details</th>{rows.map(property => <td key={property.id}><Link className="btn btn-outline-primary" to={destination(property)}>View room</Link></td>)}</tr></tbody>
        </table></div>
      </section>
      <details className="comparison-terms"><summary>Full costs and property details</summary><div className="comparison-scroll" role="region" aria-label="Detailed comparison" tabIndex={0}><table className="table comparison-table" aria-label="Selected room fees and property terms"><thead><tr><th scope="col">Details</th>{rows.map(property => <th key={property.id} scope="col">{property.title}</th>)}</tr></thead><tbody>{tableRows(terms)}</tbody></table></div></details>
      <div id="comparison-map" className="comparison-map-section">
        {campus && rows.some(property => routes[property.id]?.route) && <div className="comparison-route-picker" role="group" aria-label="Walking route to show">{rows.filter(property => routes[property.id]?.route).map(property => <button type="button" key={property.id} aria-pressed={selectedRoute?.id === property.id} onClick={() => setRouteChoice(property.id)}>{property.title}</button>)}</div>}
        <ListingLocationMap properties={rows} campus={campus} initiallyShown showDestinationSearch={false} walkingComparison={{ routes, selectedId: selectedRoute?.id }} />
      </div>
    </>}
  </section>
}
