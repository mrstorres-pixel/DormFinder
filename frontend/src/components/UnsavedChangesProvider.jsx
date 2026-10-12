import { useEffect, useMemo, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { UnsavedChangesContext } from '../lib/unsavedChangesContext'

export default function UnsavedChangesProvider({ children }) {
  const dirtyForms = useRef(new Set())
  const dialog = useRef(null)
  const guard = useMemo(() => ({
    setDirty(id, dirty) {
      if (dirty) dirtyForms.current.add(id)
      else dirtyForms.current.delete(id)
    },
    requireSaved(except) {
      if ([...dirtyForms.current].some(id => id !== except)) {
        window.alert('Save or clear your other unsaved edits before this action. Your changes have been kept.')
        return false
      }
      return true
    },
    clearAll() { dirtyForms.current.clear() },
    confirmDiscard() {
      if (dirtyForms.current.size && !window.confirm('Discard your unsaved changes and sign out?')) return false
      return true
    },
  }), [])
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirtyForms.current.size > 0 && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  useEffect(() => {
    function unload(event) {
      if (!dirtyForms.current.size) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [])
  useEffect(() => {
    if (blocker.state === 'blocked') dialog.current?.showModal()
    else dialog.current?.close()
  }, [blocker.state])
  return <UnsavedChangesContext.Provider value={guard}>
    {children}
    <dialog ref={dialog} className="unsaved-dialog" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" onCancel={event => { event.preventDefault(); blocker.reset?.() }}>
      <h2 id="unsaved-title">Keep your changes?</h2>
      <p id="unsaved-description">You have unsaved changes. Stay to save them, or leave and discard them.</p>
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary" autoFocus onClick={() => blocker.reset?.()}>Stay and edit</button>
        <button type="button" className="btn btn-outline-danger" onClick={() => { dirtyForms.current.clear(); blocker.proceed?.() }}>Discard and leave</button>
      </div>
    </dialog>
  </UnsavedChangesContext.Provider>
}
