import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('guest API requests consistently return JSON authentication errors', async ({ request }) => {
  for (const accept of ['*/*', 'text/html', 'application/json']) {
    for (const path of ['/me', '/landlord/properties', '/admin/reviews', '/favorites', '/inquiries/1/messages']) {
      const response = await request.get('/api/v1' + path, { headers: { Accept: accept } })
      expect(response.status()).toBe(401)
      expect(response.headers()['content-type']).toContain('application/json')
      expect(response.headers()['cache-control']).toContain('no-store')
      expect(response.headers().location).toBeUndefined()
      const body = await response.json()
      expect(body.code).toBe('unauthenticated')
      expect(body.exception).toBeUndefined()
      expect(body.trace).toBeUndefined()
    }
  }
})

test('same-origin sessions, private drafts, image persistence and logout', async ({ page, context, browser, baseURL }) => {
  const suffix = randomUUID()
  const email = `landlord-${suffix}@example.test`
  const password = `Demo-${randomUUID()}-8`
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/register?role=landlord')
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic Landlord')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  const registration = page.waitForResponse((response) => response.url().includes('/auth/register/landlord') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  const setCookies = (await (await registration).headersArray()).filter((header) => header.name.toLowerCase() === 'set-cookie')
  expect(setCookies.some((header) => header.value.startsWith('dormfinder_session=') && /samesite=lax/i.test(header.value) && /httponly/i.test(header.value))).toBe(true)
  await expect(page.getByRole('heading', { name: 'Your properties', exact: true })).toBeVisible()
  const cookies = await context.cookies()
  const session = cookies.find((cookie) => cookie.name === 'dormfinder_session')
  expect(session?.httpOnly).toBe(true)
  if (baseURL.startsWith('https:')) expect(session?.secure).toBe(true)

  const missingCsrf = await page.evaluate(async () => {
    const response = await fetch('/api/v1/landlord/properties', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Missing token', property_type: 'dormitory', city: 'Manila' }),
    })
    return response.status
  })
  expect(missingCsrf).toBe(419)

  await page.getByRole('link', { name: '+ Add a property' }).click()
  await page.getByLabel('Property name').fill(`Demo Residence ${suffix}`)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/landlord\/properties\/\d+#photos$/)
  const propertyId = new URL(page.url()).pathname.split('/').pop()
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Location & details', exact: true }).click()
  await page.getByLabel('Street address').fill('Synthetic address for testing')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Photos', exact: true }).click()
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 20; canvas.height = 20
    const drawing = canvas.getContext('2d')
    drawing.fillStyle = '#17675b'; drawing.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Choose a photo').setInputFiles({
    name: 'room.png', mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await page.getByLabel('Photo description').fill('Synthetic test image')
  const uploadResponsepage0 = page.waitForResponse(response => response.url().endsWith('/photos') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
    expect((await uploadResponsepage0).status()).toBe(201)
  await expect(page.getByRole('img', { name: 'Synthetic test image' })).toBeVisible()
  await page.reload()
  const image = page.getByRole('img', { name: 'Synthetic test image' })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true)

  const outsider = await browser.newContext({ baseURL })
  const denied = await outsider.request.get(`/api/v1/landlord/properties/${propertyId}`, { headers: { Accept: 'application/json' } })
  expect(denied.status()).toBe(401)
  await outsider.close()

  if (!await page.locator('.account-menu').getAttribute('open').then(value => value !== null)) await page.locator('.account-menu > summary').click()

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  expect((await context.request.get('/api/v1/me', { headers: { Accept: 'application/json' } })).status()).toBe(401)
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your properties', exact: true })).toBeVisible()
  if (!await page.locator('.account-menu').getAttribute('open').then(value => value !== null)) await page.locator('.account-menu > summary').click()
  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await page.locator('.settings-security > summary').click()
  await page.getByLabel('Current password', { exact: true }).fill(password)
  await page.getByLabel('New password', { exact: true }).fill(`${password}-changed`)
  await page.getByLabel('Confirm new password', { exact: true }).fill(`${password}-changed`)
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect((await context.request.get('/api/v1/me', { headers: { Accept: 'application/json' } })).status()).toBe(401)
  expect(errors).toEqual([])
})

test('home remains usable at mobile, tablet and desktop widths', async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/home-${test.info().project.name}-${width}.png`, fullPage: true })
  }
})
