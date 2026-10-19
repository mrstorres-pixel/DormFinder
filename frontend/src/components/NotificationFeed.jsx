import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { ErrorNotice, Loading } from './Feedback'

export default function NotificationFeed({ userId, compact = false }) {
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['notifications', userId, page], queryFn: async () => (await api.get('/notifications', { params: { page } })).data, enabled: !!userId, staleTime: 15_000, refetchInterval: 45_000, refetchIntervalInBackground: false, retry: false })
  const mutation = useMutation({ mutationFn: id => writeApi('put', '/notifications/' + id + '/read'), onSuccess: async () => { await Promise.all(['notifications', 'notification-unread', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key] }))) } })
  const rows = query.data?.data || []
  const last = query.data?.meta?.last_page ?? query.data?.last_page ?? 1
  return <div className="notification-feed">
    <div className="notification-feed-scroll" aria-busy={query.isFetching}>
      <ErrorNotice error={mutation.error} />
      {query.isPending ? <div className="notification-feed-state"><Loading>Loading notifications…</Loading></div> : query.error ? <div className="notification-feed-state"><ErrorNotice error={query.error} retry={() => query.refetch()} /></div> : rows.length ? <ul className="notification-items">{(compact ? rows.slice(0, 5) : rows).map(row => <li key={row.id} className={'notification-item' + (!row.read_at ? ' is-unread' : '')}>
        <span className="notification-item-indicator" aria-hidden="true" />
        <div className="notification-item-content"><Link className="notification-title" to={row.path}>{row.title}</Link><div className="notification-item-meta"><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time><span>{row.read_at ? 'Read' : 'Unread'}</span></div></div>
        {!row.read_at && <button type="button" className="notification-mark-read" aria-label={'Mark notification #' + row.id + ' read'} title="Mark as read" disabled={mutation.isPending} onClick={() => mutation.mutate(row.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></button>}
      </li>)}</ul> : <div className="notification-feed-state"><strong>You’re all caught up</strong><p>No notifications yet.</p></div>}
    </div>
    {!compact && last > 1 && <nav className="notification-pagination" aria-label="Notification pages"><button type="button" className="btn btn-outline-primary btn-sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {last}</span><button type="button" className="btn btn-outline-primary btn-sm" disabled={page >= last || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
  </div>
}
