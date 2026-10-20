import { test, expect } from '@playwright/test'

async function fixture(page, role, { empty = false, broken = false } = {}) {
  const room = { id: 21, name: 'Twin student beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 2, available_units: 1, monthly_rent_centavos: 400000, deposit_centavos: 400000, advance_months: 1, fees: [], monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, utilities_notes: 'Water included, electricity metered.', availability_stale: false, availability_confirmed_at: '2026-10-20T01:00:00Z' }
  const property = { id: 55, title: 'Sampaloc Study House', property_type: 'dormitory', description: 'A fictional student residence used to check the guided walkthrough. This is not a real offer.', city: 'Manila', address: 'Fictional Sampaloc street', latitude: 14.6, longitude: 120.99, amenities: ['wifi'], house_rules: 'Quiet at night.', status: role === 'landlord' ? 'draft' : 'approved', revision: 1, photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional student room', status: 'ready' }], room_options: [room] }
  const state = { writes: [], errors: [] }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (request.method() !== 'GET') { state.writes.push({ path, method: request.method() }); return route.abort('blockedbyclient') }
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: Array.isArray(data) ? data.length : 1 }, total: 0, last_page: 1 } })
    if (path === '/me') return json({ id: 987, name: 'Jamie Learner', email: 'learner@example.test', role })
    if (path === '/notifications/unread-count') return json({ unread_count: 0 })
    if (path === '/campuses') return json([{ id: 8, name: 'West University', institution_name: 'West University', city: 'Manila', latitude: 14.6, longitude: 120.99 }])
    if (path === '/listings' || path === '/landlord/properties') return broken ? route.fulfill({ status: 503, json: { message: 'Synthetic directory unavailable.' } }) : json(empty ? [] : [property])
    if (path === '/listings/55' || path === '/landlord/properties/55') return json(property)
    if (path === '/listings-map') return json([property])
    return json([])
  })
  return state
}
async function start(page, path = '/listings') {
  await page.goto(path)
  await page.getByRole('button', { name: 'Start walkthrough', exact: true }).click()
  const intro = page.getByRole('dialog', { name: /A little tour|Let’s make room|Get to know/ })
  await expect(intro).toBeVisible()
  await intro.getByRole('button', { name: 'Start walkthrough', exact: true }).click()
}
const tour = page => page.locator('.walkthrough-layer')
const coach = page => page.locator('.walkthrough-coach')

for (const role of ['student', 'landlord', 'admin']) test(`${role} walkthrough highlights real screens and never writes tutorial data`, async ({ page }, testInfo) => {
  const state = await fixture(page, role)
  await start(page, role === 'landlord' ? '/landlord' : role === 'admin' ? '/admin' : '/listings')
  const visited = []
  while (await tour(page).getAttribute('data-walkthrough-step') !== 'complete') {
    const key = await tour(page).getAttribute('data-walkthrough-step')
    expect(visited).not.toContain(key)
    visited.push(key)
    await expect(page.locator('.walkthrough-spotlight')).toBeVisible()
    const rect = await coach(page).boundingBox()
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThanOrEqual(0)
    expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize().width + 1)
    expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize().height + 1)
    if (['search', 'room', 'photos', 'availability', 'reviews'].includes(key)) await page.screenshot({ path: `../.local/walkthrough-${role}-${key}-${testInfo.project.name}.png`, fullPage: false })
    await coach(page).getByRole('button', { name: /^(Next|Finish tour)/ }).click()
    await expect(tour(page)).not.toHaveAttribute('data-walkthrough-step', key)
  }
  await expect(coach(page)).toContainText('You know your way around')
  await coach(page).getByRole('button', { name: /Start exploring|Go to my properties|Go to reviews/ }).click()
  await expect(tour(page)).toHaveCount(0)
  expect(state.writes).toEqual([])
  expect(state.errors).toEqual([])
  expect(visited).toContain(role === 'student' ? 'room' : role === 'landlord' ? 'photos' : 'audit')
})

test('walkthrough works inside filters, follows an opened listing, and resumes after reload', async ({ page }) => {
  const state = await fixture(page, 'student')
  await start(page)
  await page.getByRole('combobox', { name: 'Campus, location or listing' }).fill('Sampaloc')
  await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: /^Filters/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Find your fit' })
  await expect(drawer.locator('.walkthrough-coach')).toBeVisible()
  await drawer.getByLabel('Price basis', { exact: true }).selectOption('per_person')
  await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  await page.locator('.listing-grid .property-card').getByRole('heading').getByRole('link').click()
  await expect(tour(page)).toHaveAttribute('data-walkthrough-step', 'room')
  await coach(page).getByRole('button', { name: 'Back', exact: true }).click()
  await expect(tour(page)).toHaveAttribute('data-walkthrough-step', 'open-place')
  await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  await coach(page).getByRole('button', { name: 'Pause walkthrough' }).click()
  await expect(tour(page)).toHaveCount(0)
  await page.reload()
  await page.locator('.site-header').getByRole('button', { name: 'Resume walkthrough' }).click()
  await expect(tour(page)).toHaveAttribute('data-walkthrough-step', 'room')
  await page.keyboard.press('Escape')
  await expect(tour(page)).toHaveCount(0)
  await expect(page.locator('.site-header .walkthrough-help')).toBeFocused()
  expect(state.writes).toEqual([])
})

test('new owners have a useful tour without creating a property', async ({ page }) => {
  const state = await fixture(page, 'landlord', { empty: true })
  await start(page, '/landlord')
  for (const key of ['workspace', 'add-property', 'basics', 'private-draft']) {
    await expect(tour(page)).toHaveAttribute('data-walkthrough-step', key)
    await expect(page.locator('.walkthrough-spotlight')).toBeVisible()
    await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  }
  await expect(tour(page)).toHaveAttribute('data-walkthrough-step', 'messages')
  expect(state.writes).toEqual([])
})

test('unavailable catalogs still allow a tour of the main screens and retry', async ({ page }) => {
  const state = await fixture(page, 'student', { broken: true })
  await page.goto('/listings')
  await page.locator('.site-header').getByRole('button', { name: 'Start walkthrough' }).click()
  await expect(coach(page)).toContainText('Some listing details could not load')
  await coach(page).getByRole('button', { name: 'Try again', exact: true }).click()
  await coach(page).getByRole('button', { name: 'Start walkthrough', exact: true }).click()
  for (const key of ['search', 'filters', 'open-place', 'saved']) {
    await expect(tour(page)).toHaveAttribute('data-walkthrough-step', key)
    await expect(page.locator('.walkthrough-spotlight')).toBeVisible()
    await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  }
  expect(state.writes).toEqual([])
})

test('walkthrough protects existing edits and leaves a tried message unsent', async ({ page }) => {
  const state = await fixture(page, 'student')
  await page.goto('/profile')
  await page.getByLabel('Your name', { exact: true }).fill('Jamie New Name')
  let warnings = 0
  page.on('dialog', async dialog => { warnings++; await dialog.accept() })
  await page.locator('.site-header').getByRole('button', { name: 'Start walkthrough' }).click()
  await expect.poll(() => warnings).toBe(1)
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Jamie New Name')
  await page.reload()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Jamie Learner')
  await page.locator('.site-header').getByRole('button', { name: 'Start walkthrough' }).click()
  await coach(page).getByRole('button', { name: 'Start walkthrough', exact: true }).click()
  while (await tour(page).getAttribute('data-walkthrough-step') !== 'contact') await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Message owner', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Message owner', exact: true })
  await expect(dialog.locator('.walkthrough-coach')).toBeVisible()
  await dialog.getByLabel('Your question').fill('Can I see the study space on a visit?')
  await coach(page).getByRole('button', { name: 'Pause walkthrough' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Your question')).toHaveValue('Can I see the study space on a visit?')
  await dialog.getByRole('button', { name: 'Close message owner' }).click()
  await page.locator('.site-header').getByRole('button', { name: 'Resume walkthrough' }).click()
  await page.getByRole('button', { name: 'Message owner', exact: true }).click()
  await expect(dialog).toBeVisible()
  await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(tour(page)).toHaveAttribute('data-walkthrough-step', 'saved')
  expect(await page.evaluate(() => sessionStorage.getItem('dormfinder-inquiry-987-55-21'))).toContain('study space')
  expect(state.writes).toEqual([])
})

test('notification window can be opened and expanded during its tour step', async ({ page }) => {
  const state = await fixture(page, 'admin')
  await start(page, '/admin')
  while (await tour(page).getAttribute('data-walkthrough-step') !== 'notifications') await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(page.locator('.notification-popover')).toBeVisible()
  await page.getByRole('button', { name: /Expand notifications/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Notifications', exact: true })
  await expect(dialog.locator('.walkthrough-coach')).toBeVisible()
  await coach(page).getByRole('button', { name: 'Finish tour' }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes).toEqual([])
})

test('phone and short-screen walkthrough controls stay reachable with reduced motion', async ({ page }, testInfo) => {
  await fixture(page, 'student')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 568 })
  await start(page)
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 480 }, { width: 768, height: 900 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => { const box = await coach(page).boundingBox(); return box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1 }).toBe(true)
    await page.screenshot({ path: `../.local/walkthrough-phone-${testInfo.project.name}-${viewport.width}.png` })
    await coach(page).getByRole('button', { name: 'Next', exact: true }).click()
  }
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement.closest('.walkthrough-coach') || !!document.querySelector('[data-tour="room-choice"]')?.contains(document.activeElement))).toBe(true)
})
