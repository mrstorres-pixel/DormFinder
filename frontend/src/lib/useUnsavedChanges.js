import { useCallback, useContext, useEffect, useId, useMemo } from 'react'
import { UnsavedChangesContext } from './unsavedChangesContext'

export function useDiscardChanges() {
  return useContext(UnsavedChangesContext).confirmDiscard
}

export function useClearUnsavedChanges() {
  return useContext(UnsavedChangesContext).clearAll
}

export function useFormChanges(dirty) {
  const guard = useContext(UnsavedChangesContext)
  const id = useId()
  useEffect(() => {
    guard.setDirty(id, dirty)
    return () => guard.setDirty(id, false)
  }, [guard, id, dirty])
  const clear = useCallback(() => guard.setDirty(id, false), [guard, id])
  return useMemo(() => ({ clear, canReplaceOthers: () => guard.requireSaved(id) }), [clear, guard, id])
}

export default function useUnsavedChanges(dirty) {
  return useFormChanges(dirty).clear
}

export function useRequireSavedChanges() {
  return useContext(UnsavedChangesContext).requireSaved
}
