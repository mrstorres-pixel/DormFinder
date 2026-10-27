import { test, expect } from '@playwright/test'

const campus = { id: 8, name: 'City University', city: 'Manila', latitude: 14.6, longitude: 120.985 }
const room = { id: 21, name: 'Twin beds', capacity: 2, inventory_type: 'bedspace', price_basis: 'per_person', monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, deposit_centavos: 400000, advance_months: 1, available_units: 1, total_units: 2, availability_stale: false, fees: [], utilities_notes: 'Illustrative terms: water included.' }
const listings = [1, 2].map(id => ({ id, title: '[DEMO] Student House ' + id, is_demo: true, status: 'approved', property_type: 'dormitory', description: 'FICTIONAL DEMO LISTING — not a real rental offer. A sample 2-person student rooms for City University. The room options represent separate, nonoverlapping inventory. Interior images are illustrative. [Campus demo v2/test]', address: 'Student Street', city: 'Manila', latitude: 14.601 + id * .001, longitude: 120.983, amenities: ['wifi'], house_rules: 'Quiet after 10pm.', photos: [{ id, url: '/images/demo/twin-room.webp', caption: 'AI-generated demo interior — illustrative 2-person room, not an actual property photo' }], room_options: [{ ...room, id: 20 + id }], alternative_room_options: [{ ...room, id: 20 + id }] }))
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64')
async function fixture(page) {
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: 2 } } })
    if (path.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } })
    if (path.endsWith('/campuses')) return json([campus])
    if (path.endsWith('/walking-route')) return json({ distance_meters: 522, duration_seconds: 419, geometry: { type: 'LineString', coordinates: [[120.983, 14.602], [120.984, 14.601], [120.985, 14.6]] } })
    if (/\/listings\/\d+$/.test(path)) return json(listings.find(listing => path.endsWith('/' + listing.id)))
    if (path.endsWith('/listings') || path.endsWith('/listings-map') || path.endsWith('/compare')) return json(listings)
    return json([])
  })
}

test('tab branding and listing presentation stay clean while maps retain routes, credits and recovery', async ({ page }, testInfo) => {
  await fixture(page)
  await page.goto('/listings')
  await expect(page).toHaveTitle('DormFinder')
  await expect(page.getByRole('heading', { name: 'Student House 1', exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic demo', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Report a map issue' })).toHaveCount(0)
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg')
  const svg = await page.request.get('/favicon.svg')
  expect(svg.ok()).toBe(true)
  expect(await svg.text()).toContain('M20 2 5 14v22h30V14Z')
  const png = await page.request.get('/favicon-32.png')
  expect(png.ok()).toBe(true)
  expect((await png.body()).readUInt32BE(16)).toBe(32)

  await page.goto('/listings/1?campus_id=8')
  await expect(page.getByRole('heading', { name: 'Student House 1', exact: true })).toBeVisible()
  await expect(page.locator('.listing-detail-main')).not.toContainText(/FICTIONAL DEMO|Campus demo|illustrative/i)
  await expect(page.getByRole('figure').first()).toContainText('2-person room')
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('About 7 min walk · 522 m', { exact: true })).toBeVisible()
  await expect(page.locator('.walking-route-path')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Open property in OpenStreetMap' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Report a map issue' })).toHaveCount(0)
  await expect(page.locator('.walking-route-control')).not.toContainText(/demo|fictional/i)
  await expect(page.locator('.walking-attribution').getByRole('link', { name: 'FOSSGIS / OSRM' })).toBeVisible()
  await page.getByRole('region', { name: 'Property location' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `../.local/branding-map-${testInfo.project.name}.png` })
})

test('comparison uses the same clean titles and captions without changing room selection or mobile layout', async ({ page }, testInfo) => {
  await fixture(page)
  await page.goto('/compare?items=1:21,2:22')
  await expect(page).toHaveTitle('DormFinder')
  const table = page.getByRole('table', { name: 'Selected room essentials' })
  await expect(table.getByRole('heading', { name: 'Student House 1', exact: true })).toBeVisible()
  await expect(table.getByRole('heading', { name: 'Student House 2', exact: true })).toBeVisible()
  await expect(table).not.toContainText('[DEMO]')
  await expect(table.getByRole('img').first()).toHaveAttribute('alt', '2-person room')
  await expect(page.getByLabel('Room option for Student House 1')).toHaveValue('21')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/branding-comparison-${testInfo.project.name}.png` })
})
