import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { campusResults } from '../lib/housing'

export default function DiscoverySearch({ campuses = [], value, onChange, disabled = false }) {
  const id = useId()
  const input = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [settled, setSettled] = useState('')
  const selected = campuses.find(campus => String(campus.id) === value.campusId)
  const text = selected?.name || value.query
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value.query.trim()), 250)
    return () => clearTimeout(timer)
  }, [value.query])
  const suggestions = useQuery({ queryKey: ['discovery-suggestions', settled], queryFn: async ({ signal }) => (await api.get('/search-suggestions', { params: { q: settled }, signal })).data.data, enabled: open && !value.campusId && settled.length >= 2 && settled === value.query.trim(), staleTime: 60_000, retry: false })
  const matches = campusResults(campuses, value.query).slice(0, 4).map(campus => ({ key: 'campus-' + campus.id, kind: 'Campus', label: campus.name, detail: campus.city || campus.institution_name, campusId: String(campus.id), query: '' }))
  if (value.query.trim() && !value.campusId) {
    matches.unshift({ key: 'text', kind: 'Search all places', label: value.query.trim(), detail: 'Listing names, streets and cities', campusId: '', query: value.query.trim() })
    if (settled === value.query.trim()) for (const item of suggestions.data || []) matches.push({ ...item, key: item.kind + '-' + (item.id || item.label), campusId: '', query: [...item.label].slice(0, 100).join('') })
  }
  function choose(item) { onChange({ campusId: item.campusId, query: item.query }); setOpen(false); setActive(-1); input.current?.focus() }
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); setOpen(true)
      setActive(current => Math.max(0, Math.min(matches.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter') {
      if (open && active >= 0 && matches[active]) { event.preventDefault(); choose(matches[active]) }
      else setOpen(false)
    }
  }
  return <div className="campus-search discovery-search" data-tour="search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label className="form-label" htmlFor={id}>Campus, location or listing</label>
    <div className="campus-input"><input ref={input} id={id} className="form-control" type="search" maxLength={100} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open && matches.length > 0} aria-controls={open ? id + '-results' : undefined} aria-activedescendant={open && active >= 0 ? id + '-option-' + active : undefined} aria-describedby={id + '-help'} placeholder="Try UST, Sampaloc or a dorm name" value={text} disabled={disabled} onFocus={() => setOpen(true)} onChange={event => { onChange({ campusId: '', query: event.target.value }); setActive(-1); setOpen(true) }} onKeyDown={keyDown} />
      {!!text && <button type="button" aria-label="Clear search" disabled={disabled} onClick={() => { onChange({ campusId: '', query: '' }); setActive(-1); input.current?.focus() }}>×</button>}
    </div>
    {open && matches.length > 0 && <ul id={id + '-results'} role="listbox" aria-label="Search suggestions" className="campus-results discovery-suggestions">{matches.map((item, index) => <li id={id + '-option-' + index} key={item.key} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()}><button type="button" aria-label={item.kind + ' ' + item.label} onClick={() => choose(item)}><span className="suggestion-kind">{item.kind}</span><strong>{item.label}</strong><small>{item.detail}</small></button></li>)}</ul>}
    <p id={id + '-help'} className="form-text">Choose a campus for distances, or search any listing, street or city.</p>
    {open && suggestions.isError && <p className="search-suggestion-notice" role="status">Place suggestions are unavailable. You can still search the words you entered.</p>}
  </div>
}
