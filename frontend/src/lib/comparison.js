import { createContext, useContext } from 'react'

export const ComparisonContext = createContext(null)
export const useComparison = () => useContext(ComparisonContext)

export function cleanSelections(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value.filter(item => item && Number.isSafeInteger(item.property_id) && item.property_id > 0 && Number.isSafeInteger(item.room_option_id) && item.room_option_id > 0 && !seen.has(item.property_id) && seen.add(item.property_id)).slice(0, 3)
}

export function comparisonItems(selections) {
  return selections.map(item => `${item.property_id}:${item.room_option_id}`).join(',')
}

export function parseSelections(items) {
  return (items || '').split(',').filter(Boolean).map(value => {
    const parts = value.split(':')
    return { property_id: parts.length === 2 ? Number(parts[0]) : NaN, room_option_id: parts.length === 2 ? Number(parts[1]) : NaN }
  })
}
