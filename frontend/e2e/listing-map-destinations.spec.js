import { test, expect } from '@playwright/test'

const campuses = [
  { id: 8, name: 'West University', institution_name: 'West University', latitude: 14.6009, longitude: 120.981, city: 'Manila' },
  { id: 9, name: 'East College', institution_name: 'East College', latitude: 14.6019, longitude: 120.989, city: 'Manila' },
]
const room = { id: 21, name: 'Twin beds', capacity: 2, price_basis: 'per_person', inventory_type: 'bedspace', monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, deposit_centavos: 400000, advance_months: 1, available_units: 1, total_units: 2, availability_stale: false, fees: [] }
const properties = [1, 2].map(id => ({ id, title: 'Between campuses ' + id, description: 'Fictional test residence.', address: 'Test street', city: 'Manila', property_type: 'dormitory', is_demo: true, latitude: 14.6014 + (id - 1) * .001, longitude: 120.983, room_options: [room, { ...room, id: 22, name: 'Other twin beds' }], photos: [] }))
async function chooseDestination(page, id) {
  const input = page.getByRole('combobox', { name: 'Walking destination' })
  if (!id) return page.getByRole('button', { name: 'Clear selected campus' }).click()
  await input.fill(campuses.find(campus => String(campus.id) === String(id)).name)
  await input.press('Enter')
}
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64')
function walkingRoute(id) {
  const campus = campuses.find(c => c.id === id)
  return { distance_meters: id === 8 ? 522 : 780, duration_seconds: id === 8 ? 419 : 625, geometry: { type: 'LineString', coordinates: [[120.983, 14.6014], [120.983, 14.602], [campus.longitude, 14.602], [campus.longitude, campus.latitude]] } }
}
async function fixture(page) {
  const state = { requests: [], held: null, hold: false, failRoute: false, failCampuses: false, failTiles: false, noPin: false }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => state.failTiles ? route.fulfill({ status: 503 }) : route.fulfill({ contentType: 'image/png', body: tile }))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: 2 } } })
    if (path.endsWith('/me')) return json({ id: 99, name: 'Test student', role: 'student', preferred_campus_id: 9 })
    if (path.endsWith('/campuses')) return state.failCampuses ? route.fulfill({ status: 503, json: { message: 'Synthetic campus directory outage' } }) : json(campuses)
    if (path.endsWith('/walking-route')) {
      const id = Number(url.searchParams.get('campus_id')); state.requests.push(id)
      if (state.hold) { state.held = route; return }
      return state.failRoute ? route.fulfill({ status: 422, json: { message: 'No mapped walking route was found.' } }) : json(walkingRoute(id))
    }
    if (path.endsWith('/compare')) return json(properties.map(property => ({ ...property, room_options: [room], alternative_room_options: property.room_options })))
    if (/\/listings\/\d+$/.test(path)) return json({ ...properties[0], ...(state.noPin ? { latitude: null, longitude: null } : {}) })
    return json([])
  })
  return state
}

test('a direct listing has a visible map and an explicit destination even for a student with a saved campus', async ({ page }, testInfo) => {
  const state = await fixture(page)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings/1?option=22')
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  const map = page.getByRole('region', { name: 'Listing map', exact: true })
  await expect(map.locator('.listing-marker')).toHaveCount(1)
  expect((await map.boundingBox()).height).toBeGreaterThanOrEqual(320)
  await expect(map.locator('.campus-marker')).toHaveCount(0)
  const destination = page.getByRole('combobox', { name: 'Walking destination' })
  await expect(destination).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Walk to campus', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show results', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fit all places', exact: true })).toHaveCount(0)
  expect(state.requests).toEqual([])
  await chooseDestination(page, '9')
  await expect(map.locator('.campus-marker')).toHaveAttribute('title', /East College/)
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('About 11 min walk · 780 m')).toBeVisible()
  await expect(map.locator('.walking-route-path')).toHaveCount(1)
  await page.getByRole('button', { name: 'Recenter route', exact: true }).click()
  expect(state.requests).toEqual([9])
  await expect(page).toHaveURL(/\/listings\/1\?option=22$/)
  await expect(page.locator('.room-choice input:checked')).toHaveValue('22')
  await map.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `../.local/listing-map-destination-${testInfo.project.name}-desktop.png` })
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 740, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => {
      const box = await map.boundingBox()
      return box.height >= 320 && box.width > 200 && box.x >= 0 && box.x + box.width <= viewport.width
    }).toBe(true)
    await expect.poll(() => map.evaluate(node => {
      const route = node.querySelector('.walking-route-path').getBoundingClientRect(), box = node.getBoundingClientRect()
      return route.width > 20 && route.height > 1 && route.left >= box.left && route.right <= box.right && route.top >= box.top && route.bottom <= box.bottom
    })).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await map.scrollIntoViewIfNeeded()
  await expect.poll(() => map.evaluate(node => {
    const route = node.querySelector('.walking-route-path').getBoundingClientRect(), box = node.getBoundingClientRect()
    return route.width > 20 && route.height > 1 && route.left >= box.left && route.right <= box.right && route.top >= box.top && route.bottom <= box.bottom
  })).toBe(true)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.screenshot({ path: `../.local/listing-map-destination-${testInfo.project.name}-mobile.png` })
  await page.getByRole('button', { name: 'Hide map', exact: true }).click()
  await expect(map).toHaveCount(0)
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  await expect(destination).toHaveValue('East College')
  await expect(page.locator('.walking-route-path')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('changing the walking destination preserves an unsent viewing request and the room selection', async ({ page }) => {
  await fixture(page)
  await page.goto('/listings/1?option=22')
  await page.getByRole('button', { name: 'Request a viewing', exact: true }).click()
  await page.getByLabel('Viewing note for the owner').fill('Keep my viewing draft while I check the walk.')
  await page.getByRole('button', { name: 'Close request a viewing' }).click()
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  await chooseDestination(page, '8')
  await chooseDestination(page, '9')
  await expect(page).toHaveURL(/\/listings\/1\?option=22$/)
  await expect(page.locator('.room-choice input:checked')).toHaveValue('22')
  await page.getByRole('button', { name: 'Request a viewing', exact: true }).click()
  await expect(page.getByLabel('Viewing note for the owner')).toHaveValue('Keep my viewing draft while I check the walk.')
})

test('search campus is retained, changing destination discards late directions, and clearing it removes estimates', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/listings/1?campus_id=8&option=21')
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  const destination = page.getByRole('combobox', { name: 'Walking destination' })
  await expect(destination).toHaveValue('West University')
  state.hold = true
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect.poll(() => !!state.held).toBe(true)
  await chooseDestination(page, '9')
  await state.held.fulfill({ json: { data: walkingRoute(8) } }).catch(() => {})
  await expect(page.getByText(/About \d+ min walk/)).toHaveCount(0)
  await expect(page.locator('.walking-route-path')).toHaveCount(0)
  state.hold = false
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('About 11 min walk · 780 m')).toBeVisible()
  expect(state.requests).toEqual([8, 9])
  await chooseDestination(page, '')
  await expect(page.locator('.campus-marker')).toHaveCount(0)
  await expect(page.locator('.walking-route-path')).toHaveCount(0)
  await expect(page.getByText(/About \d+ min walk/)).toHaveCount(0)
})

test('campus, tile and routing failures offer recovery instead of an empty map or invented estimate', async ({ page }) => {
  const state = await fixture(page)
  state.failCampuses = true; state.failTiles = true; state.failRoute = true
  await page.goto('/listings/1')
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic campus directory outage')
  await expect(page.getByRole('button', { name: 'Retry map', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open property in OpenStreetMap' })).toHaveAttribute('href', /mlat=14\.6014&mlon=120\.983/)
  state.failCampuses = false; state.failTiles = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('button', { name: 'Retry map', exact: true }).click()
  await chooseDestination(page, '8')
  await page.getByRole('button', { name: 'Walk to campus', exact: true }).click()
  await expect(page.getByText('No mapped walking route was found.')).toBeVisible()
  await expect(page.getByText(/About \d+ min walk/)).toHaveCount(0)
  state.failRoute = false
  await page.getByRole('button', { name: 'Try walking route again' }).click()
  await expect(page.getByText('About 7 min walk · 522 m')).toBeVisible()
})

test('a property with no pin explains the missing location without opening an empty map', async ({ page }) => {
  const state = await fixture(page); state.noPin = true
  await page.goto('/listings/1?campus_id=8')
  await expect(page.getByText(/A location pin is not available/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show map', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Walk to campus', exact: true })).toHaveCount(0)
  expect(state.requests).toEqual([])
})

test('comparison maps without a search campus show every compared property and allow a destination choice', async ({ page }) => {
  await fixture(page)
  await page.goto('/compare?items=1:21,2:21')
  const map = page.getByRole('region', { name: 'Listing map', exact: true })
  await expect(map.locator('.listing-marker')).toHaveCount(2)
  expect((await map.boundingBox()).height).toBeGreaterThanOrEqual(320)
  await expect(map.locator('.campus-marker')).toHaveCount(0)
  await chooseDestination(page, '8')
  await expect(map.locator('.campus-marker')).toHaveAttribute('title', /West University/)
  await expect(page.getByRole('row', { name: /Walk to campus/ })).toContainText('About 7 min walk')
  await expect(map.locator('.walking-route-path')).toHaveCount(1)
})
