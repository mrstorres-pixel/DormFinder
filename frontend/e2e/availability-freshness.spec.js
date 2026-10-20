import { test, expect } from '@playwright/test'

const room = { id: 21, name: 'Twin student beds', capacity: 2, total_units: 4, available_units: 2, inventory_type: 'bedspace', price_basis: 'per_person', monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, deposit_centavos: 400000, advance_months: 1, fees: [], availability_confirmed_at: '2026-10-01T00:00:00Z', availability_age_days: 18, availability_stale: true, availability_expired: false }
const listing = { id: 55, title: 'Fictional Campus Residence', description: 'A fictional property used to test availability confirmation and private conversations.', city: 'Manila', address: 'Fictional test street', property_type: 'dormitory', status: 'approved', revision: 1, amenities: [], photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional room illustration', status: 'ready' }], room_options: [room] }

async function fixture(page, role = 'student') {
  const state = { writes: [], fail: true, property: structuredClone(listing), unread: 1 }
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: 1 } } })
    if (path.endsWith('/me')) return role === 'guest' ? route.fulfill({ status: 401 }) : json({ id: 9, name: 'Test ' + role, role })
    if (path.endsWith('/unread-count')) return json({ unread_count: role === 'landlord' ? state.unread : 0 })
    if (path.endsWith('/campuses')) return json([{ id: 8, name: 'TIP Manila', latitude: 14.59, longitude: 120.99 }])
    if (path.endsWith('/viewings') || path.endsWith('/saved-places')) return json([])
    if (path.endsWith('/availability')) {
      state.writes.push(request.postDataJSON())
      if (state.fail) return route.fulfill({ status: 503, json: { message: 'Temporary availability failure.' } })
      const fresh = { availability_confirmed_at: new Date().toISOString(), availability_age_days: 0, availability_stale: false, availability_expired: false }
      Object.assign(state.property.room_options[0], fresh, { available_units: request.postDataJSON().options[0].available_units })
      Object.assign(state.property, { revision: 2, availability: { status: 'current', rooms_needing_confirmation: 0, hidden_rooms: 0, last_confirmed_at: fresh.availability_confirmed_at, hides_at: new Date(Date.now() + 30 * 86400000).toISOString() } })
      state.unread = 0
      return json(state.property)
    }
    if (path.endsWith('/inquiries') && request.method() === 'POST') {
      state.writes.push(request.postDataJSON())
      if (state.fail) return route.fulfill({ status: 503, json: { message: 'Temporary message failure.' } })
      return json({ id: 14 })
    }
    if (path.endsWith('/landlord/properties/55') || path.endsWith('/listings/55')) return json(state.property)
    if (path.endsWith('/landlord/properties') || path.endsWith('/listings') || path.endsWith('/listings-map')) return json([state.property])
    return json([])
  })
  return state
}

test('students see room freshness and explicitly send a suggested availability question without losing failed drafts', async ({ page }, testInfo) => {
  const state = await fixture(page)
  await page.goto('/listings?campus_id=8&price_basis=per_person&max_rent_centavos=600000')
  const card = page.locator('.property-card').first()
  await expect(card.getByText('Last confirmed 18 days ago')).toBeVisible()
  await page.screenshot({ path: `../.local/availability-browse-${testInfo.project.name}.png`, fullPage: true })
  await card.getByRole('link', { name: 'Ask owner', exact: true }).click()
  await expect(page).toHaveURL(/option=21&campus_id=8#confirm-availability$/)
  await expect(page.getByRole('link', { name: /Browse listings/ })).toHaveAttribute('href', /max_rent_centavos=600000/)
  const dialog = page.getByRole('dialog', { name: 'Message owner' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Your question')).toHaveValue(/is Twin student beds still available/)
  expect(state.writes).toHaveLength(0)
  await dialog.getByLabel('Your question').fill('Hi, are two beds still available for next month?')
  await dialog.getByRole('button', { name: 'Send private inquiry' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByLabel('Your question')).toHaveValue('Hi, are two beds still available for next month?')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/availability-question-${testInfo.project.name}.png` })
  state.fail = false
  await dialog.getByRole('button', { name: 'Send private inquiry' }).click()
  await expect(page).toHaveURL(/inquiries\/14$/)
  expect(state.writes[0]).toEqual(state.writes[1])
  expect(state.writes[1].room_option_id).toBe(21)
})

test('owners see hidden listings and can reconfirm actual vacancies with retry and immediate bell refresh', async ({ page }, testInfo) => {
  const state = await fixture(page, 'landlord')
  Object.assign(state.property.room_options[0], { availability_age_days: 31, availability_expired: true })
  state.property.availability = { status: 'hidden', rooms_needing_confirmation: 1, hidden_rooms: 1 }
  await page.goto('/landlord')
  await expect(page.getByText('Hidden from students', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Refresh availability' }).click()
  await expect(page).toHaveURL(/55#rooms$/)
  const form = page.locator('.vacancy-form')
  await expect(form.getByText('Confirmation expired', { exact: true })).toBeVisible()
  await page.screenshot({ path: `../.local/availability-hidden-owner-${testInfo.project.name}.png`, fullPage: true })
  await form.getByLabel('Available units for Twin student beds').fill('3')
  await form.getByRole('button', { name: 'Confirm vacancies today' }).click()
  await expect(form.getByRole('alert')).toBeVisible()
  await expect(form.getByLabel('Available units for Twin student beds')).toHaveValue('3')
  state.fail = false
  await form.getByRole('button', { name: 'Confirm vacancies today' }).click()
  await expect(page.getByText('Availability is up to date', { exact: true })).toBeVisible()
  await expect(form.getByText('Confirmed today', { exact: true })).toBeVisible()
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0)
  expect(state.writes[1]).toEqual({ revision: 1, options: [{ id: 21, available_units: 3 }] })
  expect(state.property.status).toBe('approved')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/availability-owner-${testInfo.project.name}.png`, fullPage: true })
})

test('owners can mark every room taken with zero vacancies and get an explicit sold-out status', async ({ page }) => {
  const state = await fixture(page, 'landlord')
  state.fail = false
  await page.goto('/landlord/properties/55#rooms')
  const form = page.locator('.vacancy-form')
  await form.getByLabel('Available units for Twin student beds').fill('0')
  await form.getByRole('button', { name: 'Confirm vacancies today' }).click()
  await expect(page.getByText('All room options are taken', { exact: true })).toBeVisible()
  await expect(form.getByRole('status')).toContainText('Marked sold out')
  expect(state.writes).toEqual([{ revision: 1, options: [{ id: 21, available_units: 0 }] }])
  expect(state.property.status).toBe('approved')
})

test('guests retain the chosen room and availability question through the sign-in shortcut', async ({ page }) => {
  await fixture(page, 'guest')
  await page.goto('/listings/55?option=21&campus_id=8')
  const link = page.getByRole('link', { name: 'Ask owner to confirm', exact: true })
  const href = await link.getAttribute('href')
  expect(decodeURIComponent(href)).toContain('/listings/55?option=21&campus_id=8#confirm-availability')
  await link.click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
})
