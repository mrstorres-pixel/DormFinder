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
      const map = owner.getByRole('region', { name: 'Property location picker' })
      await expect(map).toHaveClass(/leaflet-container/)
      await expect.poll(() => map.locator('img.leaflet-tile-loaded').count()).toBeGreaterThan(0)
      if (editable.latitude !== null && editable.longitude !== null) await expect(map.locator('.owner-property-pin svg')).toHaveCount(1)
      await expect(map.locator('img.leaflet-marker-icon')).toHaveCount(0)
      const originalAddress = await owner.getByLabel('Street address', { exact: true }).inputValue()
      const originalCity = await owner.getByLabel('City', { exact: true }).inputValue()
      const lookup = owner.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/landlord/address-search')
      await owner.getByLabel('Find the property address').fill('P. Casal Street, Manila')
      await owner.getByRole('button', { name: 'Find address', exact: true }).click()
      const lookupResponse = await lookup
      expect(lookupResponse.status()).toBe(200)
      const matches = (await lookupResponse.json()).data
      expect(matches.length).toBeGreaterThan(0)
      await owner.getByRole('listbox', { name: 'Address search results' }).getByRole('button').first().click()
      await expect(owner.getByLabel('Latitude', { exact: true })).toHaveValue(Number(matches[0].latitude).toFixed(6))
      await expect(owner.getByLabel('Longitude', { exact: true })).toHaveValue(Number(matches[0].longitude).toFixed(6))
      const reversed = owner.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/landlord/address-reverse' && response.status() !== 429)
      await map.click({ position: { x: 180, y: 140 } })
      const pinLatitude = await owner.getByLabel('Latitude', { exact: true }).inputValue()
      const pinLongitude = await owner.getByLabel('Longitude', { exact: true }).inputValue()
      const reversedResponse = await reversed
      expect(reversedResponse.status()).toBe(200)
      const nearby = (await reversedResponse.json()).data
      if (nearby[0]) await expect(owner.getByRole('combobox', { name: 'Find the property address' })).toHaveValue(nearby[0].label)
      else await expect(owner.getByText('No mapped address found at this pin.', { exact: false })).toBeVisible()
      await expect(owner.getByLabel('Latitude', { exact: true })).toHaveValue(pinLatitude)
      await expect(owner.getByLabel('Longitude', { exact: true })).toHaveValue(pinLongitude)
      await owner.getByRole('button', { name: 'Cancel location changes', exact: true }).click()
      await expect(owner.getByLabel('Street address', { exact: true })).toHaveValue(originalAddress)
      await expect(owner.getByLabel('City', { exact: true })).toHaveValue(originalCity)
      await expect(owner.getByRole('button', { name: 'Cancel location changes', exact: true })).toHaveCount(0)
    }
    await owner.goto('/landlord/properties/new')
    await expect(owner.getByLabel('Property name')).toHaveAttribute('required', '')
    await expect(owner.getByLabel('City')).toHaveAttribute('required', '')
    await expect(owner.getByRole('button', { name: 'Start listing', exact: true })).toBeVisible()

    const reviewer = await pageFor(admin, /\/admin$/)
    await readPage(reviewer, '/admin', '/admin/reviews')
    await reviewer.getByRole('button', { name: 'Filters & sorting' }).click()
    await reviewer.getByLabel('Search listings', { exact: true }).fill('Synthetic')
    const reviews = await apply(reviewer, '/admin/reviews')
    expect(reviews.body.meta.per_page).toBe(12)
    const directory = await readPage(reviewer, '/admin/listings', '/admin/properties')
    if (directory.data[0]) {
      const listing = directory.data[0]
      await readPage(reviewer, '/admin/reviews/' + listing.id, '/admin/reviews/' + listing.id)
      await expect(reviewer.getByRole('link', { name: 'View listing history', exact: true })).toHaveAttribute('href', '/admin/audit?property_id=' + listing.id)
      await expect(reviewer.locator('.admin-review-brief')).toContainText('#' + listing.id)
      await readPage(reviewer, '/admin/listings', '/admin/properties')
    }
    const refreshed = reviewer.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/admin/properties' && response.request().method() === 'GET')
    await reviewer.getByRole('button', { name: 'Refresh results', exact: true }).click()
    expect((await refreshed).status()).toBe(200)
    const resized = reviewer.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/admin/properties' && new URL(response.url()).searchParams.get('per_page') === '24')
    await reviewer.getByLabel('Per page').selectOption('24')
    expect((await resized).status()).toBe(200)
    await reviewer.getByRole('button', { name: 'Filters & sorting' }).click()
    await reviewer.getByLabel('Listing status').selectOption('draft')
    await reviewer.getByLabel('Sort by').selectOption('title_asc')
    const listings = await apply(reviewer, '/admin/properties')
    expect(listings.body.meta.per_page).toBe(24)
    expect(listings.body.data.every(property => property.status === 'draft')).toBe(true)
    await readPage(reviewer, '/admin/users', '/admin/users')
    await reviewer.getByLabel('Search account name or email').fill('Synthetic')
    await reviewer.getByRole('button', { name: 'Filters & sorting' }).click()
    await reviewer.getByLabel('Account role').selectOption('landlord')
    const users = await apply(reviewer, '/admin/users')
    expect(users.body.data.every(user => user.role === 'landlord')).toBe(true)
    if (users.body.data.length) {
      await reviewer.getByRole('button', { name: 'Manage account: ' + users.body.data[0].name, exact: true }).first().click()
      await expect(reviewer.getByRole('dialog', { name: 'Manage account', exact: true })).toBeVisible()
      await expect(reviewer.getByRole('link', { name: 'View account history', exact: true })).toHaveAttribute('href', '/admin/audit?user_id=' + users.body.data[0].id)
      await reviewer.getByRole('button', { name: 'Close manage account' }).click()
    }
    await readPage(reviewer, '/admin/reports', '/admin/reports')
    await reviewer.getByRole('button', { name: 'Filters & sorting' }).click()
    await reviewer.getByLabel('Report status').selectOption('all')
    await reviewer.getByLabel('Concern').selectOption('other')
    const reports = await apply(reviewer, '/admin/reports')
    expect(reports.body.data.every(report => report.category === 'other')).toBe(true)
    await readPage(reviewer, '/admin/audit', '/admin/audit')
    await reviewer.getByRole('button', { name: 'Filters & sorting' }).click()
    await reviewer.getByLabel('Action', { exact: true }).selectOption('listing_review')
    await reviewer.getByLabel('From date').fill('2026-01-01')
    await reviewer.getByLabel('To date').fill('2026-12-31')
    const audit = await apply(reviewer, '/admin/audit')
    expect(audit.body.data.every(row => row.action === 'listing_review')).toBe(true)
    if ((audit.body.meta?.last_page || audit.body.last_page || 1) > 1) await expect(reviewer.getByRole('navigation', { name: 'Result pages' })).toBeVisible()
    else await expect(reviewer.getByRole('navigation', { name: 'Result pages' })).toHaveCount(0)
    const campuses = await readPage(reviewer, '/admin/campuses', '/admin/campuses')
    if (campuses.data[0]) {
      const campus = campuses.data[0]
      await reviewer.getByRole('button', { name: 'Edit campus ' + campus.name, exact: true }).click()
      const editor = reviewer.getByRole('dialog', { name: 'Edit campus', exact: true })
      await expect(editor.getByLabel('Campus and branch name')).toHaveValue(campus.name)
      await expect(editor.getByLabel('Entrance latitude')).toHaveValue(String(campus.latitude))
      await expect(editor.getByLabel('Source link', { exact: true })).toHaveAttribute('required', '')
      await reviewer.getByRole('button', { name: 'Close edit campus', exact: true }).click()
      const historyLoaded = reviewer.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/admin/campuses/' + campus.id + '/history')
      await reviewer.getByRole('button', { name: 'History ' + campus.name, exact: true }).click()
      expect((await historyLoaded).status()).toBe(200)
      await reviewer.getByRole('button', { name: 'Close campus history', exact: true }).click()
    }
    const suggestionsLoaded = reviewer.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/admin/campus-suggestions')
    await reviewer.getByRole('navigation', { name: 'Campus workspace views' }).getByRole('button', { name: /Suggestions/ }).click()
    expect((await suggestionsLoaded).status()).toBe(200)
    await reviewer.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => reviewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await reviewer.getByRole('button', { name: 'Menu', exact: true }).click()
    await reviewer.locator('.account-menu summary').click()
    const avatarLoaded = reviewer.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/me/avatar' && response.request().method() === 'GET')
    await reviewer.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).click()
    expect((await avatarLoaded).status()).toBe(200)
    await expect(reviewer.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
    await expect(reviewer.getByLabel('Your name', { exact: true })).toHaveValue(admin.name || /.+/)
    await expect(reviewer.getByRole('navigation', { name: 'Administrator sections' })).toBeVisible()
    await expect(reviewer.getByRole('heading', { name: 'Profile photo', exact: true })).toBeVisible()
    await reviewer.locator('.settings-security > summary').click()
    await expect(reviewer.getByLabel('Current password')).toBeVisible()
    await expect(reviewer.getByRole('heading', { name: 'Something went wrong.' })).toHaveCount(0)
    expect(unexpectedWrites).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
