import { useCallback, useContext, useEffect, useId } from 'react'
import { UnsavedChangesContext } from './unsavedChangesContext'

export function useDiscardChanges() {
  return useContext(UnsavedChangesContext).confirmDiscard
}

export function useClearUnsavedChanges() {
  return useContext(UnsavedChangesContext).clearAll
}

export default function useUnsavedChanges(dirty) {
  const guard = useContext(UnsavedChangesContext)
  const id = useId()
  useEffect(() => {
    guard.setDirty(id, dirty)
    return () => guard.setDirty(id, false)
  }, [guard, id, dirty])
  return useCallback(() => guard.setDirty(id, false), [guard, id])
}
