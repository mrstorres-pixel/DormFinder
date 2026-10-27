import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export function useDirectoryBrowse(key, path, defaultSort = 'newest', defaults = {}) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = useQuery({ queryKey: [key, params.toString()], queryFn: async () => (await api.get(path, { params: { ...defaults, ...Object.fromEntries(params), sort: params.get('sort') || defaultSort, per_page: params.get('per_page') || 12 } })).data, retry: false })
  return { params, page, query, defaultSort,
    apply: values => setParams(Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== 'page' && String(value).trim() !== '').map(([key, value]) => [key, String(value).trim()]))),
    clear: () => setParams({}),
    update: values => setParams(current => { const next = new URLSearchParams(current); next.delete('page'); for (const [key, value] of Object.entries(values)) { if (String(value).trim()) next.set(key, String(value).trim()); else next.delete(key) } return next }),
    setPage: page => setParams(current => { const next = new URLSearchParams(current); if (page <= 1) next.delete('page'); else next.set('page', String(page)); return next }),
  }
}

export const useAdminBrowse = useDirectoryBrowse

export const adminDate = value => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value)) : '—'
export const adminLabel = value => value === 'pending_review' ? 'Awaiting review' : String(value || '').replaceAll('_', ' ')
