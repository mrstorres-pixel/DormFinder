import { test, expect } from '@playwright/test'

async function fixture(page, role = 'student') {
  const room = { id: 21, name: 'Twin beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 3, available_units: 2, monthly_rent_centavos: 400000, deposit_centavos: 400000, advance_months: 1, fees: [{ name: 'Internet', frequency: 'monthly', amount_centavos: 20000 }], monthly_fixed_total_centavos: 420000, move_in_fixed_total_centavos: 800000, utilities_notes: 'Water included. Electricity is metered.', availability_confirmed_at: new Date().toISOString(), availability_stale: false }
  const property = { id: 55, title: 'College Street Residence', status: role === 'landlord' ? 'draft' : 'approved', revision: 1, city: 'Manila', address: '12 College Street', property_type: 'dormitory', description: 'A student residence with a shared study area and access to transport.', latitude: 14.6, longitude: 120.99, amenities: ['wifi'], photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Twin bedroom' }, { id: 2, url: '/images/demo/shared-room.webp', caption: 'Shared bedroom' }], room_options: [room, { ...room, id: 22, name: 'Private room', inventory_type: 'whole_room', price_basis: 'per_room', monthly_rent_centavos: 800000 }] }
  const state = { property, writes: [], fail: false, delay: 0 }
  const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { total: Array.isArray(data) ? data.length : 1, current_page: 1, last_page: 1 } } })
    if (path.endsWith('/me')) return role === 'guest' ? route.fulfill({ status: 401 }) : json({ id: 7, name: 'Jamie Owner', role })
    if (path.endsWith('/campuses')) return json([{ id: 8, name: 'City University', institution_name: 'City University', city: 'Manila', latitude: 14.601, longitude: 120.991 }])
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    if (path.endsWith('/dashboard')) return json({})
    if (path.endsWith('/landlord/properties/55') && request.method() === 'PATCH') {
      state.writes.push(request.postDataJSON())
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
      if (state.fail) return route.fulfill({ status: 503, json: { message: 'Save temporarily unavailable.' } })
      Object.assign(property, request.postDataJSON(), { revision: property.revision + 1 }); return json(property)
    }
    if (path.endsWith('/landlord/properties/55') || path.endsWith('/listings/55')) return json(property)
    if (path.endsWith('/listings') || path.endsWith('/listings-map') || path.endsWith('/landlord/properties')) return json([property])
    return json([])
  })
  return state
}

test('Save and leave retains failed edits and follows the requested menu only after saving', async ({ page }) => {
  const state = await fixture(page, 'landlord'); state.fail = true
  await page.goto('/landlord/properties/55#location')
  await page.getByLabel('Street address', { exact: true }).fill('25 Entrance Street')
  await page.getByRole('link', { name: /Your properties/ }).click()
  const prompt = page.getByRole('dialog', { name: 'Keep your changes?' })
  await prompt.getByRole('button', { name: 'Save and leave', exact: true }).click()
  await expect(prompt.getByRole('alert')).toContainText('Your edits are kept')
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('25 Entrance Street')
  await expect(page).toHaveURL(/properties\/55#location/)
  state.fail = false; state.delay = 600
  await prompt.getByRole('button', { name: 'Save and leave', exact: true }).click()
  await expect(prompt.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(prompt.getByRole('button', { name: 'Discard and leave', exact: true })).toBeDisabled()
  await expect(page).toHaveURL(/\/landlord$/)
  expect(state.writes).toHaveLength(2)
  expect(state.writes[1]).toMatchObject({ address: '25 Entrance Street', revision: 1 })
})

test('Save changes stays in the editor and the signed-in landlord home link opens a new listing', async ({ page }) => {
  const state = await fixture(page, 'landlord')
  await page.goto('/landlord/properties/55#location')
  await page.getByLabel('Street address', { exact: true }).fill('Saved corrected entrance')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Your changes have been saved.' })).toBeVisible()
  await expect(page).toHaveURL(/properties\/55#location/)
  await expect(page.getByRole('button', { name: 'Cancel location changes' })).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'List your property', exact: true })).toHaveAttribute('href', '/landlord/properties/new')
  await expect(page.getByRole('link', { name: /Explore all listings/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'List your property', exact: true }).click()
  await expect(page).toHaveURL(/\/landlord\/properties\/new$/)
})

test('listing maps and detailed charges are visible and the photo viewer has readable solid surfaces', async ({ page }, testInfo) => {
  await fixture(page, 'guest')
  await page.goto('/listings/55')
  await expect(page.getByRole('region', { name: 'Listing map', exact: true })).toHaveClass(/leaflet-container/)
  await expect(page.getByRole('button', { name: 'Show map', exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Walking destination' })).toHaveAttribute('placeholder', 'Search campus')
  const costs = page.getByRole('region', { name: 'Costs and room terms' })
  await expect(costs).toContainText('Internet')
  await expect(costs).toContainText('Water included')
  expect(await costs.evaluate(element => !!element.closest('details'))).toBe(false)
  await page.getByRole('button', { name: /^Enlarge photo 1/ }).click()
  const viewer = page.getByRole('dialog', { name: 'Listing photos' })
  await expect(viewer).toHaveCSS('background-color', 'rgb(16, 29, 49)')
  await expect(viewer.locator('header')).toHaveCSS('background-color', 'rgb(24, 44, 72)')
  await expect(viewer.getByRole('heading')).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(viewer.getByRole('button', { name: 'Close listing photos' })).toHaveCSS('color', 'rgb(20, 35, 62)')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: `../.local/usability-gallery-${testInfo.project.name}-${width}.png` })
  }
  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)
})

test('map selection is a photo card with direct room choices and landing filters use a labeled control', async ({ page }, testInfo) => {
  await fixture(page, 'guest')
  await page.goto('/listings')
  await page.locator('#listing-card-55').getByRole('button', { name: 'Show on map' }).click()
  const preview = page.getByRole('article', { name: 'Selected map listing' })
  await expect(preview.getByRole('img')).toBeVisible()
  await preview.getByRole('button', { name: 'Next preview photo' }).click()
  await expect(preview.getByRole('img')).toHaveAttribute('alt', 'Shared bedroom')
  await preview.getByRole('button', { name: 'Private room', exact: true }).click()
  await expect(preview.getByRole('button', { name: 'Private room', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(preview.getByRole('link', { name: 'View listing', exact: true })).toHaveAttribute('href', /option=22/)
  await expect(preview.getByRole('button', { name: 'Room details', exact: true })).toHaveCount(0)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const box = await preview.boundingBox(); expect(box.width).toBeLessThanOrEqual(330)
    if (width !== 320) await page.screenshot({ path: `../.local/usability-map-card-${testInfo.project.name}-${width}.png` })
  }
  await page.goto('/')
  const filter = page.getByRole('button', { name: 'Filters', exact: true })
  await expect(filter).toHaveAttribute('aria-expanded', 'false')
  await filter.click()
  await page.getByLabel('Maximum monthly base rent (PHP)').fill('5000')
  await expect(page.getByRole('button', { name: 'Hide filters 1', exact: true })).toHaveAttribute('aria-expanded', 'true')
})

test('map preview stays attached to its price bubble through pan, zoom and resize', async ({ page }, testInfo) => {
  await fixture(page, 'guest')
  await page.goto('/listings')
  await page.locator('#listing-card-55').getByRole('button', { name: 'Show on map' }).click()
  const preview = page.getByRole('article', { name: 'Selected map listing' })
  async function attached() {
    await expect(preview).toBeVisible()
    await expect.poll(() => preview.evaluate(card => {
      const map = card.closest('.campus-map').getBoundingClientRect(), bubble = card.closest('.campus-map').querySelector('.price-marker.is-selected').getBoundingClientRect(), tip = card.closest('.listing-marker-popup').querySelector('.leaflet-popup-tip-container').getBoundingClientRect(), box = card.getBoundingClientRect()
      const gap = Math.abs(box.bottom - bubble.top), alignment = Math.abs(tip.x + tip.width / 2 - bubble.x - bubble.width / 2)
      return { attached: gap < 30 && alignment < 4, inside: box.top >= map.top - 2 && box.left >= map.left - 2 && box.right <= map.right + 2 && box.bottom <= map.bottom - 25, gap, alignment }
    })).toMatchObject({ attached: true, inside: true })
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await attached()
    await page.locator('.leaflet-control-zoom-in').click()
    await attached()
  }
  const map = await page.getByRole('region', { name: 'Listing map', exact: true }).boundingBox()
  await page.mouse.move(map.x + 20, map.y + map.height - 65)
  await page.mouse.down(); await page.mouse.move(map.x + 55, map.y + map.height - 65, { steps: 8 }); await page.mouse.up()
  await attached()
  await page.screenshot({ path: `../.local/anchored-map-${testInfo.project.name}.png` })
  await preview.getByRole('button', { name: 'Close listing preview' }).focus()
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
})

test('questionable overseas pins stay out of maps and notification previews identify the listing', async ({ page }) => {
  const state = await fixture(page)
  Object.assign(state.property, { latitude: 60, longitude: 30, location_check: { status: 'needs_correction', can_map: false } })
  await page.route(/\/api\/v1\/notifications(?:\?|$)/, route => route.fulfill({ json: { data: [{ id: 1, kind: 'viewing', title: 'Your viewing request has an update.', listing_title: state.property.title, path: '/viewings', created_at: new Date().toISOString(), read_at: null }] } }))
  await page.goto('/listings')
  await expect(page.locator('#listing-card-55')).toContainText('Location needs correction')
  await expect(page.getByRole('button', { name: 'Show on map' })).toHaveCount(0)
  await expect(page.locator('.price-marker,.price-cluster')).toHaveCount(0)
  await page.getByRole('button', { name: /^Notifications/ }).click()
  const notifications = page.getByRole('dialog', { name: 'Notifications', exact: true })
  await expect(notifications.locator('.notification-listing')).toHaveText(state.property.title)
  await expect(notifications.getByRole('link', { name: 'Your viewing request has an update.' })).toHaveAttribute('href', '/viewings')
})
