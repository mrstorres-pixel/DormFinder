import { test, expect } from '@playwright/test'

test('public listing names and locations search without silently choosing a campus', async ({ page }) => {
  test.setTimeout(120_000)
  const writes = []
  await page.route('**/api/v1/**', route => {
    if (route.request().method() === 'GET') return route.continue()
    writes.push(new URL(route.request().url()).pathname)
    return route.abort('blockedbyclient')
  })
  const response = await page.request.get('/api/v1/listings')
  expect(response.status()).toBe(200)
  const sample = (await response.json()).data[0]
  expect(sample).toBeTruthy()
  await page.goto('/listings')
  const search = page.getByRole('combobox', { name: 'Campus, location or listing' })
  await expect(search).toHaveValue('')
  await expect(page.locator('.campus-marker')).toHaveCount(0)
  const suggestions = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/search-suggestions' && response.status() === 200)
  const titleQuery = [...sample.title].slice(0, 100).join('')
  await search.fill(titleQuery)
  await suggestions
  await page.getByRole('button', { name: 'Listing ' + sample.title, exact: true }).click()
  await page.getByRole('button', { name: 'Search places', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(titleQuery)
  await expect(page.locator('.property-card').filter({ has: page.getByRole('heading', { name: sample.title, exact: true }) })).toBeVisible()
  expect(new URL(page.url()).searchParams.has('campus_id')).toBe(false)
  await search.fill(sample.city)
  await search.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(sample.city)
  await expect(page.locator('.property-card').first()).toBeVisible()
  await expect(page.locator('.campus-marker')).toHaveCount(0)
  expect(writes).toEqual([])
})
