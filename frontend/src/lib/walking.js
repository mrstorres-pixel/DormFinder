import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export const walkingIdentity = (property, campus) => property && campus ? [property.id, property.latitude, property.longitude, campus.id, campus.latitude, campus.longitude].join(':') : ''

export function walkingLabel(route) {
  const minutes = Math.max(1, Math.ceil(route.duration_seconds / 60))
  const distance = route.distance_meters >= 1000 ? (route.distance_meters / 1000).toFixed(1) + ' km' : Math.round(route.distance_meters) + ' m'
  return `About ${minutes} min walk · ${distance}`
}

export function useWalkingRoute(property, campus) {
  const client = useQueryClient()
  const identity = walkingIdentity(property, campus)
  const [requested, setRequested] = useState('')
  const active = !!identity && requested === identity
  const query = useQuery({
    queryKey: ['walking-route', identity], enabled: active,
    queryFn: async ({ signal }) => (await api.get(`/listings/${property.id}/walking-route`, { params: { campus_id: campus.id }, signal })).data.data,
    staleTime: 86_400_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  return { active, route: active ? query.data : null, loading: active && query.isFetching, error: active ? query.error : null,
    show: () => { if (active) query.refetch(); else setRequested(identity) }, clear: () => { client.cancelQueries({ queryKey: ['walking-route', identity], exact: true }); setRequested('') } }
}

function routingPause(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1200)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

export function useComparisonWalkingRoutes(properties, campus) {
  const client = useQueryClient()
  const identities = properties.map(property => walkingIdentity(property, campus)).join('|')
  return useQuery({
    queryKey: ['comparison-walking', identities], enabled: !!campus && properties.length >= 2,
    queryFn: async ({ signal }) => {
      const routes = {}
      let requested = false
      for (const property of properties) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        if (property.latitude == null || property.longitude == null) {
          routes[property.id] = { error: 'No property location pin is available.' }
          continue
        }
        const key = ['walking-route', walkingIdentity(property, campus)]
        const cached = client.getQueryState(key)
        if (cached?.data && Date.now() - cached.dataUpdatedAt < 86_400_000) {
          routes[property.id] = { route: cached.data }
          continue
        }
        // Request only the selected two or three public listings, respecting the shared router cooldown.
        if (requested) await routingPause(signal)
        requested = true
        try {
          const route = (await api.get(`/listings/${property.id}/walking-route`, { params: { campus_id: campus.id }, signal })).data.data
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
          if (!Number.isFinite(route?.distance_meters) || !Number.isFinite(route?.duration_seconds) || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2) throw new Error('Invalid walking route')
          client.setQueryData(key, route)
          routes[property.id] = { route }
        } catch (error) {
          if (signal.aborted) throw error
          routes[property.id] = { error: error.response?.data?.message || 'Walking directions are temporarily unavailable.' }
        }
      }
      return routes
    },
    staleTime: query => Object.values(query.state.data || {}).some(item => item.error) ? 0 : 86_400_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
}

export function drawWalkingRoute(L, map, route, property, campus, preview = false) {
  const layer = L.layerGroup().addTo(map)
  const points = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
  L.polyline(points, { color: '#fff', weight: 9, opacity: 1, interactive: false }).addTo(layer)
  const path = L.polyline(points, { color: '#2558e5', weight: 5, opacity: 1, interactive: false, className: 'walking-route-path' }).addTo(layer)
  const pins = [[property.latitude, property.longitude], [campus.latitude, campus.longitude]]
  for (const [index, point] of [points[0], points.at(-1)].entries()) {
    L.polyline([pins[index], point], { color: '#14233e', weight: 2, dashArray: '3 5', interactive: false, className: 'walking-route-connection' }).addTo(layer)
    L.circleMarker(point, { radius: 5, color: '#fff', fillColor: '#2558e5', fillOpacity: 1, weight: 2, interactive: false }).addTo(layer)
  }
  let frame
  function fit() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (map.getContainer().querySelector('.leaflet-zoom-anim')) { map.off('zoomend', fit); map.once('zoomend', fit); return }
      map.invalidateSize({ pan: false })
      const card = preview && map.getContainer().parentElement.querySelector('.map-preview')
      const bottom = card ? card.getBoundingClientRect().height + 95 : 75
      map.fitBounds(path.getBounds().extend(pins), { paddingTopLeft: [35, 80], paddingBottomRight: [35, bottom], maxZoom: 17, animate: false })
    })
  }
  // Leaflet ignores setView during an active zoom transition. Fit after that transition ends.
  fit()
  map.on('resize', fit)
  const card = preview && map.getContainer().parentElement.querySelector('.map-preview')
  const observer = card ? new ResizeObserver(fit) : null
  if (card) observer.observe(card)
  return () => { observer?.disconnect(); cancelAnimationFrame(frame); map.off('zoomend', fit); map.off('resize', fit); layer.remove() }
}
