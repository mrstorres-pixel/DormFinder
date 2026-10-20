import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { useRequireSavedChanges } from '../lib/useUnsavedChanges'
import { WalkthroughContext } from '../lib/walkthroughContext'
import { readWalkthrough, walkthroughHome, walkthroughKey, walkthroughSteps } from '../lib/walkthrough'

const Walkthrough = lazy(() => import('./Walkthrough'))

export default function WalkthroughProvider({ children }) {
  const { data: user } = useCurrentUser()
  const location = useLocation()
  const navigate = useNavigate()
  const requireSaved = useRequireSavedChanges()
  const owner = walkthroughKey(user)
  const launcher = useRef(null)
  const restoreFocus = useRef(false)
  const [state, setState] = useState(() => readWalkthrough(owner))
  if (state.owner !== owner) setState(readWalkthrough(owner))
  else if (owner && (location.state?.showGuide || location.state?.startWalkthrough) && state.trigger !== location.key) {
    setState({ owner, status: 'intro', index: 0, context: {}, trigger: location.key, run: (state.run || 0) + 1 })
  } else if (state.status === 'active' && user?.role === 'student' && walkthroughSteps(user.role, state.context)[state.index]?.key === 'open-place' && state.openPlaceFrom !== location.key && /^\/listings\/\d+$/.test(location.pathname)) {
    setState({ ...state, context: { ...state.context, listingPath: location.pathname }, index: state.index + 1 })
  }
  useEffect(() => {
    if (!state.owner || state.status === 'intro') return
    try { window.sessionStorage.setItem(state.owner, JSON.stringify({ ...state, updated: Date.now() })) } catch { /* The tour also works without browser storage. */ }
  }, [state])
  useEffect(() => {
    if (!restoreFocus.current || !['paused', 'done'].includes(state.status)) return
    restoreFocus.current = false
    const frame = requestAnimationFrame(() => {
      const modal = document.querySelector('dialog[open]')
      const element = modal?.querySelector('button, input, select, textarea') || (launcher.current?.isConnected ? launcher.current : document.querySelector('.walkthrough-help'))
      element?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [state.status])
  function start(event) {
    if (!owner || !requireSaved()) return
    launcher.current = event?.currentTarget || document.querySelector('.site-header .walkthrough-help')
    setState(current => current.status === 'paused' && current.started ? { ...current, status: 'active', run: Date.now() } : { owner, status: 'intro', index: 0, context: {}, trigger: current.trigger, run: Date.now() })
  }
  function close(status = 'paused') {
    restoreFocus.current = true
    setState(current => ({ ...current, status }))
  }
  function move(delta, context = state.context) {
    const steps = walkthroughSteps(user.role, context)
    const index = state.index + delta
    if (index >= steps.length) { setState(current => ({ ...current, status: 'complete' })); return true }
    if (index < 0) return false
    const destination = steps[index].path
    if (destination && new URL(destination, window.location.origin).pathname !== location.pathname && !requireSaved()) return false
    setState(current => ({ ...current, context, index, openPlaceFrom: steps[index].key === 'open-place' ? location.key : current.openPlaceFrom }))
    return true
  }
  const active = !!owner && state.owner === owner && ['intro', 'active', 'complete'].includes(state.status)
  return <WalkthroughContext.Provider value={{ start, active, resumable: state.status === 'paused' && !!state.started }}>
    {children}
    {active && <Suspense fallback={null}><Walkthrough user={user} state={state} onBegin={context => setState(current => ({ ...current, context, started: true, status: 'active', index: 0 }))} onNext={context => move(1, context)} onBack={() => move(-1)} onClose={() => close()} onRestart={() => { if (requireSaved()) setState(current => ({ ...current, status: 'intro', index: 0 })) }} onFinish={() => { if (requireSaved()) { close('done'); navigate(walkthroughHome(user.role), { replace: true }) } }} /></Suspense>}
  </WalkthroughContext.Provider>
}
