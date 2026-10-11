import { useEffect } from 'react'

export default function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return
    function unload(event) { event.preventDefault(); event.returnValue = '' }
    function navigate(event) {
      const link = event.target.closest('a[href]')
      if (!link || link.target === '_blank' || link.getAttribute('href').startsWith('#')) return
      if (!window.confirm('Leave this page? Your unsaved changes will be lost.')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true) }
  }, [dirty])
}
