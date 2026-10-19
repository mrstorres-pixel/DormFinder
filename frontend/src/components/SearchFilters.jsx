import { useEffect, useRef, useState } from 'react'
import { amenities } from '../lib/housing'
import { pesos, toCentavos } from '../lib/money'

const visibleFilters = params => [...params.entries()].filter(([key]) => !['campus_id', 'page', 'sort', 'south', 'north', 'east', 'west'].includes(key))

export default function SearchFilters({ params, onSearch }) {
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [resetSort, setResetSort] = useState(false)
  const dialog = useRef(null)
  const trigger = useRef(null)
  const form = useRef(null)
  const backdropStart = useRef(false)
  const applied = visibleFilters(params)

  useEffect(() => {
    const node = dialog.current
    if (!expanded) { node.close(); return }
    const root = document.documentElement
    const opener = trigger.current
    const overflow = root.style.overflow
    const padding = document.body.style.paddingRight
    const gap = window.innerWidth - root.clientWidth
    if (gap > 0) document.body.style.paddingRight = (parseFloat(getComputedStyle(document.body).paddingRight) + gap) + 'px'
    root.style.overflow = 'hidden'
    node.showModal()
    return () => { node.close(); root.style.overflow = overflow; document.body.style.paddingRight = padding; opener?.focus({ preventScroll: true }) }
  }, [expanded])

  function close() { setExpanded(false) }
  function fail(message, name) {
    setError(message)
    form.current.elements.namedItem(name)?.focus()
  }
  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const values = Object.fromEntries(data)
    const next = { sort: resetSort ? 'newest' : params.get('sort') || 'newest' }
    if (params.has('campus_id')) next.campus_id = params.get('campus_id')
    for (const key of ['q', 'property_type', 'price_basis', 'available_only', 'inventory_type', 'radius_km']) if (values[key]) next[key] = values[key]
    if (next.radius_km && !next.campus_id) { fail('Choose a campus before filtering by distance.', 'radius_km'); return }
    for (const name of ['min', 'max']) {
      if (values[name + '_rent']?.trim()) {
        try { next[name + '_rent_centavos'] = String(toCentavos(values[name + '_rent'])) }
        catch { fail('Enter rent as a nonnegative PHP amount with at most two decimal places.', name + '_rent'); return }
      }
    }
    if ((next.min_rent_centavos || next.max_rent_centavos || next.sort.startsWith('rent_')) && !next.price_basis) { fail('Choose a price basis before filtering or sorting rent.', 'price_basis'); return }
    if (next.min_rent_centavos && next.max_rent_centavos && Number(next.min_rent_centavos) > Number(next.max_rent_centavos)) { fail('Maximum rent must be at least the minimum rent.', 'max_rent'); return }
    setError('')
    // Keep a deliberate map-area search while refining the same campus/radius.
    if (!resetSort && (next.campus_id || '') === (params.get('campus_id') || '') && (next.radius_km || '') === (params.get('radius_km') || '')) {
      for (const key of ['south', 'north', 'west', 'east']) if (params.has(key)) next[key] = params.get(key)
    }
    const facilities = data.getAll('amenities[]')
    close()
    if (facilities.length) {
      const result = new URLSearchParams(next)
      facilities.forEach(value => result.append('amenities[]', value))
      onSearch(result)
    } else onSearch(next)
  }
  function clearDraft() {
    setError(''); setResetSort(true)
    for (const field of form.current.elements) {
      if (field.type === 'checkbox') field.checked = false
      else if (['text', 'hidden', 'select-one'].includes(field.type)) field.value = ''
    }
  }
  function clearApplied() { onSearch(params.has('campus_id') ? { campus_id: params.get('campus_id'), sort: 'newest' } : {}) }
  function remove(key, value) {
    const next = new URLSearchParams(params)
    if (key === 'amenities[]') { const keep = next.getAll(key).filter(item => item !== value); next.delete(key); keep.forEach(item => next.append(key, item)) }
    else next.delete(key)
    if (key === 'price_basis') { next.delete('min_rent_centavos'); next.delete('max_rent_centavos'); if (next.get('sort')?.startsWith('rent_')) next.delete('sort') }
    next.delete('page'); onSearch(next)
  }
  function outside(event) {
    const box = event.currentTarget.getBoundingClientRect()
    return event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
  }
  function keepFocus(event) {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter(node => node.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <div className="filters-workspace">
    <button ref={trigger} className="btn btn-outline-primary filter-toggle" aria-haspopup="dialog" aria-expanded={expanded} aria-controls="housing-filter-drawer" onClick={() => setExpanded(true)}>Filters{applied.length > 0 && <span className="filter-count">{applied.length}</span>}</button>
    <dialog ref={dialog} id="housing-filter-drawer" className="filter-drawer" aria-labelledby="filter-drawer-title" onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); close() }} onPointerDown={event => { backdropStart.current = outside(event) }} onPointerUp={event => { if (backdropStart.current && outside(event)) close(); backdropStart.current = false }}>
      <form ref={form} id="housing-filters" className="filter-drawer-form" onSubmit={submit}>
        <header className="filter-drawer-heading"><div><h2 id="filter-drawer-title">Find your fit</h2><p>Refine the places you want to see.</p></div><button type="button" className="drawer-close" aria-label="Close filters" onClick={close}>×</button></header>
        <div className="filter-drawer-body">
          <fieldset><legend>Location</legend>
            <label>Distance from campus<select className="form-select" name="radius_km" defaultValue={params.get('radius_km') || ''}><option value="">No distance limit</option>{[0.5, 1, 2, 5].map(radius => <option key={radius} value={radius}>Within {radius} km</option>)}</select></label>
            <label>Search property or city<input className="form-control" name="q" defaultValue={params.get('q') || ''} placeholder="Property, address or city" maxLength={100} /></label>
          </fieldset>
          <fieldset><legend>Your budget</legend>
            <label>Price basis<select aria-label="Price basis" className="form-select" name="price_basis" defaultValue={params.get('price_basis') || ''}><option value="">Choose when filtering rent</option><option value="per_person">Per person</option><option value="per_room">Per room</option></select></label>
            <div className="filter-field-pair"><label>Minimum monthly rent (PHP)<input className="form-control" name="min_rent" inputMode="decimal" placeholder="No minimum" defaultValue={params.has('min_rent_centavos') ? (Number(params.get('min_rent_centavos')) / 100).toFixed(2) : ''} /></label><label>Maximum monthly rent (PHP)<input className="form-control" name="max_rent" inputMode="decimal" placeholder="No maximum" defaultValue={params.has('max_rent_centavos') ? (Number(params.get('max_rent_centavos')) / 100).toFixed(2) : ''} /></label></div>
            <p className="filter-hint">Filters use monthly base rent. Fixed fees and variable utilities are shown separately.</p>
          </fieldset>
          <fieldset><legend>Room preferences</legend><div className="filter-field-pair">
            <label>Room type<select className="form-select" name="inventory_type" defaultValue={params.get('inventory_type') || ''}><option value="">All room types</option><option value="bedspace">Bedspace</option><option value="whole_room">Whole room</option></select></label>
            <label>Property type<select aria-label="Property type" className="form-select" name="property_type" defaultValue={params.get('property_type') || ''}><option value="">All property types</option>{['dormitory', 'apartment', 'boarding_house', 'rental_room'].map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
          </div></fieldset>
          <fieldset><legend>Amenities and availability</legend><div className="filter-amenities">{Object.entries(amenities).map(([value, label]) => <label key={value}><input name="amenities[]" type="checkbox" value={value} defaultChecked={params.getAll('amenities[]').includes(value)} />{label}</label>)}</div><label className="filter-availability"><input name="available_only" type="checkbox" value="1" defaultChecked={params.get('available_only') === '1'} />Available units confirmed within 14 days</label><p className="filter-hint">Price and availability must match the same room option.</p></fieldset>
        </div>
        <footer className="filter-drawer-footer">{error && <p role="alert" className="text-danger">{error}</p>}<div><button type="button" className="btn btn-link" onClick={clearDraft}>Clear filters</button><button className="btn btn-primary">Apply filters</button></div></footer>
      </form>
    </dialog>
    {!!applied.length && <div className="active-filters" aria-label="Active search filters">{applied.map(([key, value]) => <button type="button" className="filter-chip" key={key + value} onClick={() => remove(key, value)} aria-label={'Remove filter ' + key + ' ' + value}>{key === 'amenities[]' ? amenities[value] : key === 'available_only' ? 'Recently confirmed vacancies' : key === 'radius_km' ? 'Within ' + value + ' km' : key.includes('rent_centavos') ? key.startsWith('min') ? 'From ' + pesos(Number(value)) : 'Up to ' + pesos(Number(value)) : value.replaceAll('_', ' ')} <span aria-hidden="true">×</span></button>)}<button className="btn btn-link btn-sm" onClick={clearApplied}>Clear filters</button></div>}
  </div>
}

export function ListingSort({ params, onSearch }) {
  return <label className="listing-sort">Sort<select aria-label="Sort listings" className="form-select" value={params.get('sort') || 'newest'} onChange={event => { const next = new URLSearchParams(params); next.set('sort', event.target.value); next.delete('page'); onSearch(next) }}><option value="recommended">Recommended near campus</option><option value="newest">Recently approved</option><option value="rent_asc" disabled={!params.get('price_basis')}>Monthly rent: low to high</option><option value="rent_desc" disabled={!params.get('price_basis')}>Monthly rent: high to low</option><option value="distance" disabled={!params.get('campus_id')}>Nearest campus first</option></select></label>
}
