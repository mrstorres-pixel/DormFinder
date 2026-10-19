import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import ActionDialog from './ActionDialog'
import NotificationFeed from './NotificationFeed'
import './notifications.css'

function NotificationPopover({ id, anchor, onClose, onExpand, userId }) {
  const panel = useRef(null)
  const closeButton = useRef(null)
  useLayoutEffect(() => {
    const node = panel.current
    function position() {
      const rect = anchor.current.getBoundingClientRect()
      const viewport = window.visualViewport
      const width = viewport?.width || innerWidth
      const height = viewport?.height || innerHeight
      const offsetTop = viewport?.offsetTop || 0
      const headerBottom = anchor.current.closest('.site-header')?.getBoundingClientRect().bottom || 0
      const top = Math.max(offsetTop + 8, rect.bottom + 10, headerBottom + 8)
      node.style.setProperty('--notification-right', Math.max(12, width - rect.right) + 'px')
      node.style.top = top + 'px'
      node.style.maxHeight = Math.max(120, height + offsetTop - top - 16) + 'px'
    }
    function outside(event) {
      if (!node.contains(event.target) && !anchor.current.contains(event.target)) onClose(false)
    }
    function escape(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(true) }
    }
    position()
    closeButton.current.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    node.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      node.removeEventListener('keydown', escape)
    }
  }, [anchor, onClose])
  return createPortal(<section ref={panel} id={id} className="notification-popover" role="dialog" aria-labelledby={id + '-title'}>
    <header className="notification-panel-header"><h2 id={id + '-title'}>Notifications</h2><button ref={closeButton} type="button" className="action-close" aria-label="Close notifications" onClick={() => onClose(true)}>×</button></header>
    <NotificationFeed userId={userId} compact />
    <footer className="notification-panel-footer"><button type="button" className="notification-expand" onClick={onExpand}>Expand notifications <span aria-hidden="true">↗</span></button></footer>
  </section>, document.body)
}

export default function NotificationBell({ userId, onOpen }) {
  const location = useLocation()
  const [view, setView] = useState({ key: location.key, mode: location.state?.notifications === 'expanded' ? 'expanded' : 'closed' })
  const mode = view.key === location.key ? view.mode : location.state?.notifications === 'expanded' ? 'expanded' : 'closed'
  const anchor = useRef(null)
  const id = useId()
  const close = useCallback(restoreFocus => { setView({ key: location.key, mode: 'closed' }); if (restoreFocus) anchor.current?.focus({ preventScroll: true }) }, [location.key])
  const query = useQuery({ queryKey: ['notification-unread', userId], queryFn: async () => (await api.get('/notifications/unread-count')).data.data, enabled: !!userId, staleTime: 15_000, refetchInterval: 45_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false })
  const unread = Number.isSafeInteger(query.data?.unread_count) ? query.data.unread_count : null
  const label = query.error ? 'Notifications — unread status unavailable' : unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'
  return <><button ref={anchor} type="button" className={'notification-bell' + (mode !== 'closed' ? ' is-current' : '')} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={mode !== 'closed'} aria-controls={mode === 'compact' ? id : undefined} onClick={() => { onOpen?.(); setView({ key: location.key, mode: mode === 'closed' ? 'compact' : 'closed' }) }}>
    <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
    {unread > 0 && <span className="notification-unread-dot" aria-hidden="true" />}
  </button>
    {mode === 'compact' && <NotificationPopover id={id} anchor={anchor} onClose={close} onExpand={() => setView({ key: location.key, mode: 'expanded' })} userId={userId} />}
    {mode === 'expanded' && <ActionDialog open title="Notifications" className="notifications-expanded" onClose={() => close(true)} returnFocus={anchor} dismissOnBackdrop><NotificationFeed userId={userId} /></ActionDialog>}
  </>
}
