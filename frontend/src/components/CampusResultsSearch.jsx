import { useState } from 'react'
import DiscoverySearch from './DiscoverySearch'

export default function CampusResultsSearch({ params, campuses = [], pending, onSearch }) {
  const [value, setValue] = useState({ campusId: params.get('campus_id') || '', query: params.get('q') || '' })
  function search(event) {
    event.preventDefault()
    const { campusId, query } = value
    const next = new URLSearchParams(params)
    const changed = campusId !== (params.get('campus_id') || '') || query.trim() !== (params.get('q') || '')
    next.delete('page')
    if (changed) for (const key of ['south', 'north', 'east', 'west']) next.delete(key)
    if (campusId) {
      next.set('campus_id', campusId)
      if (changed && !next.has('radius_km')) next.set('radius_km', '2')
      if (!next.has('sort')) next.set('sort', 'recommended')
    } else {
      next.delete('campus_id'); next.delete('radius_km')
      if (['recommended', 'distance'].includes(next.get('sort'))) next.set('sort', 'newest')
    }
    if (query.trim()) next.set('q', query.trim()); else next.delete('q')
    onSearch(next)
  }
  return <form className="results-campus-search" onSubmit={search} aria-label="Search places">
    <DiscoverySearch campuses={campuses} value={value} onChange={setValue} />
    <button className="btn btn-primary" disabled={pending}>Search places <span aria-hidden="true">→</span></button>
  </form>
}
