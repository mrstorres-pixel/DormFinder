import { test, expect } from '@playwright/test'

const campus = { id: 8, name: 'Synthetic University', institution_name: 'Synthetic University', city: 'Manila', address: 'Test reference', latitude: 14.6, longitude: 120.98, source_url: 'https://example.test', slug: 'test-campus' }
const room = { id: 21, name: 'Shared room', capacity: 2, price_basis: 'per_person', inventory_type: 'bedspace', monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 425000, move_in_fixed_total_centavos: 0, available_units: 2, availability_stale: false, fees: [] }
const places = [
  { id: 1, title: 'North room', latitude: 14.6016, longitude: 120.98 },
  { id: 2, title: 'Second north room', latitude: 14.60161, longitude: 120.98 },
  { id: 3, title: 'South room', latitude: 14.5984, longitude: 120.98 },
  { id: 4, title: 'Second south room', latitude: 14.59841, longitude: 120.98 },
].map(p => ({ ...p, address: 'Synthetic address', city: 'Manila', description: 'Fictional test listing.', property_type: 'dormitory', is_demo: true, photos: [], room_options: [room], distance_from_campus: { campus_id: 8, meters: 200 } }))
const response = { distance_meters: 522, duration_seconds: 419, endpoint_offsets_meters: [12, 18], geometry: { type: 'LineString', coordinates: [[120.98, 14.6016], [120.981, 14.6014], [120.981, 14.6002], [120.98, 14.6]] } }

async function fixture(page) {
  const state = { calls: [], fail: false, held: null, hold: false }
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64') }))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: 4 } } })
    if (path.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } })
    if (path.endsWith('/walking-route')) {
      state.calls.push(path + url.search)
      if (state.hold) { state.held = route; return }
      return state.fail ? route.fulfill({ status: 422, json: { message: 'No mapped walking route was found.' } }) : json(response)
    }
    if (path.endsWith('/campuses')) return json([campus])
    if (/\/listings\/\d+$/.test(path)) return json(places[0])
    return json(places)
  })
  return state
}

test('campus and clustered labels remain separate, with a selectable walking path and mobile summary', async ({ page }, testInfo) => {
  const state = await fixture(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings?campus_id=8')
  const map = page.getByRole('region', { name: 'Listing map', exact: true })
  await expect(map.locator('.price-cluster')).toHaveCount(2)
  const overlap = await map.evaluate(node => {
    const campus = node.querySelector('.campus-marker').getBoundingClientRect()
    return [...node.querySelectorAll('.price-cluster')].some(pin => { const p = pin.getBoundingClientRect(); return p.left < campus.right && p.right > campus.left && p.top < campus.bottom && p.bottom > campus.top })
  })
  expect(overlap).toBe(false)
  await page.screenshot({ path: `../.local/walking-campus-clusters-${testInfo.project.name}.png` })
  await map.locator('.price-cluster').first().click()
  await page.getByRole('button', { name: 'Show on map', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Walk to campus', exact: true })).toBeVisible()
  expect(state.calls).toHaveLength(0)
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('About 7 min walk · 522 m')).toBeVisible()
  await expect(map.locator('.walking-route-path')).toHaveCount(1)
  await expect(map.locator('.walking-route-connection')).toHaveCount(2)
  await expect.poll(async () => map.evaluate(node => {
    const path = node.querySelector('.walking-route-path').getBoundingClientRect(), box = node.getBoundingClientRect(), preview = node.closest('.map-canvas').querySelector('.map-preview').getBoundingClientRect()
    return path.left >= box.left && path.right <= box.right && path.top >= box.top && path.bottom <= preview.top - 10
  })).toBe(true)
  expect(state.calls[0]).toContain('/listings/1/walking-route?campus_id=8')
  await page.screenshot({ path: `../.local/walking-route-${testInfo.project.name}-desktop.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('About 7 min walk · 522 m')).toBeVisible()
  await expect.poll(() => map.evaluate(node => {
    const caption = node.querySelector('.campus-pin-label').getBoundingClientRect(), preview = node.closest('.map-canvas').querySelector('.map-preview').getBoundingClientRect()
    return caption.bottom < preview.top
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/walking-route-${testInfo.project.name}-mobile.png`, fullPage: true })
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByText('About 7 min walk · 522 m')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Clear route', exact: true }).click()
  await expect(map.locator('.walking-route-path')).toHaveCount(0)
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(map.locator('.walking-route-path')).toHaveCount(1)
  expect(state.calls).toHaveLength(1)
})

test('selection changes remove stale routes and failed requests allow an explicit retry', async ({ page }) => {
  const state = await fixture(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings?campus_id=8')
  await page.getByRole('button', { name: 'Show on map', exact: true }).first().click()
  state.hold = true
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect.poll(() => state.held !== null).toBe(true)
  await page.getByRole('button', { name: 'Show on map', exact: true }).nth(2).click()
  await state.held.fulfill({ json: { data: response } }).catch(() => {})
  await expect(page.getByText('About 7 min walk · 522 m')).toHaveCount(0)
  await expect(page.locator('.walking-route-path')).toHaveCount(0)
  state.hold = false; state.fail = true
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('No mapped walking route was found.')).toBeVisible()
  state.fail = false
  await page.getByRole('button', { name: 'Try walking route again' }).click()
  await expect(page.getByText('About 7 min walk · 522 m')).toBeVisible()
  await page.getByRole('button', { name: 'Close listing preview' }).click()
  await expect(page.locator('.walking-route-path')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Walk to campus', exact: true })).toHaveCount(0)
})

test('listing details loads walking directions only after opening the map and requesting them', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/listings/1?campus_id=8&option=21')
  await expect(page.getByRole('heading', { name: 'Location and campus' })).toBeVisible()
  expect(state.calls).toHaveLength(0)
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('About 7 min walk · 522 m')).toBeVisible()
  await expect(page.locator('.walking-route-path')).toHaveCount(1)
  await page.getByRole('button', { name: 'Hide map', exact: true }).click()
  await expect(page.locator('.walking-route-path')).toHaveCount(0)
})
