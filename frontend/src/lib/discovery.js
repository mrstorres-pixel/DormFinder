import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useCurrentUser } from './auth'

export function useCampuses() {
  return useQuery({ queryKey: ['campuses'], queryFn: async () => (await api.get('/campuses')).data.data, staleTime: 300_000, retry: false })
}

export function useFavorites() {
  const { data: user } = useCurrentUser()
  return useQuery({ queryKey: ['favorite-ids', user?.id], enabled: user?.role === 'student', queryFn: async () => (await api.get('/favorites/ids')).data.data, staleTime: 30_000, retry: false })
}

export function distanceLabel(distance, campus) {
  if (distance?.meters == null) return 'Campus distance unavailable'
  const length = distance.meters < 1000 ? `${distance.meters} m` : `${(distance.meters / 1000).toFixed(2)} km`
  return `${length} from ${campus?.name || 'campus'} · approximate straight-line distance`
}
