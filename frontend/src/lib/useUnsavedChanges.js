import { useCallback, useContext, useId, useLayoutEffect, useMemo, useRef } from 'react'
import { UnsavedChangesContext } from './unsavedChangesContext'

export function useDiscardChanges() {
  return useContext(UnsavedChangesContext).confirmDiscard
}

export function useClearUnsavedChanges() {
  return useContext(UnsavedChangesContext).clearAll
}

export function useFormChanges(dirty, save) {
  const guard = useContext(UnsavedChangesContext)
  const id = useId()
  const saveRef = useRef(save)
  const canSave = typeof save === 'function'
  useLayoutEffect(() => { saveRef.current = save })
  useLayoutEffect(() => {
    guard.setDirty(id, dirty, canSave ? () => saveRef.current() : null)
    return () => guard.setDirty(id, false)
  }, [guard, id, dirty, canSave])
  const clear = useCallback(() => guard.setDirty(id, false), [guard, id])
  return useMemo(() => ({ clear, canReplaceOthers: () => guard.requireSaved(id) }), [clear, guard, id])
}

export default function useUnsavedChanges(dirty, save) {
  return useFormChanges(dirty, save).clear
}

export function useRequireSavedChanges() {
  return useContext(UnsavedChangesContext).requireSaved
}
