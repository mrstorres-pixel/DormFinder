import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './appointments.css'

export default function ActionDialog({ open, title, onClose, children, returnFocus }) {
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const node = dialog.current
    const opener = returnFocus?.current || document.activeElement
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    node.showModal()
    return () => { node.close(); root.style.overflow = overflow; requestAnimationFrame(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }) }
  }, [open, returnFocus])
  function keepFocus(event) {
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() }
  }
  return createPortal(<dialog ref={dialog} className="action-dialog" aria-labelledby={titleId} onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 id={titleId}>{title}</h2><button type="button" className="action-close" aria-label={'Close ' + title.toLowerCase()} onClick={onClose}>×</button></header>
    <div className="action-dialog-content">{children}</div>
  </dialog>, document.body)
}
