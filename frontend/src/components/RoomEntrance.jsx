import { useEffect, useRef } from 'react'
import { roomJourney } from '../lib/roomJourney'
import '../room-entrance.css'

export default function RoomEntrance() {
  const section = useRef(null)
  const stage = useRef(null)
  const canvas = useRef(null)

  useEffect(() => {
    const root = section.current
    const frame = stage.current
    const surface = canvas.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = window.matchMedia('(max-width: 767px)')
    let disposed = false, visible = false, pending = 0, generation = 0
    let scene = null, loading = false, failed = false
    let sizeChanged = true, lastProgress = -1

    function release() { scene?.dispose(); scene = null; surface.hidden = true }
    function fallback() {
      generation++; loading = false; failed = true; release()
      root.dataset.mode = 'static'
      root.dataset.ready = 'false'
      root.style.setProperty('--intro-opacity', '1')
      root.style.setProperty('--ending-opacity', '0')
    }
    async function load() {
      if (scene || loading || failed || reduced.matches || disposed) return
      loading = true
      const ticket = ++generation
      try {
        const { createDormRoom } = await import('../lib/dormRoom')
        if (disposed || ticket !== generation || reduced.matches) return
        scene = createDormRoom(surface)
        loading = false; sizeChanged = true; lastProgress = -1
        root.dataset.mode = 'animated'
        schedule()
      } catch { if (!disposed && ticket === generation) fallback() }
    }
    function render() {
      pending = 0
      if (disposed || !visible || document.hidden || reduced.matches || failed) return
      if (!scene) { load(); return }
      const bounds = root.getBoundingClientRect()
      const distance = Math.max(1, root.offsetHeight - frame.clientHeight)
      const state = roomJourney(-bounds.top / distance)
      if (lastProgress === state.progress && !sizeChanged) return
      try {
        if (sizeChanged) scene.resize(frame.clientWidth, frame.clientHeight, mobile.matches)
        scene.render(state, mobile.matches)
        surface.hidden = false
        root.dataset.ready = 'true'
        root.style.setProperty('--intro-opacity', String(state.intro))
        root.style.setProperty('--ending-opacity', String(state.ending))
        root.style.setProperty('--journey-progress', String(state.progress))
        lastProgress = state.progress; sizeChanged = false
      } catch { fallback() }
    }
    function schedule() { if (!pending && visible && !document.hidden && !disposed) pending = requestAnimationFrame(render) }
    function preference() {
      generation++; loading = false; release(); lastProgress = -1
      root.dataset.ready = 'false'
      root.dataset.mode = reduced.matches || failed ? 'static' : 'loading'
      root.style.setProperty('--intro-opacity', '1'); root.style.setProperty('--ending-opacity', '0')
      if (pending) cancelAnimationFrame(pending)
      pending = 0
      schedule()
    }
    function resize() { sizeChanged = true; schedule() }
    function visibility() {
      if (document.hidden && pending) { cancelAnimationFrame(pending); pending = 0 }
      else schedule()
    }
    function contextLost(event) { event.preventDefault(); fallback() }
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      if (!visible && pending) { cancelAnimationFrame(pending); pending = 0 }
      if (visible) schedule()
    })
    const sizing = new ResizeObserver(resize)
    observer.observe(root); sizing.observe(frame)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    reduced.addEventListener('change', preference)
    mobile.addEventListener('change', resize)
    surface.addEventListener('webglcontextlost', contextLost)
    preference()
    return () => {
      disposed = true; generation++; cancelAnimationFrame(pending)
      observer.disconnect(); sizing.disconnect()
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
      reduced.removeEventListener('change', preference); mobile.removeEventListener('change', resize)
      surface.removeEventListener('webglcontextlost', contextLost)
      release()
    }
  }, [])

  function findHousing(event) {
    const destination = document.getElementById('find-housing')
    if (!destination) return
    event.preventDefault()
    destination.scrollIntoView({ behavior: 'instant', block: 'start' })
    const input = destination.querySelector('input[role="combobox"]')
    ;(input || destination).focus({ preventScroll: true })
  }

  return <section ref={section} className="room-entrance" data-mode="loading" aria-label="Welcome to DormFinder">
    <div ref={stage} className="room-stage">
      <img className="room-poster" src="/dorm-room.svg" alt="" aria-hidden="true" fetchPriority="high" />
      <canvas ref={canvas} className="room-canvas" aria-hidden="true" hidden />
      <div className="room-scrim" aria-hidden="true" />
      <div className="room-intro"><span className="eyebrow">A LITTLE CLOSER TO CAMPUS</span><h1>Your next place,<br /><em>closer to campus.</em></h1><p>A little space to study.<br />A little room to be you.</p></div>
      <div className="room-ending" aria-hidden="true"><span className="eyebrow">A PLACE TO MAKE YOUR OWN</span><p>Make room for<br /><em>your next chapter.</em></p></div>
      <a className="room-search-link" href="#find-housing" onClick={findHousing}>Find housing <span aria-hidden="true">↗</span></a>
      <div className="room-bottom"><span className="room-scroll-cue"><span aria-hidden="true">↓</span> Scroll to step inside</span><span className="room-art-label">An imagined space. Your real search starts below.</span></div>
      <div className="room-progress" aria-hidden="true"><span /></div>
    </div>
  </section>
}
