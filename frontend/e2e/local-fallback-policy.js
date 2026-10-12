export async function applyLocalFallbackPolicy(context, baseURL) {
  if (process.env.E2E_LOCAL_ONLY !== '1') return
  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
  if (!localHosts.has(new URL(baseURL).hostname)) throw new Error('Local-only rehearsal refuses a cloud base URL.')
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return localHosts.has(url.hostname) ? route.continue() : route.abort('internetdisconnected')
  })
}
