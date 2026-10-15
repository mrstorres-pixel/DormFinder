import { useRef, useState } from 'react'
import CampusSearch from './CampusSearch'

export default function CampusResultsSearch({ params, campuses = [], pending, onSearch }) {
  const [campusId, setCampusId] = useState(params.get('campus_id') || '')
  const [error, setError] = useState('')
  const form = useRef(null)
  function search(event) {
    event.preventDefault()
    const input = form.current.querySelector('input[role="combobox"]')
    if ((!campusId && input.value.trim()) || (campusId && !campuses.some(campus => String(campus.id) === campusId))) {
      setError('Choose a campus from the suggestions.'); input.focus(); return
    }
    const next = new URLSearchParams(params)
    const changed = campusId !== (params.get('campus_id') || '')
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
    setError(''); onSearch(next)
  }
  return <form ref={form} className="results-campus-search" onSubmit={search} aria-label="Search by campus">
    <CampusSearch campuses={campuses} value={campusId} onChange={value => { setCampusId(value); setError('') }} />
    <button className="btn btn-primary" disabled={pending || !campuses.length}>Search campus <span aria-hidden="true">→</span></button>
    {error && <p className="campus-search-error" role="alert">{error}</p>}
  </form>
}
