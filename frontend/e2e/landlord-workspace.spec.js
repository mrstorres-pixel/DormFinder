import { test, expect } from '@playwright/test'

const room = { id: 21, name: 'Shared beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 4, available_units: 2, monthly_rent_centavos: 400000, deposit_centavos: 400000, advance_months: 1, fees: [], monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, utilities_notes: 'Electricity is metered separately.', availability_confirmed_at: '2026-10-16T00:00:00Z', availability_stale: false }
async function owner(page, overrides = {}) {
  const state = { failCreate: false, failSave: false, failSubmit: false, writes: [], property: { id: 55, title: 'Fictional Campus House', description: 'An explicitly fictional residence used to verify this guided editor.', property_type: 'dormitory', city: 'Manila', address: 'Sample test address', latitude: 14.6, longitude: 120.99, amenities: ['wifi'], house_rules: 'Quiet after 10pm.', status: 'draft', revision: 1, photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional room illustration', status: 'ready' }], room_options: [room], ...overrides } }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1 } } })
    if (path.endsWith('/me')) return json({ id: 987, name: 'Jamie Owner', role: 'landlord' })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    if (request.method() !== 'GET') state.writes.push({ path, body: request.headers()['content-type']?.includes('multipart/form-data') ? 'photo upload' : request.postDataJSON() })
    if (path.endsWith('/landlord/properties') && request.method() === 'POST') {
      if (state.failCreate) return route.fulfill({ status: 422, json: { message: 'Choose a different name.', errors: { title: ['This name needs review.'] } } })
      Object.assign(state.property, request.postDataJSON(), { description: '', address: '', photos: [], room_options: [], latitude: null, longitude: null })
      return json(state.property)
    }
    if (path.endsWith('/campuses')) return json([{ id: 8, name: 'West University', institution_name: 'West University', city: 'Manila', latitude: 14.6, longitude: 120.99 }])
    if (path.endsWith('/photos') && request.method() === 'POST') { state.property.photos = [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional twin room', status: 'ready' }]; state.property.revision++; return json(state.property.photos[0]) }
    if (path.endsWith('/room-options') && request.method() === 'POST') { state.property.room_options = [{ ...room, ...request.postDataJSON() }]; state.property.revision++; return json(state.property) }
    if (path.endsWith('/submit')) {
      if (state.failSubmit) return route.fulfill({ status: 409, json: { message: 'The listing changed. Review it before retrying.' } })
      state.property.status = 'pending_review'; state.property.revision++
      return json(state.property)
    }
    if (path.endsWith('/landlord/properties/55')) {
      if (request.method() === 'PATCH') {
        if (state.saveDelay) await new Promise(resolve => setTimeout(resolve, state.saveDelay))
        if (state.failSave) return route.fulfill({ status: 503, json: { message: 'Synthetic save failure.' } })
        Object.assign(state.property, request.postDataJSON(), { revision: state.property.revision + 1 })
      }
      return json(state.property)
    }
    if (path.endsWith('/landlord/properties')) return json([state.property])
    return json([])
  })
  return state
}
const step = (page, name) => page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name, exact: true }).click()

test('creation guides required photos, rooms, location and review instead of a disabled dead end', async ({ page }, testInfo) => {
  const state = await owner(page)
  await page.goto('/landlord/properties/new')
  await page.getByLabel('Property name').fill('New fictional residence')
  state.failCreate = true
  await page.getByRole('button', { name: 'Start listing' }).click()
  await expect(page.getByRole('alert')).toContainText('This name needs review.')
  state.failCreate = false
  await page.getByRole('button', { name: 'Start listing' }).click()
  await expect(page).toHaveURL(/#photos$/)
  await step(page, 'Preview & review')
  await expect(page.getByRole('alert')).toContainText('Add at least one ready photo')
  await expect(page).toHaveURL(/#photos$/)
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'fixture.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') })
  await page.getByLabel('Photo description').fill('Fictional twin room')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Upload your selected photo')
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/#rooms$/)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Add room options and charges')
  await page.getByLabel('Room option name').fill('Twin beds')
  await page.getByLabel('Monthly rent (PHP)').fill('4000')
  await page.getByLabel('Utilities and other charge terms').fill('Water is included. Electricity is metered.')
  await page.getByRole('button', { name: 'Add room option', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Twin beds', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/#location$/)
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(page.getByRole('alert')).toContainText('required fields')
  await expect(page.getByLabel('About the property')).toBeFocused()
  await page.getByLabel('About the property').fill('A complete description of this fictional residence for student living.')
  await page.getByLabel('Street address').fill('Fictional sample street')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(page.getByRole('alert')).toContainText('Place the property pin')
  await page.getByRole('button', { name: 'Choose location on map' }).click()
  const map = page.getByRole('region', { name: 'Property location picker' })
  await expect(map.locator('.leaflet-container')).toHaveCount(0)
  await expect(map).toHaveClass(/leaflet-container/)
  await expect(map.locator('.owner-property-pin')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Find a nearby campus or city' }).fill('West')
  await page.getByRole('combobox', { name: 'Find a nearby campus or city' }).press('Enter')
  await expect(map.locator('.owner-property-pin')).toHaveCount(0)
  await map.click({ position: { x: 180, y: 180 } })
  await expect(map.locator('.owner-property-pin svg')).toHaveCount(1)
  await expect(page.getByLabel('Latitude')).not.toHaveValue('')
  await expect(page.getByLabel('Longitude')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(page).toHaveURL(/#preview$/)
  await expect(page.getByRole('heading', { name: 'Ready for review', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Confirm that the room options')
  expect(state.writes.filter(write => write.path.endsWith('/submit'))).toHaveLength(0)
  await page.getByLabel('These options describe separate inventory and do not double-count the same beds or rooms.').check()
  state.failSubmit = true
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The listing changed.')
  state.failSubmit = false
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'In review', exact: true })).toBeVisible()
  await step(page, 'Location & details')
  await expect(page.getByLabel('Property name')).toBeDisabled()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local/owner-polished-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
})

test('partial draft save returns to My space; failed save retains details and pin', async ({ page }) => {
  const state = await owner(page)
  await page.goto('/landlord/properties/55#location')
  await page.getByLabel('Property name').fill('Saved partial draft')
  await page.getByLabel('About the property').fill('')
  await page.getByLabel('Street address').fill('')
  await page.getByLabel('Latitude').fill('14.61')
  state.failSave = true
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic save failure.')
  await expect(page.getByLabel('Property name')).toHaveValue('Saved partial draft')
  await expect(page.getByLabel('Latitude')).toHaveValue('14.61')
  state.failSave = false
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/landlord$/)
  await expect(page.getByRole('status')).toContainText('Your draft has been saved.')
  await expect(page.getByRole('heading', { name: 'Saved partial draft' })).toBeVisible()
  await page.getByRole('link', { name: 'Manage property', exact: false }).click()
  await expect(page.getByLabel('About the property')).toHaveValue('')
})

test('preview explains missing requirements and unsaved photo edits cannot be skipped', async ({ page }) => {
  const state = await owner(page, { description: '', address: '', latitude: null, longitude: null, photos: [], room_options: [] })
  await page.goto('/landlord/properties/55#preview')
  const readiness = page.getByRole('region', { name: 'Prepare for listing review' })
  await expect(readiness).toContainText('required items')
  await readiness.getByRole('button', { name: 'Finish required details' }).click()
  await expect(page).toHaveURL(/#photos$/)
  await page.getByLabel('Photo description').fill('An unsent photo edit')
  await step(page, 'Preview & review')
  await expect(page.getByRole('alert')).toContainText('Upload your selected photo')
  await expect(page.getByLabel('Photo description')).toHaveValue('An unsent photo edit')
  await page.getByRole('link', { name: 'Your properties', exact: false }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(page.getByLabel('Photo description')).toHaveValue('An unsent photo edit')
  expect(state.writes).toHaveLength(0)
})
