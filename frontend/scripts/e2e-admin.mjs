import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = new URL('../../', import.meta.url)
const directory = new URL('.secrets/', root)
const fixtureFile = new URL('phase2-e2e-admin.json', directory)
const passwordFile = new URL('phase2-e2e-admin-password', directory)
try {
  await readFile(fixtureFile)
  console.log('Existing private browser-test administrator fixture preserved.')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  await mkdir(directory, { recursive: true })
  const fixture = { email: `phase2-review-${randomUUID()}@example.test`, password: 'Synthetic-8-' + randomBytes(32).toString('base64url') }
  await writeFile(passwordFile, fixture.password, { mode: 0o600, flag: 'wx' })
  const result = spawnSync(process.env.E2E_PHP_BINARY || 'php', ['artisan', 'dormfinder:admin', fixture.email, '--name=Synthetic Phase 2 Review Administrator', '--password-file=' + fileURLToPath(passwordFile), '--no-interaction'], { cwd: fileURLToPath(new URL('backend/', root)), encoding: 'utf8' })
  if (result.status !== 0) throw new Error('Controlled synthetic administrator provisioning failed; private password file was preserved. Check local setup without printing credentials.')
  await writeFile(fixtureFile, JSON.stringify(fixture), { mode: 0o600, flag: 'wx' })
  console.log('Synthetic browser-test administrator created; credentials remain in ignored private files.')
}
