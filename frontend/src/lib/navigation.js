export function safeReturnTo(value, fallback = '/account') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(char => char.charCodeAt(0) <= 32)) return fallback
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || /^\/(login|register)(\/|$)/.test(url.pathname)) return fallback
    return url.pathname + url.search + url.hash
  } catch { return fallback }
}

export function signInLink(destination) {
  return '/login?returnTo=' + encodeURIComponent(destination)
}

export function clearInquiryDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('dormfinder-inquiry-')) sessionStorage.removeItem(key)
  } catch { /* Storage is optional. */ }
}
