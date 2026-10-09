import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const check = expect.configure({ timeout: 20_000 })

test('seeded samples support discovery, photos, favorites, comparison, maps and private inquiries', async ({ browser, baseURL }, testInfo) => {
  test.skip(!process.env.E2E_DEMO_MANIFEST, 'Run explicitly against the populated sample dataset.')
  test.setTimeout(180_000)
  const manifest = JSON.parse(await readFile(process.env.E2E_DEMO_MANIFEST, 'utf8'))
  const environment = baseURL.startsWith('https:') ? 'cloud' : 'local'
  const privateDir = dirname(process.env.E2E_DEMO_MANIFEST)
  const owner = JSON.parse(await readFile(join(privateDir, 'demo-landlord-' + environment + '.json'), 'utf8'))
  const fixtures = JSON.parse(await readFile(join(privateDir, 'discovery-browser-' + environment + '-' + testInfo.project.name + '.json'), 'utf8'))
  const contexts = []
  const pageErrors = []
  async function pageFor() {
    const context = await browser.newContext({ baseURL })
    contexts.push(context)
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    page.on('pageerror', error => pageErrors.push(error.message))
    return page
  }
  async function login(page, account, role) {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(account.email)
    await page.getByLabel('Password', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(role === 'landlord' ? /\/landlord$/ : /\/account$/)
  }
  try {
    const student = await pageFor()
    await student.goto('/listings?q=DEMO')
    await check(student.getByText('16 listings found · Page 1 of 2', { exact: true })).toBeVisible()
    await expect(student.locator('.property-card')).toHaveCount(12)
    await expect(student.getByText('Synthetic demo', { exact: true })).toHaveCount(12)
    await student.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(student.getByText('16 listings found · Page 2 of 2', { exact: true })).toBeVisible()
    await expect(student.locator('.property-card')).toHaveCount(4)
    for (const id of manifest.ids.slice(16)) {
      expect((await student.request.get('/api/v1/listings/' + id)).status()).toBe(404)
    }
    await student.goto('/listings?q=Mixed%20Availability')
    await student.getByLabel('Price basis', { exact: true }).selectOption('per_person')
    await student.getByLabel('Maximum monthly rent (PHP)').fill('5000')
    await student.getByLabel('Available units confirmed within 14 days').check()
    await student.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(student.getByRole('heading', { name: 'No listings match your search.', exact: true })).toBeVisible()
    await student.getByLabel('Maximum monthly rent (PHP)').fill('9000')
    await student.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(student.getByRole('heading', { name: '[DEMO] Mixed Availability Dorm', exact: true })).toBeVisible()
    await expect(student.locator('.room-price')).toContainText('₱8,200.00')
    for (const query of ['Fully%20Booked', 'Needs%20Confirmation']) {
      await student.goto('/listings?q=' + query + '&available_only=1')
      await expect(student.getByRole('heading', { name: 'No listings match your search.', exact: true })).toBeVisible()
    }
    await login(student, fixtures.student, 'student')
    const names = ['[DEMO] Sampaguita Student Dorm', '[DEMO] Study Nook Residence', '[DEMO] Quiet Courtyard House']
    for (const [index, name] of names.entries()) {
      await student.goto('/listings/' + manifest.ids[index])
      await expect(student.getByRole('heading', { name, exact: true })).toBeVisible()
      await expect(student.getByText('Synthetic demo listing', { exact: true })).toBeVisible()
      if (index === 1) await expect(student.locator('.room-price')).toContainText('₱3,500.29')
      const gallery = student.getByRole('region', { name: 'Property photo gallery' })
      await expect(gallery.locator('figure img')).toBeVisible()
      await expect.poll(() => gallery.locator('figure img').evaluate(image => image.complete && image.naturalWidth === 1200)).toBe(true)
      await student.getByRole('button', { name: 'Next photo', exact: true }).click()
      await expect(student.getByText('Photo 2 of 2', { exact: true })).toBeVisible()
      await expect.poll(() => gallery.locator('figure img').evaluate(image => image.complete && image.naturalWidth === 1200)).toBe(true)
      await gallery.focus()
      await student.keyboard.press('ArrowLeft')
      await expect(student.getByText('Photo 1 of 2', { exact: true })).toBeVisible()
      await student.getByLabel('Add ' + name + ' to comparison', { exact: true }).check()
      if (index === 0) {
        const save = student.getByRole('button', { name: 'Save favorite ' + name, exact: true })
        if (await save.count()) await save.click()
        await expect(student.getByRole('button', { name: 'Remove favorite ' + name, exact: true })).toBeVisible()
      }
    }
    await student.getByRole('link', { name: 'Compare 3 listings', exact: true }).click()
    await expect(student.getByRole('table')).toBeVisible()
    await expect(student.getByRole('row', { name: /Known monthly charges/ })).toContainText('₱3,750.29')
    await student.getByLabel('Room option for ' + names[0], { exact: true }).selectOption({ label: 'Separate private room' })
    await expect(student.getByRole('row', { name: /Price basis/ })).toContainText('Per room')
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64')
    await student.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
    await student.getByRole('button', { name: 'Show map', exact: true }).click()
    await expect(student.getByRole('region', { name: 'Listing map' }).locator('.leaflet-marker-icon')).toHaveCount(4)
    await expect(student.getByRole('region', { name: 'Listing map' }).locator('.leaflet-control-attribution')).toContainText('OpenStreetMap')
    for (const width of [360, 768, 1440]) {
      await student.setViewportSize({ width, height: 900 })
      expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await student.goto('/favorites')
    await expect(student.getByRole('heading', { name: names[0], exact: true })).toBeVisible()
    await student.reload()
    await expect(student.getByRole('heading', { name: names[0], exact: true })).toBeVisible()
    await student.goto('/listings/' + manifest.ids[0])
    const question = 'Synthetic sample inquiry ' + randomUUID() + ': do these demo rooms have quiet hours?'
    const reply = 'Sample owner response ' + randomUUID() + ': these fictional rooms illustrate quiet hours after 10 PM.'
    await student.getByLabel('Your question').fill(question)
    await student.getByRole('button', { name: 'Send private inquiry', exact: true }).click()
    await expect(student).toHaveURL(/\/inquiries\/\d+$/)
    const inquiryPath = new URL(student.url()).pathname
    await expect(student.getByText(question, { exact: true })).toBeVisible()
    const landlord = await pageFor()
    await login(landlord, owner, 'landlord')
    await landlord.goto(inquiryPath)
    await expect(landlord.getByText(question, { exact: true })).toBeVisible()
    await landlord.getByLabel('Your reply').fill(reply)
    await landlord.getByRole('button', { name: 'Send reply', exact: true }).click()
    await expect(landlord.getByRole('log', { name: 'Conversation messages' }).getByText(reply, { exact: true })).toBeVisible()
    await student.reload()
    await expect(student.getByRole('log', { name: 'Conversation messages' }).getByText(reply, { exact: true })).toBeVisible()
    const guest = await pageFor()
    expect((await guest.request.get('/api/v1' + inquiryPath + '/messages', { headers: { Accept: 'application/json' } })).status()).toBe(401)
    await guest.goto('/listings?q=DEMO')
    await expect(guest.getByText('16 listings found · Page 1 of 2', { exact: true })).toBeVisible()
    for (const cover of await guest.locator('.property-cover img').all()) {
      await cover.scrollIntoViewIfNeeded()
      await check.poll(() => cover.evaluate(image => image.complete && image.naturalWidth === 1200)).toBe(true)
    }
    if (process.env.E2E_DEMO_SCREENSHOT && testInfo.project.name === 'chromium') {
      await guest.evaluate(() => window.scrollTo(0, 0))
      await guest.screenshot({ path: process.env.E2E_DEMO_SCREENSHOT, fullPage: true })
    }
    expect(pageErrors).toEqual([])
  } finally {
    for (const context of contexts) await context.close()
  }
})
