import { test, expect } from '@playwright/test'

test('public listing obtains a real pedestrian estimate through the backend and highlights it', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const directory = await page.request.get('/api/v1/campuses')
  expect(directory.ok()).toBe(true)
  const campus = (await directory.json()).data.find(campus => campus.slug === 'tip-manila-casal')
  expect(campus).toBeTruthy()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings?q=DEMO&campus_id=' + campus.id)
  await page.locator('.property-card').first().getByRole('button', { name: 'Show on map', exact: true }).click()
  const reply = page.waitForResponse(response => response.url().includes('/walking-route?'))
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  const response = await reply
  expect(response.status()).toBe(200)
  const route = (await response.json()).data
  expect(route.provider).toBe('FOSSGIS / OSRM (foot)')
  expect(route.distance_meters).toBeGreaterThan(0)
  expect(route.duration_seconds).toBeGreaterThan(0)
  expect(route.geometry.coordinates.length).toBeGreaterThan(2)
  await expect(page.locator('.walking-route-control').getByText(new RegExp('About ' + Math.ceil(route.duration_seconds / 60) + ' min walk'))).toBeVisible()
  await expect(page.locator('.walking-route-path')).toHaveCount(1)
  await expect(page.getByText('Demo route from a fictional listing pin.')).toHaveCount(0)
  await page.screenshot({ path: `../.local/walking-real-${testInfo.project.name}.png`, fullPage: true })
})
