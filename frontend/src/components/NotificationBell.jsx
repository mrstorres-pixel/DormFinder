import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export default function NotificationBell({ userId, onOpen }) {
  const query = useQuery({ queryKey: ['notification-unread', userId], queryFn: async () => (await api.get('/notifications/unread-count')).data.data, enabled: !!userId, staleTime: 15_000, refetchInterval: 45_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false })
  const unread = Number.isSafeInteger(query.data?.unread_count) ? query.data.unread_count : null
  const label = query.error ? 'Notifications — unread status unavailable' : unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'
  return <NavLink to="/notifications" className={({ isActive }) => 'notification-bell' + (isActive ? ' is-current' : '')} aria-label={label} title={label} onClick={onOpen}>
    <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
    {unread > 0 && <span className="notification-unread-dot" aria-hidden="true" />}
  </NavLink>
}
