import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) throw new Error('Local fallback verification refuses a cloud base URL.')
const environment = await readFile(resolve(root, '../backend/.env'), 'utf8')
for (const required of [/^DB_HOST=127\.0\.0\.1\r?$/m, /^DB_PORT=54329\r?$/m, /^DB_DATABASE=dormfinder\r?$/m, /^FILESYSTEM_DISK=local\r?$/m]) {
  if (!required.test(environment)) throw new Error('Configure the local database and private local storage before fallback verification; no environment files were changed.')
}
const manifest = process.env.E2E_DEMO_MANIFEST || '../.secrets/demo-listings-local.json'
const admin = process.env.E2E_ADMIN_FILE || '../.secrets/phase2-e2e-admin.json'
await Promise.all([access(resolve(root, manifest)), access(resolve(root, admin))])
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'e2e/local-fallback.spec.js', 'e2e/phase-two.spec.js', 'e2e/demo-listings.spec.js', ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', env: { ...process.env, E2E_BASE_URL: baseURL, E2E_LOCAL_ONLY: '1', E2E_DEMO_MANIFEST: manifest, E2E_ADMIN_FILE: admin },
})
if (result.error) throw new Error('Could not start installed Playwright; preinstall the local dependencies before the offline rehearsal.')
process.exitCode = result.status ?? 1
