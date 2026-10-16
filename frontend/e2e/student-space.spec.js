import { test, expect } from '@playwright/test'

const campus = { id: 8, name: 'TIP Manila — P. Casal', institution_name: 'Technological Institute of the Philippines', city: 'Manila', slug: 'tip-manila-casal' }
const otherCampus = { id: 9, name: 'UP Diliman', institution_name: 'University of the Philippines', city: 'Quezon City', slug: 'up-diliman' }
const room = { id: 21, name: 'Twin room', capacity: 2, price_basis: 'per_person', inventory_type: 'bedspace', monthly_rent_centavos: 400000, available_units: 1, availability_stale: false }
const property = { id: 2, title: '[DEMO] Near Campus Twin Dorm', is_demo: true, room_options: [room], photos: [] }
const snapshot = { title: 'Synthetic campus residence', room_name: 'Twin room', room_option: room, address: 'Fictional sample address', city: 'Manila' }
const tomorrow = new Date(Date.now() + 86400000).toISOString()
const viewing = { id: 10, property_id: 2, room_option_id: 21, starts_at: tomorrow, requested_start: tomorrow, status: 'proposed', revision: 1, time_passed: false, can_schedule: true, listing_snapshot: snapshot, participant_name: 'Synthetic owner', student_note: '', owner_note: '' }

async function fixture(page, { populated = true, failed = false } = {}) {
  const state = { failed, dashboardRequests: 0, writes: 0, user: { id: 987, name: 'SYNTHETIC LONG STUDENT FULL NAME', email: 'synthetic@example.test', role: 'student', preferred_campus_id: 8 } }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, unavailable_ids: [] } } })
    if (path.endsWith('/me')) {
      if (request.method() === 'PATCH') { state.writes++; Object.assign(state.user, request.postDataJSON()); state.user.preferred_campus_id = Number(state.user.preferred_campus_id) || null }
      return json(state.user)
    }
    if (path.endsWith('/campuses')) return json([campus, otherCampus])
    if (path.endsWith('/dashboard')) { state.dashboardRequests++; return json({}) }
    if (path.endsWith('/saved-places')) return state.failed ? route.fulfill({ status: 503, json: { message: 'Synthetic saved-place outage.' } }) : json(populated ? [{ property_id: property.id, room_option_id: room.id, listing: property, contexts: [] }] : [])
    if (path.endsWith('/viewings')) return json(populated ? [url.searchParams.get('status') === 'accepted' ? { ...viewing, id: 12, status: 'accepted' } : viewing] : [])
    if (path.endsWith('/inquiries/7/messages')) return json([])
    if (path.endsWith('/inquiries/7')) return json({ id: 7, ...viewing, can_reply: true, property_status: 'approved' })
    if (path.endsWith('/inquiries')) return json(populated ? [{ id: 7, can_reply: true, awaiting_reply: true, listing_snapshot: snapshot, participant_name: 'Synthetic owner' }] : [])
    return json([])
  })
  return state
}

test('student space connects real actions without counters, on desktop and mobile', async ({ page }, testInfo) => {
  const state = await fixture(page)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Your space', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await expect(page.locator('.dashboard-counts')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()
  const saved = page.locator('.space-saved')
  await expect(saved.getByRole('heading', { name: property.title })).toBeVisible()
  await expect(saved.getByText('₱4,000', { exact: true })).toBeVisible()
  await expect(saved.getByText('2-person room')).toBeVisible()
  await expect(saved.locator('h2 a').first()).toHaveAttribute('href', '/listings/2?option=21')
  await expect(saved.getByText('AI demo illustration')).toBeVisible()
  await expect(page.locator('.space-conversation')).toHaveAttribute('href', '/inquiries/7')
  await page.evaluate(() => document.fonts.ready)
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: `../.local/student-space-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('link', { name: /Review suggested time/ }).click()
  await expect(page).toHaveURL(/\/viewings\?status=proposed#viewing-10$/)
  await expect(page.locator('#viewing-10')).toBeFocused()
  await expect(page.getByRole('button', { name: 'Accept suggested time' })).toBeVisible()
  await page.goBack()
  await page.locator('.space-conversation').click()
  await expect(page).toHaveURL(/\/inquiries\/7$/)
  await expect(page.getByLabel('Your reply')).toBeVisible()
  expect(state.dashboardRequests).toBe(0)
  expect(errors).toEqual([])
})

test('empty and failed activity stays separate from Browse and account settings', async ({ page }) => {
  const state = await fixture(page, { populated: false, failed: true })
  await page.goto('/account')
  await expect(page.getByRole('alert')).toContainText('Synthetic saved-place outage.')
  await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  state.failed = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Found a place you like?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent viewings' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Recent messages' })).toHaveCount(0)
  await page.getByRole('link', { name: /Explore places/ }).click()
  await expect(page).toHaveURL(/campus_id=8&radius_km=2&sort=recommended/)
  expect(state.writes).toBe(0)
})

test('profile saves a selected campus for the next search and keeps password controls out of the way', async ({ page }, testInfo) => {
  const state = await fixture(page, { populated: false })
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible()
  await expect(page.getByLabel('Current password')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeDisabled()
  await page.getByRole('combobox', { name: 'College or university' }).fill('Unknown campus')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('alert')).toContainText('Choose a campus from the suggestions')
  expect(state.writes).toBe(0)
  await page.getByRole('combobox', { name: 'College or university' }).fill('UP Diliman')
  await page.getByRole('button', { name: /UP Diliman.*Quezon City/ }).click()
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  await page.screenshot({ path: `../.local/profile-settings-${testInfo.project.name}.png`, fullPage: true })
  await page.locator('.settings-back').click()
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await expect(page).toHaveURL(/campus_id=9&radius_km=2&sort=recommended/)
  expect(state.writes).toBe(1)
})

test('guest navigation has one sign-in entry and registration still offers both roles', async ({ page }) => {
  await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } }))
  await page.goto('/login')
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'For landlords' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(1)
  await expect(page.getByText(/Administrator accounts are created/)).toHaveCount(0)
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByRole('radio', { name: 'I’m a property owner' }).check()
  await expect(page.getByRole('radio', { name: 'I’m a property owner' })).toBeChecked()
  await page.getByRole('radio', { name: 'I’m a student' }).check()
  await expect(page.getByRole('radio', { name: 'I’m a student' })).toBeChecked()
})
