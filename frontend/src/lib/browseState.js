const storageKey = 'dormfinder:browse-context:v1'
const maxSearches = 12

export function browseKey(params) {
  return [...params.entries()].filter(([key]) => key !== 'page').sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y)).map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&')
}

function browserStorage() {
  try { return window.sessionStorage } catch { return null }
}

function readAll(storage) {
  try { const value = JSON.parse(storage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

export function readBrowseState(key, storage = browserStorage()) {
  const value = readAll(storage).find(row => row?.key === key)?.value
  if (!value || typeof value.showMap !== 'boolean') return null
  const choices = Object.fromEntries(Object.entries(value.choices || {}).filter(([id, option]) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(option) && option > 0))
  const view = value.viewport
  const validView = view && Array.isArray(view.center) && view.center.length === 2 && view.center.every(Number.isFinite) && Math.abs(view.center[0]) <= 90 && Math.abs(view.center[1]) <= 180 && Number.isInteger(view.zoom) && view.zoom >= 0 && view.zoom <= 19 && Number.isSafeInteger(view.campusId) && view.campusId > 0 && typeof view.needsSearch === 'boolean'
  return { showMap: value.showMap, selectedId: Number.isSafeInteger(value.selectedId) && value.selectedId > 0 ? value.selectedId : null, choices, viewport: validView ? view : null }
}

export function saveBrowseState(key, value, storage = browserStorage()) {
  try {
    const rows = readAll(storage).filter(row => row?.key !== key)
    storage.setItem(storageKey, JSON.stringify([{ key, value }, ...rows].slice(0, maxSearches)))
  } catch { /* Browsing still works when tab storage is unavailable or full. */ }
}
