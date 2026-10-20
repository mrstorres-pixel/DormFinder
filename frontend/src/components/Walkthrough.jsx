import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { coachPosition, spotlightBounds, walkthroughSteps } from '../lib/walkthrough'
import './walkthrough.css'

const focusable = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
const visible = node => node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
function findTarget(selectors) {
  for (const selector of selectors) for (const node of document.querySelectorAll(selector)) if (visible(node)) return node
  return null
}

function TourIllustration({ done = false }) {
  return <svg className="tour-illustration" aria-hidden="true" viewBox="0 0 260 140" fill="none"><ellipse cx="130" cy="128" rx="102" ry="9" fill="#c7d7eb" /><path d="M27 115h206" stroke="#7f9ab9" strokeWidth="2" /><path d="M43 114V42l44-24 45 24v72" fill="#d0ddf3" stroke="#5979ae" strokeWidth="2" strokeLinejoin="round" /><path d="M34 45 87 14l54 31" stroke="#2558e5" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><rect x="70" y="73" width="34" height="41" rx="3" fill="#2558e5" /><rect x="57" y="48" width="19" height="15" rx="3" fill="#f8f1de" /><rect x="98" y="48" width="19" height="15" rx="3" fill="#f8f1de" /><path d="M149 114V56h54v58" fill="#e8dfc9" stroke="#a28b64" strokeWidth="2" /><path d="M145 56h62" stroke="#b59d75" strokeWidth="5" strokeLinecap="round" /><path d="M160 71h10m16 0h7m-33 15h10m16 0h7" stroke="#f9f4e9" strokeWidth="8" /><path d="M112 120c19-25 45-19 62-35" stroke="#2b7c73" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 7" /><circle cx="189" cy="37" r="25" fill={done ? '#d6ebe3' : '#dbe5fb'} stroke={done ? '#519580' : '#7394d8'} strokeWidth="2" />{done ? <path d="m178 37 8 8 14-17" stroke="#2b7c63" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : <><path d="m174 34 15-8 15 8-15 8-15-8Z" fill="#2558e5" /><path d="M181 39v8c6 4 11 4 17 0v-8" stroke="#2558e5" strokeWidth="2" /></>}<path d="m28 65 2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#bc9c58" /><circle cx="228" cy="78" r="4" fill="#7da69d" /></svg>
}

export default function Walkthrough({ user, state, onBegin, onNext, onBack, onClose, onRestart, onFinish }) {
  const location = useLocation()
  const navigate = useNavigate()
  const steps = useMemo(() => walkthroughSteps(user.role, state.context), [user.role, state.context])
  const step = steps[state.index] || steps[0]
  const active = state.status === 'active'
  const card = useRef(null), heading = useRef(null), requested = useRef('')
  const id = useId()
  const [geometry, setGeometry] = useState({ rect: null, target: null, host: document.body, width: innerWidth, height: innerHeight, size: { height: 330 }, suspended: false })
  const [waiting, setWaiting] = useState(false)
  const context = useQuery({ queryKey: ['walkthrough-context', user.id, user.role], enabled: state.status === 'intro', staleTime: 120_000, retry: false, queryFn: async ({ signal }) => {
    if (user.role === 'student') {
      const rows = (await api.get('/listings', { signal })).data.data
      return { listingPath: /^\/listings\/\d+$/.test(location.pathname) ? location.pathname : rows[0] ? '/listings/' + rows[0].id : null }
    }
    if (user.role === 'landlord') {
      const rows = (await api.get('/landlord/properties', { params: { view: 'active', page: 1 }, signal })).data.data
      const property = rows.find(item => item.status === 'approved') || rows.find(item => ['draft', 'rejected'].includes(item.status))
      return { propertyPath: property ? '/landlord/properties/' + property.id : null, propertyStatus: property?.status }
    }
    return {}
  } })
  useEffect(() => {
    if (!active || !step.path) return
    const key = state.run + ':' + state.index + ':' + step.path
    if (requested.current === key) return
    requested.current = key
    const next = new URL(step.path, window.location.origin)
    if (next.pathname !== location.pathname || (next.hash && next.hash !== location.hash)) navigate(step.path)
  }, [active, step.path, state.run, state.index, location.pathname, location.hash, navigate])
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setWaiting(true), 5000)
    return () => { clearTimeout(timer); setWaiting(false) }
  }, [active, step.key])
  useLayoutEffect(() => {
    let frame = null, scrolled = false, observed = null, viewportKey = ''
    const observer = new ResizeObserver(schedule)
    function measure() {
      frame = null
      const viewport = window.visualViewport
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight
      const nextViewportKey = width + ':' + height
      if (nextViewportKey !== viewportKey) { scrolled = false; viewportKey = nextViewportKey }
      const modal = [...document.querySelectorAll('dialog[open]')].filter(visible).at(-1)
      const suspended = !!modal && (!active || !step.modal)
      const target = active ? modal && step.modal ? modal : findTarget(step.selectors) : null
      if (target && !modal && !scrolled) {
        scrolled = true
        target.scrollIntoView({ block: width < 768 ? 'start' : 'center', inline: 'nearest', behavior: 'instant' })
        if (width < 768 && getComputedStyle(target).position !== 'fixed') window.scrollBy({ top: -20, behavior: 'instant' })
      }
      if (target !== observed) { if (observed) observer.unobserve(observed); observed = target; if (target) observer.observe(target) }
      const rect = target ? spotlightBounds(target.getBoundingClientRect(), { width, height }) : null
      const size = { height: card.current?.getBoundingClientRect().height || 330 }
      const host = modal && step.modal ? modal : document.body
      setGeometry(current => current.target === target && current.host === host && current.width === width && current.height === height && current.size.height === size.height && current.suspended === suspended && JSON.stringify(current.rect) === JSON.stringify(rect) ? current : { rect, target, host, width, height, size, suspended })
    }
    function schedule() { if (frame === null) frame = requestAnimationFrame(measure) }
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] })
    if (card.current) observer.observe(card.current)
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    measure()
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect(); mutations.disconnect()
      window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [active, step.key, step.modal, step.selectors])
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }) }, [state.index, state.status, geometry.host])
  useEffect(() => {
    function keyboard(event) {
      if (geometry.suspended) return
      if (event.key === 'Escape') {
        if (document.querySelector('dialog[open], .notification-popover') && !card.current?.contains(event.target)) return
        event.preventDefault(); event.stopPropagation(); onClose(); return
      }
      if (event.key !== 'Tab') return
      const controls = [...(active && step.interactive !== false && geometry.target ? geometry.target.querySelectorAll(focusable) : []), ...(card.current?.querySelectorAll(focusable) || [])].filter(visible)
      const unique = [...new Set(controls)]
      if (!unique.length) return
      const current = unique.indexOf(document.activeElement)
      const next = current < 0 ? event.shiftKey ? unique.length - 1 : 0 : (current + (event.shiftKey ? -1 : 1) + unique.length) % unique.length
      event.preventDefault(); event.stopPropagation(); unique[next].focus()
    }
    document.addEventListener('keydown', keyboard, true)
    return () => document.removeEventListener('keydown', keyboard, true)
  }, [active, geometry, step.interactive, onClose])
  function change(direction) {
    const nextContext = { ...state.context }
    if (direction > 0 && step.key === 'open-place') {
      const link = document.querySelector('.listing-grid .property-card a[href^="/listings/"]')
      if (link) nextContext.listingPath = new URL(link.href).pathname
    }
    if ((direction > 0 ? onNext(nextContext) : onBack()) === false) return
    const modal = document.querySelector('dialog[open]')
    if (modal && step.modal) modal.querySelector('[aria-label="Close filters"], [aria-label^="Close "]')?.click()
  }
  const viewport = { width: geometry.width, height: geometry.height }
  const rect = active ? geometry.rect : null
  const position = coachPosition(rect, viewport, geometry.size)
  const complete = state.status === 'complete'
  const student = user.role === 'student', landlord = user.role === 'landlord'
  const title = active ? step.title : complete ? 'You know your way around.' : student ? 'A little tour. A better first search.' : landlord ? 'Let’s make room for your listing.' : 'Get to know your review workspace.'
  const blocks = rect ? [{ left: 0, top: 0, width: viewport.width, height: rect.top }, { left: 0, top: rect.bottom, width: viewport.width, height: Math.max(0, viewport.height - rect.bottom) }, { left: 0, top: rect.top, width: rect.left, height: rect.height }, { left: rect.right, top: rect.top, width: Math.max(0, viewport.width - rect.right), height: rect.height }] : [{ left: 0, top: 0, width: viewport.width, height: viewport.height }]
  if (geometry.suspended) return null
  return createPortal(<div className="walkthrough-layer" data-walkthrough-step={active ? step.key : state.status}>
    <div aria-hidden="true">{blocks.map((block, index) => <div className="walkthrough-shade" key={index} style={block} />)}{rect && <><div className="walkthrough-spotlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />{step.interactive === false && <div className="walkthrough-target-lock" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />}</>}</div>
    <section ref={card} className={'walkthrough-coach' + (!active ? ' is-introduction' : '')} role="dialog" aria-modal={!active} aria-labelledby={id + '-title'} aria-describedby={id + '-description'} style={{ left: position.left, top: position.top, width: position.width, maxHeight: viewport.height - 32 }} data-placement={position.placement}>
      <header><span className="walkthrough-eyebrow">{active ? `${student ? 'STUDENT' : landlord ? 'PROPERTY OWNER' : 'ADMIN'} WALKTHROUGH` : complete ? 'ALL SET' : 'WELCOME TO DORMFINDER'}</span><button type="button" className="walkthrough-close" aria-label="Pause walkthrough" onClick={onClose}>×</button></header>
      {!active && <TourIllustration done={complete} />}
      {active && <div className="walkthrough-progress" aria-label={`Step ${state.index + 1} of ${steps.length}`}><span style={{ width: ((state.index + 1) / steps.length * 100) + '%' }} /></div>}
      <h2 ref={heading} id={id + '-title'} tabIndex={-1}>{title}</h2>
      <p id={id + '-description'}>{active ? step.body : complete ? 'Your next step is yours. You can replay this walkthrough from the help button whenever you need a hand.' : 'Follow the highlights through the real screens, one step at a time. Go back, pause or resume whenever you like.'}</p>
      {active && !rect && <p className="walkthrough-loading" role="status">{waiting ? 'This part is unavailable right now. You can continue, go back, or pause and return later.' : 'Finding this part of your workspace…'}</p>}
      {!active && !complete && context.error && <p className="walkthrough-loading">Some listing details could not load. You can still tour the main screens. <button type="button" onClick={() => context.refetch()}>Try again</button></p>}
      <footer>{active ? <><span className="walkthrough-count">{String(state.index + 1).padStart(2, '0')} <span>/ {String(steps.length).padStart(2, '0')}</span></span><div><button type="button" className="walkthrough-back" disabled={state.index === 0} onClick={() => change(-1)}>Back</button><button type="button" className="btn btn-primary" onClick={() => change(1)}>{state.index === steps.length - 1 ? 'Finish tour' : 'Next'} <span aria-hidden="true">→</span></button></div></> : complete ? <button type="button" className="btn btn-primary" onClick={onFinish}>{student ? 'Start exploring' : landlord ? 'Go to my properties' : 'Go to reviews'} <span aria-hidden="true">→</span></button> : <><button type="button" className="walkthrough-back" onClick={onClose}>Maybe later</button><button type="button" className="btn btn-primary" disabled={context.isPending} onClick={() => onBegin(context.data || {})}>{context.isPending ? 'Preparing…' : 'Start walkthrough'} <span aria-hidden="true">→</span></button></>}</footer>
      {active && <div className="walkthrough-bottom"><span>You can pause and pick this up later.</span><button type="button" onClick={onRestart}>Restart</button></div>}
    </section>
  </div>, geometry.host?.isConnected ? geometry.host : document.body)
}
