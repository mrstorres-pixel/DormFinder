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
    if (request.method() !== 'GET') state.writes.push({ path, body: request.postDataJSON() })
    if (path.endsWith('/landlord/properties') && request.method() === 'POST') {
      if (state.failCreate) return route.fulfill({ status: 422, json: { message: 'Choose a different name.', errors: { title: ['This name needs review.'] } } })
      Object.assign(state.property, request.postDataJSON(), { description: '', address: '', photos: [], room_options: [], latitude: null, longitude: null })
      return json(state.property)
    }
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

test('step navigation waits for saved revisions before another editor action', async ({ page }) => {
  const state = await owner(page)
  state.saveDelay = 400
  await page.goto('/landlord/properties/55#location')
  await page.getByLabel('Property name').fill('First saved revision')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const photos = page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Photos', exact: true })
  await expect(photos).toBeDisabled()
  await photos.click()
  expect(state.property.revision).toBe(2)
  await step(page, 'Location & details')
  await page.getByLabel('Street address').fill('Second saved revision')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await step(page, 'Photos')
  expect(state.property.revision).toBe(3)
  expect(state.writes.filter(write => write.path.endsWith('/55')).map(write => write.body.revision)).toEqual([1, 2])
})

test('minimal draft creation leads to photos and editor steps retain every unsaved form', async ({ page }) => {
  const state = await owner(page)
  state.failCreate = true
  await page.goto('/landlord/properties/new')
  await page.getByLabel('Property name').fill('New fictional residence')
  await expect(page.getByLabel('About the property')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('This name needs review.')
  await expect(page.getByLabel('Property name')).toHaveValue('New fictional residence')
  state.failCreate = false
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/landlord\/properties\/55#photos$/)
  expect(state.writes.at(-1).body).toEqual({ title: 'New fictional residence', property_type: 'dormitory', city: 'Manila' })
  await page.getByLabel('Photo description').fill('Unsent photo description')
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'retained.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture only') })
  await step(page, 'Rooms & costs')
  await page.getByLabel('Room option name').fill('Unsent twin beds')
  await step(page, 'Location & details')
  await page.getByLabel('About the property').fill('Unsent description that must stay in its own step while reviewing saved information.')
  await step(page, 'Preview & review')
  await expect(page.getByRole('region', { name: 'Prepare for listing review' })).toContainText('Add at least one ready photo')
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Saved listing preview' })).not.toContainText('Unsent description')
  await page.getByRole('button', { name: 'Add the street address', exact: false }).click()
  await expect(page.getByLabel('About the property')).toHaveValue('Unsent description that must stay in its own step while reviewing saved information.')
  await page.goBack()
  await expect(page).toHaveURL(/#preview$/)
  await step(page, 'Photos')
  await expect(page.getByLabel('Photo description')).toHaveValue('Unsent photo description')
  expect(await page.getByLabel('Choose a photo').evaluate(input => input.files[0].name)).toBe('retained.jpg')
  await step(page, 'Rooms & costs')
  await expect(page.getByLabel('Room option name')).toHaveValue('Unsent twin beds')
  await page.getByRole('link', { name: 'Your properties', exact: false }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(page.getByLabel('Room option name')).toHaveValue('Unsent twin beds')
  expect(state.writes).toHaveLength(2)
})

test('saved preview, failed saves, review retry and readonly review state stay connected', async ({ page }, testInfo) => {
  const state = await owner(page, { status: 'rejected', moderation_reason: 'Clarify the room description before submitting again.' })
  await page.goto('/landlord/properties/55')
  await expect(page.getByText('Review feedback: Clarify the room description before submitting again.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ready for review' })).toBeVisible()
  await step(page, 'Location & details')
  await page.getByLabel('Property name').fill('Updated fictional house')
  state.failSave = true
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic save failure.')
  await step(page, 'Photos')
  await step(page, 'Location & details')
  await expect(page.getByLabel('Property name')).toHaveValue('Updated fictional house')
  state.failSave = false
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Your draft has been saved.')
  await step(page, 'Preview & review')
  await expect(page.getByRole('region', { name: 'Saved listing preview' })).toContainText('Updated fictional house')
  await expect.poll(() => page.locator('.owner-preview .gallery-expand img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local/owner-preview-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
  await page.getByLabel('These options describe separate inventory and do not double-count the same beds or rooms.').check()
  state.failSubmit = true
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The listing changed.')
  state.failSubmit = false
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'In review', exact: true })).toBeVisible()
  await step(page, 'Location & details')
  await expect(page.getByLabel('Property name')).toBeDisabled()
  await step(page, 'Rooms & costs')
  await expect(page.getByRole('button', { name: 'Add room option', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Room edits are locked while this listing is pending review.')).toBeVisible()
})

test('review submission cannot replace an unsaved photo draft even when saved listing is complete', async ({ page }) => {
  const state = await owner(page)
  await page.goto('/landlord/properties/55#photos')
  await page.getByLabel('Photo description').fill('Unsent photo edit')
  await step(page, 'Preview & review')
  await page.getByLabel('These options describe separate inventory and do not double-count the same beds or rooms.').check()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  expect(state.writes).toHaveLength(0)
  await step(page, 'Photos')
  await expect(page.getByLabel('Photo description')).toHaveValue('Unsent photo edit')
})
