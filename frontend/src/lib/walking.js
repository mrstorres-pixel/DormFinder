import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export function walkingLabel(route) {
  const minutes = Math.max(1, Math.ceil(route.duration_seconds / 60))
  const distance = route.distance_meters >= 1000 ? (route.distance_meters / 1000).toFixed(1) + ' km' : Math.round(route.distance_meters) + ' m'
  return `About ${minutes} min walk · ${distance}`
}

export function useWalkingRoute(property, campus) {
  const client = useQueryClient()
  const identity = property && campus ? [property.id, property.latitude, property.longitude, campus.id, campus.latitude, campus.longitude].join(':') : ''
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
