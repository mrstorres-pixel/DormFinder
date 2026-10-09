import { useEffect, useState } from 'react'
import { ComparisonContext, cleanSelections } from '../lib/comparison'

export default function ComparisonProvider({ children }) {
  const [selections, setSelections] = useState(() => {
    try { return cleanSelections(JSON.parse(sessionStorage.getItem('dormfinder-comparison') || '[]')) } catch { return [] }
  })
  useEffect(() => { try { sessionStorage.setItem('dormfinder-comparison', JSON.stringify(selections)) } catch { /* The in-memory selection remains usable when browser storage is unavailable. */ } }, [selections])
  function choose(propertyId, optionId, checked = true) {
    setSelections(current => checked ? cleanSelections([...current.filter(item => item.property_id !== propertyId), { property_id: propertyId, room_option_id: Number(optionId) }]) : current.filter(item => item.property_id !== propertyId))
  }
  return <ComparisonContext.Provider value={{ selections, choose, clear: () => setSelections([]) }}>{children}</ComparisonContext.Provider>
}
