import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('existing landlord can search, inspect, refresh and return to owned property views without writes', async ({ browser, baseURL }, testInfo) => {
  test.skip(!baseURL.startsWith('https:'), 'Read-only acceptance of the existing live landlord workspace.')
  test.setTimeout(180_000)
  const accounts = JSON.parse((await readFile(`../.secrets/discovery-browser-cloud-${testInfo.project.name}.json`, 'utf8')).replace(/^\uFEFF/, ''))
  const context = await browser.newContext({ baseURL })
  const unexpectedWrites = []
  await context.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET' || (request.method() === 'POST' && path === '/api/v1/auth/login')) return route.continue()
    unexpectedWrites.push({ method: request.method(), path })
    return route.abort('blockedbyclient')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const propertiesResponse = (expected = {}) => page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/v1/landlord/properties' && response.request().method() === 'GET' && Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value)
  })
  try {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(accounts.landlord.email)
    await page.getByLabel('Password', { exact: true }).fill(accounts.landlord.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/landlord$/, { timeout: 45_000 })
    let loaded = propertiesResponse()
    await page.goto('/landlord')
    let response = await loaded
    expect(response.status()).toBe(200)
    let result = await response.json()
    await expect(page.getByRole('heading', { name: 'Your properties', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Availability updates/ })).toBeVisible()
    if (result.data.length) {
      const term = (result.data[0].city || result.data[0].title).slice(0, 80)
      await page.getByLabel('Search your properties').fill(term)
      loaded = propertiesResponse({ q: term })
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      response = await loaded
      expect(response.status()).toBe(200)
      result = await response.json()
      expect(new URL(response.url()).searchParams.get('q')).toBe(term)
      expect(result.data.every(property => [property.title, property.address, property.city].join(' ').toLowerCase().includes(term.toLowerCase()))).toBe(true)
      await expect(page.locator('.owner-property-card').first()).toBeVisible()
      const returnSearch = new URL(page.url()).search
      await page.locator('.owner-card-actions .btn').first().click()
      await expect(page.getByRole('button', { name: 'Refresh saved listing', exact: true })).toBeVisible()
      await page.getByRole('link', { name: '← Your properties', exact: true }).click()
      await expect.poll(() => new URL(page.url()).search).toBe(returnSearch)
      await expect(page.getByLabel('Search your properties')).toHaveValue(term)
      loaded = propertiesResponse({ q: term })
      await page.getByRole('button', { name: 'Refresh results', exact: true }).click()
      expect((await loaded).status()).toBe(200)
    }
    loaded = propertiesResponse({ availability: 'needs_confirmation' })
    await page.getByRole('link', { name: /Availability updates/ }).click()
    response = await loaded
    expect(response.status()).toBe(200)
    result = await response.json()
    expect(result.data.every(property => property.status === 'approved' && property.availability.rooms_needing_confirmation > 0)).toBe(true)
    loaded = propertiesResponse({ view: 'archived' })
    await page.getByRole('navigation', { name: 'Property views' }).getByRole('button', { name: 'Removed', exact: true }).click()
    response = await loaded
    expect(response.status()).toBe(200)
    result = await response.json()
    expect(result.data.every(property => property.status === 'archived')).toBe(true)
    await expect(page).toHaveURL(/view=archived/)
    await expect(page.locator('.owner-property-card')).toHaveCount(result.data.length)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toHaveCount(0)
    expect(unexpectedWrites).toEqual([])
  } finally { await context.close() }
})
