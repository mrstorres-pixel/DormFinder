import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusResults } from '../lib/housing'

export default function CampusSearch({ campuses = [], value = '', onChange, name = 'campus_id', label = 'College or university', helper = 'Choose the specific campus. Nearby housing may not be available yet.', placeholder = 'Search campus', disabled = false, requireQuery = false, allowSuggestion = true }) {
  const id = useId()
  const selected = campuses.find(campus => String(campus.id) === String(value))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = campusResults(campuses, query)
  const suggesting = open && (!requireQuery || !!query.trim())
  function choose(campus) { onChange(String(campus.id)); setQuery(''); setOpen(false); setActive(0) }
  function keyDown(event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      setActive(current => Math.max(0, Math.min(results.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter' && suggesting && results[active]) { event.preventDefault(); choose(results[active]) }
  }
  return <div className="campus-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label className="form-label" htmlFor={id}>{label}</label>
    <input type="hidden" name={name} value={value} />
    <div className="campus-input"><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={suggesting} aria-controls={suggesting ? id + '-results' : undefined} aria-activedescendant={suggesting && results[active] ? id + '-option-' + active : undefined} aria-describedby={helper ? id + '-help' : undefined} disabled={disabled} className="form-control" placeholder={placeholder} value={open ? query : selected?.name || query} onFocus={() => { setOpen(true); if (value) setQuery(''); setActive(0) }} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); onChange('') }} onKeyDown={keyDown} autoComplete="off" />
    {value && <button type="button" className="btn btn-link" aria-label="Clear selected campus" disabled={disabled} onClick={() => { onChange(''); setQuery('') }}>×</button>}</div>
    {suggesting && <ul id={id + '-results'} role="listbox" aria-label="Matching campuses" className="campus-results">
      {results.map((campus, index) => <li key={campus.id} id={id + '-option-' + index} role="option" aria-selected={index === active} onMouseDown={event => event.preventDefault()}><button type="button" onClick={() => choose(campus)}><strong>{campus.name}</strong><small>{campus.institution_name} · {campus.city || campus.address}</small></button></li>)}
      {!results.length && <li role="presentation">No matching campus in our current directory.</li>}
    </ul>}
    {helper && <p className="form-text" id={id + '-help'}>{helper}</p>}
    {value && !selected && campuses.length > 0 && <p className="form-text">This campus is not currently available for selection. Choose another campus or clear the selection.</p>}
    {allowSuggestion && query.trim().length > 1 && !results.length && <Link className="campus-missing-link" to={'/campuses/suggest?name=' + encodeURIComponent(query.trim())}>Missing a campus? Suggest it for review</Link>}
  </div>
}
