import { useId, useState } from 'react'
import { campusResults } from '../lib/housing'

export default function CampusSearch({ campuses = [], value = '', onChange, name = 'campus_id' }) {
  const id = useId()
  const selected = campuses.find(campus => String(campus.id) === String(value))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = campusResults(campuses, query)
  function choose(campus) { onChange(String(campus.id)); setQuery(''); setOpen(false); setActive(0) }
  function keyDown(event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      setActive(current => Math.max(0, Math.min(results.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter' && open && results[active]) { event.preventDefault(); choose(results[active]) }
  }
  return <div className="campus-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label className="form-label" htmlFor={id}>College or university</label>
    <input type="hidden" name={name} value={value} />
    <div className="campus-input"><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-results'} aria-activedescendant={open && results[active] ? id + '-option-' + active : undefined} className="form-control" placeholder="Search your university, campus, or city" value={open ? query : selected?.name || query} onFocus={() => { setOpen(true); setQuery(''); setActive(0) }} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); onChange('') }} onKeyDown={keyDown} autoComplete="off" />
    {value && <button type="button" className="btn btn-link" aria-label="Clear selected campus" onClick={() => { onChange(''); setQuery('') }}>×</button>}</div>
    {open && <ul id={id + '-results'} role="listbox" aria-label="Matching campuses" className="campus-results">
      {results.map((campus, index) => <li key={campus.id} id={id + '-option-' + index} role="option" aria-selected={index === active} onMouseDown={event => event.preventDefault()}><button type="button" onClick={() => choose(campus)}><strong>{campus.name}</strong><small>{campus.institution_name} · {campus.city || campus.address}</small></button></li>)}
      {!results.length && <li role="presentation">No matching campus in our current directory.</li>}
    </ul>}
    <p className="form-text">Choose the specific campus. Nearby housing may not be available yet.</p>
  </div>
}
