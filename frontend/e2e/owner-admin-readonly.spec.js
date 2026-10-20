import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('existing owners and admins can read the deployed editor and filtered directories', async ({ browser, baseURL }, testInfo) => {
  test.skip(!baseURL.startsWith('https:'), 'Read-only acceptance of the existing live workspaces.')
  test.setTimeout(180_000)
  const accounts = JSON.parse((await readFile(`../.secrets/discovery-browser-cloud-${testInfo.project.name}.json`, 'utf8')).replace(/^\uFEFF/, ''))
  const admin = JSON.parse((await readFile('../.secrets/phase2-cloud-admin.json', 'utf8')).replace(/^\uFEFF/, ''))
  const contexts = [], unexpectedWrites = []
  async function pageFor(credentials, destination) {
    const context = await browser.newContext({ baseURL }); contexts.push(context)
    await context.route('**/api/v1/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname
      if (request.method() === 'GET' || (request.method() === 'POST' && path === '/api/v1/auth/login')) return route.continue()
      unexpectedWrites.push({ path, method: request.method() })
      return route.abort('blockedbyclient')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(25_000)
    await page.goto('/login')
    await page.getByLabel('Email address').fill(credentials.email)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(destination, { timeout: 45_000 })
    return page
  }
  async function readPage(page, path, endpoint) {
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1' + endpoint && response.request().method() === 'GET')
    await page.goto(path)
    const response = await loaded
    expect(response.status()).toBe(200)
    await response.finished()
    const data = await response.json()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    return data
  }
  async function apply(page, endpoint) {
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1' + endpoint && response.request().method() === 'GET')
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
    const response = await loaded
    expect(response.status()).toBe(200)
    await response.finished()
    return { body: await response.json(), params: new URL(response.url()).searchParams }
  }
  try {
    const owner = await pageFor(accounts.landlord, /\/landlord$/)
    const properties = await readPage(owner, '/landlord', '/landlord/properties')
    const editable = properties.data.find(property => ['draft', 'rejected', 'approved'].includes(property.status))
    if (editable) {
      await readPage(owner, `/landlord/properties/${editable.id}#location`, '/landlord/properties/' + editable.id)
      await expect(owner.getByLabel('About the property')).toHaveAttribute('required', '')
      await expect(owner.getByRole('button', { name: 'Save and continue', exact: true })).toBeVisible()
      await owner.getByRole('button', { name: 'Choose location on map', exact: true }).click()
      const map = owner.getByRole('region', { name: 'Property location picker' })
      await expect(map).toHaveClass(/leaflet-container/)
      if (editable.latitude !== null && editable.longitude !== null) await expect(map.locator('.owner-property-pin svg')).toHaveCount(1)
      await expect(map.locator('img.leaflet-marker-icon')).toHaveCount(0)
    }
    await owner.goto('/landlord/properties/new')
    await expect(owner.getByLabel('Property name')).toHaveAttribute('required', '')
    await expect(owner.getByLabel('City')).toHaveAttribute('required', '')
    await expect(owner.getByRole('button', { name: 'Start listing', exact: true })).toBeVisible()

    const reviewer = await pageFor(admin, /\/admin$/)
    await readPage(reviewer, '/admin', '/admin/reviews')
    await reviewer.getByLabel('Search listings', { exact: true }).fill('Synthetic')
    const reviews = await apply(reviewer, '/admin/reviews')
    expect(reviews.body.meta.per_page).toBe(12)
    await readPage(reviewer, '/admin/listings', '/admin/properties')
    await reviewer.getByLabel('Listing status').selectOption('draft')
    await reviewer.getByLabel('Sort by').selectOption('title_asc')
    await reviewer.getByLabel('Per page').selectOption('24')
    const listings = await apply(reviewer, '/admin/properties')
    expect(listings.body.meta.per_page).toBe(24)
    expect(listings.body.data.every(property => property.status === 'draft')).toBe(true)
    await readPage(reviewer, '/admin/users', '/admin/users')
    await reviewer.getByLabel('Search account name or email').fill('Synthetic')
    await reviewer.getByLabel('Account role').selectOption('landlord')
    const users = await apply(reviewer, '/admin/users')
    expect(users.body.data.every(user => user.role === 'landlord')).toBe(true)
    if (users.body.data.length) {
      await reviewer.getByRole('button', { name: 'Manage account: ' + users.body.data[0].name, exact: true }).first().click()
      await expect(reviewer.getByRole('dialog', { name: 'Manage account', exact: true })).toBeVisible()
      await reviewer.getByRole('button', { name: 'Close manage account' }).click()
    }
    await readPage(reviewer, '/admin/reports', '/admin/reports')
    await reviewer.getByLabel('Report status').selectOption('all')
    await reviewer.getByLabel('Concern').selectOption('other')
    const reports = await apply(reviewer, '/admin/reports')
    expect(reports.body.data.every(report => report.category === 'other')).toBe(true)
    await readPage(reviewer, '/admin/audit', '/admin/audit')
    await reviewer.getByLabel('Action', { exact: true }).selectOption('listing_review')
    await reviewer.getByLabel('From date').fill('2026-01-01')
    await reviewer.getByLabel('To date').fill('2026-12-31')
    const audit = await apply(reviewer, '/admin/audit')
    expect(audit.body.data.every(row => row.action === 'listing_review')).toBe(true)
    await expect(reviewer.getByRole('navigation', { name: 'Result pages' })).toBeVisible()
    await reviewer.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => reviewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(unexpectedWrites).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
