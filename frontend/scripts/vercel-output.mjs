import { cp, mkdir, writeFile } from 'node:fs/promises'
if (!process.env.BACKEND_ORIGIN) throw new Error('Set BACKEND_ORIGIN to the provisioned Render service before deploying.')
const origin = new URL(process.env.BACKEND_ORIGIN || '')
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.onrender.com') || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error('BACKEND_ORIGIN must be the HTTPS origin of the provisioned Render service.')
}
if (process.env.VERCEL_ENV === 'preview') {
  throw new Error('Preview deployments require a separate backend and database; production previews are disabled.')
}
await mkdir('.vercel/output/static', { recursive: true })
await cp('dist', '.vercel/output/static', { recursive: true })
await writeFile('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [
    { src: '/api/(.*)', dest: origin.origin + '/api/$1', headers: { 'Cache-Control': 'no-store' } },
    { src: '/sanctum/(.*)', dest: origin.origin + '/sanctum/$1', headers: { 'Cache-Control': 'no-store' } },
    { handle: 'filesystem' },
    { src: '/.*', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
  ],
}, null, 2))

