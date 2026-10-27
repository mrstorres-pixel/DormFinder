import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { UnsavedChangesContext } from '../lib/unsavedChangesContext'

export default function UnsavedChangesProvider({ children }) {
  const dirtyForms = useRef(new Set())
  const savers = useRef(new Map())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [navigationSave, setNavigationSave] = useState(null)
  const [multipleForms, setMultipleForms] = useState(false)
  const dialog = useRef(null)
  const guard = useMemo(() => ({
    setDirty(id, dirty, save) {
      if (dirty) dirtyForms.current.add(id)
      else dirtyForms.current.delete(id)
      if (dirty && save) savers.current.set(id, save)
      else savers.current.delete(id)
    },
    requireSaved(except) {
      if ([...dirtyForms.current].some(id => id !== except)) {
        window.alert('Save or clear your other unsaved edits before this action. Your changes have been kept.')
        return false
      }
      return true
    },
    clearAll() { dirtyForms.current.clear(); savers.current.clear() },
    confirmDiscard() {
      if (dirtyForms.current.size && !window.confirm('Discard your unsaved changes and sign out?')) return false
      return true
    },
  }), [])
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const blocked = dirtyForms.current.size > 0 && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
    if (blocked) {
      const handler = dirtyForms.current.size === 1 ? savers.current.get([...dirtyForms.current][0]) : null
      setNavigationSave(() => handler || null); setMultipleForms(dirtyForms.current.size > 1); setSaveError('')
    }
    return blocked
  })
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
  async function saveAndLeave() {
    if (!navigationSave || saving) return
    setSaving(true); setSaveError('')
    try {
      if (await navigationSave()) { dirtyForms.current.clear(); savers.current.clear(); blocker.proceed?.() }
      else setSaveError('Your changes could not be saved. Keep editing to check the highlighted fields. Your edits are still here.')
    } catch { setSaveError('Your changes could not be saved. Your edits are kept here. Try again, or keep editing to review the error.') }
    finally { setSaving(false) }
  }
  return <UnsavedChangesContext.Provider value={guard}>
    {children}
    <dialog ref={dialog} className="unsaved-dialog" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" onCancel={event => { event.preventDefault(); if (!saving) { setSaveError(''); blocker.reset?.() } }}>
      <h2 id="unsaved-title">Keep your changes?</h2>
      <p id="unsaved-description">{navigationSave ? 'Save your changes before leaving this page, or discard them.' : multipleForms ? 'Several forms have changes. Save or finish each form on this page before leaving.' : 'You have unsaved changes. Stay to save them, or leave and discard them.'}</p>
      {saveError && <p role="alert" className="text-danger">{saveError}</p>}
      <div className="d-flex gap-2 flex-wrap">
        {navigationSave && <button type="button" className="btn btn-primary" disabled={saving} onClick={saveAndLeave}>{saving ? 'Saving…' : 'Save and leave'}</button>}
        <button type="button" className={navigationSave ? 'btn btn-outline-primary' : 'btn btn-primary'} autoFocus disabled={saving} onClick={() => { setSaveError(''); blocker.reset?.() }}>Stay and edit</button>
        <button type="button" className="btn btn-outline-danger" disabled={saving} onClick={() => { dirtyForms.current.clear(); savers.current.clear(); setSaveError(''); blocker.proceed?.() }}>Discard and leave</button>
      </div>
    </dialog>
  </UnsavedChangesContext.Provider>
}
