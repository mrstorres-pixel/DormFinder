import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await api.get('/me')).data.data
      } catch (error) {
        if (error.response?.status === 401) return null
        throw error
      }
    },
    retry: false,
    staleTime: 30_000,
  })
}

