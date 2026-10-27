import { api } from './api'

export async function lookupAddress(path, params, signal) {
  try { return await api.get(path, { params, signal }) }
  catch (error) {
    if (error.response?.status !== 429 || signal.aborted) throw error
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 2000)
      signal.addEventListener('abort', abort, { once: true })
    })
    return api.get(path, { params, signal })
  }
}
