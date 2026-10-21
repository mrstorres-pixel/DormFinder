import { test, expect } from '@playwright/test'

const campuses = [
  { id: 8, name: 'TIP Manila — P. Casal', institution_name: 'Technological Institute', city: 'Manila', latitude: 14.6, longitude: 120.99 },
  { id: 9, name: 'CEU — Manila, Mendiola', institution_name: 'Centro Escolar University', city: 'Manila', latitude: 14.605, longitude: 120.993 },
]
const room = { id: 11, name: 'Student room', capacity: 1, inventory_type: 'bedspace', price_basis: 'per_person', available_units: 1, total_units: 1, monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 425000, move_in_fixed_total_centavos: 800000, deposit_centavos: 400000, advance_months: 1, availability_stale: false, availability_confirmed_at: '2026-10-20T00:00:00Z', fees: [], utilities_notes: 'Water included.' }
const properties = ['Single-option residence', 'Residence with a choice of rooms', 'Garden residence'].map((title, index) => ({ id: index + 1, title, city: 'Manila', address: 'Sample address', property_type: 'dormitory', description: 'A fictional student residence used for testing.', is_demo: true, latitude: 14.599 + index * .001, longitude: 120.989 + index * .001, amenities: ['wifi'], house_rules: 'Quiet at night.', photos: [{ id: index + 1, url: '/images/demo/twin-room.webp', caption: 'Student room' }], room_options: [{ ...room, id: 11 + index * 10 }, ...(index === 1 ? [{ ...room, id: 22, name: 'Upper-floor twin room', monthly_rent_centavos: 600000 }] : [])] }))

async function fixture(page, role = 'guest') {
  const state = { comparisons: [], routes: [], fail: false, hold: false, held: null }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64') }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data, meta: { total: properties.length, last_page: 1 } } })
    if (path.endsWith('/me')) return role === 'guest' ? route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }) : json({ id: 987, name: 'Alex Reviewer', role })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    if (path.endsWith('/campuses')) return json(campuses)
    if (path.endsWith('/compare')) {
      const body = request.postDataJSON(); state.comparisons.push(body)
      return json(body.selections.map(selection => { const property = properties.find(property => property.id === selection.property_id); return { ...property, alternative_room_options: property.room_options, room_options: [property.room_options.find(room => room.id === selection.room_option_id)], distance_from_campus: { campus_id: 8, meters: 123 } } }))
    }
    const id = Number(path.match(/\/listings\/(\d+)/)?.[1])
    if (path.endsWith('/walking-route')) {
      const campusId = Number(url.searchParams.get('campus_id'))
      state.routes.push({ id, campusId })
      if (state.hold && campusId === 8) await new Promise(resolve => { state.held = resolve })
      if (state.fail && id === 2) return route.fulfill({ status: 503, json: { message: 'Walking provider is temporarily unavailable.' } })
      const campus = campuses.find(campus => campus.id === campusId), property = properties.find(property => property.id === id)
      return json({ distance_meters: (campusId === 8 ? 500 : 800) + id * 100, duration_seconds: (campusId === 8 ? 360 : 600) + id * 60, geometry: { type: 'LineString', coordinates: [[property.longitude, property.latitude], [campus.longitude, property.latitude], [campus.longitude, campus.latitude]] } })
    }
    return json(id ? properties.find(property => property.id === id) : properties)
  })
  return state
}
async function destination(page, text) {
  const input = page.getByRole('combobox', { name: 'Walking destination', exact: true })
  await input.fill(text)
  await page.getByRole('option').first().click()
}

test('two distinct listings are required before entry and removing one keeps the remaining selection', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/listings')
  await page.locator('#listing-card-1').getByRole('checkbox').check()
  const tray = page.getByRole('region', { name: 'Your comparison selection' })
  await expect(tray.getByRole('button', { name: 'Select one more' })).toBeDisabled()
  await expect(tray.getByRole('link')).toHaveCount(0)
  await page.locator('#listing-card-2').getByRole('checkbox').check()
  await tray.getByRole('link', { name: 'Compare 2 listings' }).click()
  await expect(page.getByRole('table').first()).toBeVisible()
  await page.getByRole('button', { name: 'Remove Single-option residence', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose at least two listings' })).toBeVisible()
  await page.getByRole('link', { name: 'Choose another listing' }).click()
  await expect(page.locator('#listing-card-2').getByRole('checkbox')).toBeChecked()
  await page.goto('/compare?items=1:11')
  await expect(page.getByRole('heading', { name: 'Choose at least two listings' })).toBeVisible()
  expect(state.comparisons).toHaveLength(1)
})

test('campus search updates walking values, links and highlighted paths together without a default campus', async ({ page }, testInfo) => {
  const state = await fixture(page)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/compare?items=1:11,2:21')
  const table = page.getByRole('table', { name: 'Selected room essentials' })
  await expect(table).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Walking destination', exact: true })).toHaveValue('')
  await expect(table).not.toContainText('TIP Manila')
  expect(state.routes).toHaveLength(0)
  expect(state.comparisons[0].campus_id).toBeUndefined()
  await expect(table.locator('thead tr').first().locator('th').first()).toContainText('Selected places')
  await expect(table.locator('.comparison-room-row th').first()).toHaveText('Room comparison')
  await destination(page, 'CEU')
  await expect(page).toHaveURL(/campus_id=9/)
  const walk = table.getByRole('row', { name: /Walk to campus/ })
  await expect(walk).toContainText('About 11 min walk · 900 m')
  await expect(walk).toContainText('About 12 min walk · 1.0 km')
  await expect(table).toContainText('Shortest walk to campus')
  await expect(table).not.toContainText('straight-line')
  const map = page.getByRole('region', { name: 'Listing map', exact: true })
  await expect(map.locator('.walking-route-path')).toHaveCount(1)
  await expect(map.locator('.campus-marker')).toHaveAttribute('title', /CEU/)
  await table.getByRole('button', { name: 'Show walking route from Residence with a choice of rooms' }).click()
  await expect(page.locator('.comparison-route-summary')).toContainText('Residence with a choice of rooms to CEU')
  await expect(table.getByRole('link', { name: 'View room' }).first()).toHaveAttribute('href', /campus_id=9/)
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(table).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    if ([1440, 390].includes(width)) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `../.local/comparison-walking-${testInfo.project.name}-${width}.png`, fullPage: true }) }
  }
  await destination(page, 'TIP')
  await expect(walk).toContainText('About 7 min walk · 600 m')
  await expect(walk).toContainText('About 8 min walk · 700 m')
  await expect(map.locator('.campus-marker')).toHaveAttribute('title', /TIP/)
  await page.getByRole('combobox', { name: 'Walking destination', exact: true }).fill('CEU')
  await expect(walk).toContainText('Choose a campus above')
  await expect(map.locator('.walking-route-path')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('partial routing failures retain the working route and retry only missing estimates', async ({ page }) => {
  const state = await fixture(page); state.fail = true
  await page.goto('/compare?items=1:11,2:21&campus_id=9')
  await expect(page.getByRole('row', { name: /Walk to campus/ })).toContainText('Walking provider is temporarily unavailable.')
  await expect(page.getByRole('row', { name: /Walk to campus/ })).toContainText('900 m')
  await expect(page.getByText('Shortest walk to campus', { exact: true })).toHaveCount(0)
  state.fail = false
  await page.getByRole('button', { name: 'Retry walking estimates' }).click()
  await expect(page.getByRole('row', { name: /Walk to campus/ })).toContainText('1.0 km')
  expect(state.routes.filter(route => route.id === 1)).toHaveLength(1)
  expect(state.routes.filter(route => route.id === 2)).toHaveLength(2)
})

test('changing campus during a pending request cannot restore old table values or routes', async ({ page }) => {
  const state = await fixture(page); state.hold = true
  await page.goto('/compare?items=1:11,2:21&campus_id=8')
  await expect.poll(() => !!state.held).toBe(true)
  await destination(page, 'CEU')
  await expect(page.getByRole('row', { name: /Walk to campus/ })).toContainText('900 m')
  state.held()
  await expect(page.getByRole('row', { name: /Walk to campus/ })).not.toContainText('600 m')
  await expect(page.locator('.comparison-route-summary')).toContainText('CEU')
  expect(state.routes.filter(route => route.campusId === 8)).toHaveLength(1)
})

test('admin browse aligns single-option and multiple-option card actions', async ({ page }, testInfo) => {
  await fixture(page, 'admin')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings')
  const first = page.locator('#listing-card-1').getByRole('button', { name: 'Show on map' })
  const second = page.locator('#listing-card-2').getByRole('button', { name: 'Show on map' })
  await expect(first).toBeVisible(); await expect(second).toBeVisible()
  expect(Math.abs((await first.boundingBox()).y - (await second.boundingBox()).y)).toBeLessThan(1)
  await page.screenshot({ path: `../.local/admin-card-alignment-${testInfo.project.name}.png` })
})
