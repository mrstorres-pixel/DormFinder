import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const check = expect.configure({ timeout: 15_000 })

test('profile photos upload privately, survive a new session and can be removed', async ({ page, browser, baseURL }, testInfo) => {
  test.skip(!process.env.E2E_DEMO_MANIFEST, 'Uses the designated synthetic student account.')
  test.setTimeout(120_000)
  const environment = baseURL.startsWith('https:') ? 'cloud' : 'local'
  const fixtures = JSON.parse(await readFile(new URL(`../../.secrets/discovery-browser-${environment}-${testInfo.project.name}.json`, import.meta.url), 'utf8'))
  const account = fixtures.student
  expect(account.email).toMatch(/@example\.test$/)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/login')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await check(page).toHaveURL(/\/account$/)
  await check(page.getByRole('heading', { name: 'Your space', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Edit profile' }).click()
  await check(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
  const initial = await page.evaluate(async () => (await (await fetch('/api/v1/me/avatar')).json()).data)
  test.skip(initial.has_avatar, 'Preserve an existing profile photo; do not overwrite it for acceptance.')
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1100; const draw = canvas.getContext('2d'); draw.fillStyle = '#b9cef9'; draw.fillRect(0, 0, 900, 1100); draw.fillStyle = '#2558e5'; draw.fillRect(200, 200, 500, 700); return canvas.toDataURL('image/png').split(',')[1] })
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  const uploaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/me/avatar') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Save photo' }).click()
  const response = await uploaded
  expect(response.status()).toBe(200)
  const avatarUrl = (await response.json()).data.avatar_url
  try {
    await check(page.getByRole('status')).toHaveText('Profile photo saved.')
    await expect.poll(() => page.locator('.profile-photo-controls img').evaluate(image => image.naturalHeight)).toBe(512)
    const ownRead = await page.evaluate(async url => { const response = await fetch(url); return { status: response.status, type: response.headers.get('content-type'), cache: response.headers.get('cache-control') } }, avatarUrl)
    expect(ownRead.status).toBe(200)
    expect(ownRead.type).toContain('image/jpeg')
    expect(ownRead.cache).toContain('no-store')
    const outsider = await browser.newContext({ baseURL })
    try { expect((await outsider.request.get(avatarUrl)).status()).toBe(401) } finally { await outsider.close() }
    await page.locator('.account-menu > summary').click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await check(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await page.getByLabel('Email address').fill(account.email)
    await page.getByLabel('Password', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await check(page).toHaveURL(/\/account$/)
    await check(page.getByRole('heading', { name: 'Your space', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Edit profile' }).click()
    await check(page).toHaveURL(/\/profile$/)
    await check(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
    await check(page.getByRole('button', { name: 'Remove photo' })).toBeVisible()
    await expect.poll(() => page.locator('.profile-photo-controls img').evaluate(image => image.naturalHeight)).toBe(512)
    await page.getByRole('button', { name: 'Remove photo' }).click()
    await check(page.getByRole('status')).toHaveText('Profile photo removed.')
    expect(await page.evaluate(async url => (await fetch(url)).headers.get('content-type'), avatarUrl)).toContain('image/svg+xml')
    expect(errors).toEqual([])
  } finally {
    await page.evaluate(async () => { const csrf = await fetch('/sanctum/csrf-cookie'); if (!csrf.ok) return; const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN=')); if (cookie) await fetch('/api/v1/me/avatar', { method: 'DELETE', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) } }) })
  }
})
