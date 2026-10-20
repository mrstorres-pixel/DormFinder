import { test, expect } from '@playwright/test'

const campuses = [{ id: 8, name: 'West University', institution_name: 'West University', city: 'Manila', latitude: 14.6, longitude: 120.99 }]
const room = { id: 21, name: 'Twin student beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 2, available_units: 1, monthly_rent_centavos: 400000, deposit_centavos: 400000, advance_months: 1, fees: [], monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, utilities_notes: 'Water included, electricity metered.', availability_stale: false, availability_confirmed_at: '2026-10-20T01:00:00Z' }
const listing = { id: 55, title: 'Sampaloc Study House', property_type: 'dormitory', description: 'A fictional student residence used to check the complete discovery and messaging experience.', city: 'Manila', address: 'Fictional Sampaloc street', latitude: 14.6, longitude: 120.99, amenities: ['wifi'], house_rules: 'Quiet at night.', status: 'draft', revision: 1, photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional student room', status: 'ready' }], room_options: [room] }
async function fixture(page, role = 'student', guest = false) {
  const state = { user: guest ? null : { id: 987, name: 'Alex Student', email: 'alex@example.test', role }, listing: structuredClone(listing), saved: false, note: '', failDelete: false, failRefresh: false, messages: [], threads: [], writes: [], failProfile: false }
  const savedRow = () => ({ property_id: 55, room_option_id: 21, note: state.note, saved_details: { room_option_id: 21, note: state.note }, version: 'a'.repeat(64), contexts: [], listing_snapshot: { title: listing.title, room_name: room.name }, listing: state.listing })
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/v1', ''), method = request.method()
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: Array.isArray(data) ? data.length : 1 } } })
    const error = (status, message) => route.fulfill({ status, json: { message } })
    if (method !== 'GET') state.writes.push({ path, method, body: request.postDataJSON() })
    if (path.startsWith('/auth/register/')) { state.user = { id: 987, name: request.postDataJSON().name, email: request.postDataJSON().email, role: path.split('/').pop() }; return json(state.user) }
    if (path === '/me') {
      if (!state.user) return error(401, 'Unauthenticated.')
      if (method === 'PATCH') { if (state.failProfile) return error(503, 'Profile save interrupted. Please retry.'); Object.assign(state.user, request.postDataJSON()) }
      return json(state.user)
    }
    if (path === '/me/avatar') return json({ has_avatar: false, avatar_url: null })
    if (path === '/notifications/unread-count') return json({ unread_count: 0 })
    if (path === '/campuses') return json(campuses)
    if (path === '/search-suggestions') return json([{ kind: 'Location', label: 'Manila', detail: 'Search this city' }, { kind: 'Listing', id: 55, label: listing.title, detail: 'Manila' }])
    if (path === '/listings' || path === '/listings-map') return json([state.listing])
    if (path === '/listings/55') return json(state.listing)
    if (path === '/landlord/properties') return json((url.searchParams.get('view') === 'archived') === (state.listing.status === 'archived') ? [state.listing] : [])
    if (path === '/landlord/properties/55/lifecycle') { state.listing.status = 'archived'; state.listing.revision++; return json(state.listing) }
    if (path === '/landlord/properties/55') return json(state.listing)
    if (path === '/saved-places/ids') return json(state.saved ? [55] : [])
    if (path === '/saved-places') return json(state.saved ? [savedRow()] : [])
    if (path === '/saved-places/55') {
      if (method === 'PUT') state.saved = true
      if (method === 'DELETE') { if (state.failDelete) return error(503, 'Unable to remove saved place. Retry.'); state.saved = false }
      return json(savedRow())
    }
    if (path === '/listings/55/inquiries') {
      state.threads = [{ id: 7, property_id: 55, participant_name: 'Jamie Owner', participant_role: 'landlord', property_status: 'approved', can_reply: true, listing_snapshot: { title: listing.title, room_option: room } }]
      state.messages.push({ id: 1, sender_id: 987, sender_name: state.user.name, body: request.postDataJSON().body, created_at: '2026-10-20T01:00:00Z' })
      return json({ id: 7 })
    }
    if (path === '/inquiries') return json(state.threads)
    if (path === '/inquiries/7') return state.failRefresh ? error(503, 'Refresh unavailable.') : json(state.threads[0])
    if (path === '/inquiries/7/messages') {
      if (method === 'POST') state.messages.push({ id: state.messages.length + 1, sender_id: 987, sender_name: state.user.name, body: request.postDataJSON().body, created_at: '2026-10-20T01:01:00Z' })
      return json(method === 'POST' ? state.messages.at(-1) : state.messages)
    }
    return json([])
  })
  return state
}

for (const role of ['student', 'landlord']) test(`new ${role} completes profile setup and receives the relevant guide`, async ({ page }) => {
  const state = await fixture(page, role, true)
  await page.goto('/register?role=' + role)
  await page.getByLabel('Your name', { exact: true }).fill('Alex Student')
  await page.getByLabel('Email address').fill('alex@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Fictional-password-123')
  await page.getByLabel('Confirm password').fill('Fictional-password-123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/profile\/setup$/)
  await expect(page.getByRole('button', { name: 'Finish profile setup' })).toBeEnabled()
  state.failProfile = true
  await page.getByRole('button', { name: 'Finish profile setup' }).click()
  await expect(page.getByRole('alert')).toContainText('Profile save interrupted')
  await expect(page.getByLabel('Your name')).toHaveValue('Alex Student')
  state.failProfile = false
  await page.getByRole('button', { name: 'Finish profile setup' }).click()
  await expect(page).toHaveURL(role === 'student' ? /\/listings$/ : /\/landlord$/)
  const guide = page.getByRole('region', { name: 'Getting started with DormFinder' })
  await expect(guide).toContainText(role === 'student' ? 'Tap the heart' : 'confirm vacancies')
  await page.getByRole('button', { name: 'Dismiss getting started guide' }).click()
  await expect(guide).toHaveCount(0)
  await page.getByRole('link', { name: 'Quick guide', exact: true }).click()
  await expect(guide).toBeVisible()
})

test('one search bar accepts text, suggests places and explicitly chooses a campus', async ({ page }, testInfo) => {
  await fixture(page)
  await page.goto('/listings?campus_id=8&radius_km=2&sort=distance&price_basis=per_person&max_rent_centavos=600000&south=14.5&north=14.7&west=120.9&east=121.1')
  const input = page.getByRole('combobox', { name: 'Campus, location or listing' })
  await input.fill('Sampaloc')
  await expect(page.getByRole('button', { name: 'Listing ' + listing.title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Listing ' + listing.title, exact: true }).click()
  await page.getByRole('button', { name: 'Search places', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(listing.title)
  for (const key of ['campus_id', 'radius_km', 'south']) expect(new URL(page.url()).searchParams.has(key)).toBe(false)
  expect(new URL(page.url()).searchParams.get('max_rent_centavos')).toBe('600000')
  await expect(page.locator('.campus-marker')).toHaveCount(0)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByLabel('Search property or city')).toHaveCount(0)
  await page.getByRole('button', { name: 'Apply filters' }).click()
  expect(new URL(page.url()).searchParams.get('q')).toBe(listing.title)
  await input.fill('West')
  await expect(input).toHaveValue('West')
  await input.press('ArrowDown'); await input.press('ArrowDown'); await input.press('Enter')
  await expect(input).toHaveValue('West University')
  await page.getByRole('button', { name: 'Search places', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('campus_id')).toBe('8')
  expect(new URL(page.url()).searchParams.has('q')).toBe(false)
  await expect(page.locator('.campus-marker')).toHaveCount(1)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local/group-search-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
})

test('heart saves and removes places, protects notes and retains a failed removal', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/listings/55')
  await page.getByRole('button', { name: 'Save place ' + listing.title, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unsave place ' + listing.title, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Saved places', exact: true }).click()
  const heart = page.getByRole('button', { name: 'Unsave place ' + listing.title, exact: true })
  await expect(heart.locator('svg')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Notes & collections' })).toBeVisible()
  state.note = 'Private student note'
  let confirmations = 0
  page.on('dialog', async dialog => { confirmations++; if (confirmations === 1) await dialog.dismiss(); else await dialog.accept() })
  await heart.click()
  await expect.poll(() => confirmations).toBe(1)
  await expect(heart).toBeEnabled()
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  expect(state.saved).toBe(true)
  state.failDelete = true
  await heart.click()
  await expect(page.getByRole('alert')).toContainText('Unable to remove saved place')
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  state.failDelete = false
  await heart.click()
  await expect(page.getByRole('article', { name: 'Saved place ' + listing.title })).toHaveCount(0)
  expect(state.saved).toBe(false)
  expect(state.writes.filter(write => write.method === 'DELETE').at(-1).body.version).toHaveLength(64)
})

test('owners remove a listing through confirmation and can find it in removed listings', async ({ page }) => {
  const state = await fixture(page, 'landlord')
  await page.goto('/landlord')
  await page.getByRole('button', { name: 'Remove listing', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove listing', exact: true })
  await expect(dialog).toContainText('viewing history are kept')
  await dialog.getByRole('button', { name: 'Keep listing' }).click()
  expect(state.writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Remove listing', exact: true }).click()
  await dialog.getByRole('button', { name: 'Remove listing', exact: true }).click()
  await expect(page.locator('.property-card')).toHaveCount(0)
  await page.getByLabel('Show properties').selectOption('archived')
  await expect(page.locator('.property-card')).toContainText(listing.title)
  expect(state.listing.room_options).toHaveLength(1)
})

test('an empty inbox leads to a first message and a failed refresh preserves the conversation draft', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/inquiries')
  await expect(page.locator('.inbox-empty')).toContainText('choose Message owner')
  await page.getByRole('link', { name: 'Find a place to ask about' }).click()
  await page.locator('.property-card').getByRole('heading').getByRole('link').click()
  await page.getByRole('button', { name: 'Message owner', exact: true }).click()
  await page.getByLabel('Your question').fill('Can I visit the room this week?')
  await page.getByRole('button', { name: 'Send private inquiry' }).click()
  await expect(page).toHaveURL(/\/inquiries\/7$/)
  await expect(page.getByRole('log')).toContainText('Can I visit the room this week?')
  await page.getByLabel('Your reply').fill('I am free on Friday afternoon.')
  state.failRefresh = true
  await expect(page.getByRole('status').filter({ hasText: 'could not refresh' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Your reply')).toHaveValue('I am free on Friday afternoon.')
  await expect(page.getByRole('log')).toContainText('Can I visit the room this week?')
  state.failRefresh = false
  await page.getByRole('button', { name: 'Reconnect' }).click()
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(page.getByRole('log')).toContainText('I am free on Friday afternoon.')
  await expect(page.getByLabel('Your reply')).toHaveValue('')
})
