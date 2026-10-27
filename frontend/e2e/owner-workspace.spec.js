import { test, expect } from '@playwright/test'

async function fixture(page) {
  const room = { name: 'Twin beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 4, available_units: 2, monthly_rent_centavos: 400000, deposit_centavos: 400000, advance_months: 1, fees: [], monthly_fixed_total_centavos: 400000, move_in_fixed_total_centavos: 800000, utilities_notes: 'Water included; electricity is metered.', availability_stale: false, availability_confirmed_at: new Date().toISOString() }
  const properties = Array.from({ length: 26 }, (_, index) => {
    const id = index + 1
    const status = id >= 17 && id <= 20 ? 'approved' : id === 21 ? 'pending_review' : id === 22 ? 'rejected' : id === 23 ? 'archived' : id === 24 ? 'suspended' : 'draft'
    return { id, title: 'Campus Residence ' + String(id).padStart(2, '0'), status, revision: 1, city: 'Manila', address: 'College Street', description: 'A furnished student residence near campus with a shared study space.', property_type: 'dormitory', latitude: 14.6, longitude: 120.99, amenities: ['wifi'], house_rules: 'Quiet after 10 pm.', updated_at: '2026-10-27T00:00:00Z', moderation_reason: status === 'rejected' ? 'Add a clearer photo of the room entrance.' : null, photos: [{ id, status: 'ready', url: '/images/demo/twin-room.webp', caption: 'Twin room' }], room_options: [{ ...room, id: id * 10, available_units: id === 20 ? 0 : 2 }], ...(status === 'approved' ? { availability: { status: id === 18 ? 'needs_confirmation' : id === 19 ? 'hidden' : 'current', rooms_needing_confirmation: id === 18 || id === 19 ? 1 : 0 } } : {}) }
  })
  const state = { properties, requests: [], writes: [], detailReads: 0, failList: false, failAvailability: false, changeOnUpload: false }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data } })
    if (path.endsWith('/me')) return json({ id: 81, name: 'Jamie Owner', role: 'landlord' })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    if (path.endsWith('/dashboard')) return json({ stale_listings: 2, awaiting_reply: 3, pending_viewings: 1 })
    if (path.endsWith('/campuses')) return json([])
    state.requests.push({ path, params: Object.fromEntries(url.searchParams) })
    if (path.endsWith('/landlord/properties')) {
      if (state.failList) return route.fulfill({ status: 503, json: { message: 'Property list unavailable.' } })
      let rows = state.properties.filter(property => url.searchParams.get('view') === 'all' || (url.searchParams.get('view') === 'archived' ? property.status === 'archived' : property.status !== 'archived'))
      if (url.searchParams.get('q')) rows = rows.filter(property => [property.title, property.address, property.city].join(' ').toLowerCase().includes(url.searchParams.get('q').toLowerCase()))
      if (url.searchParams.get('status')) rows = rows.filter(property => property.status === url.searchParams.get('status'))
      if (url.searchParams.get('availability') === 'needs_confirmation') rows = rows.filter(property => property.status === 'approved' && property.availability.status !== 'current')
      if (url.searchParams.get('availability') === 'taken') rows = rows.filter(property => property.status === 'approved' && property.room_options.every(option => option.available_units === 0))
      const sort = url.searchParams.get('sort') || 'newest'
      rows.sort((a, b) => sort === 'title_asc' ? a.title.localeCompare(b.title) : sort === 'title_desc' ? b.title.localeCompare(a.title) : sort === 'oldest' ? a.id - b.id : b.id - a.id)
      const size = Number(url.searchParams.get('per_page') || 12), current = Number(url.searchParams.get('page') || 1), start = (current - 1) * size
      return route.fulfill({ json: { data: rows.slice(start, start + size), meta: { total: rows.length, current_page: current, last_page: Math.ceil(rows.length / size), from: start + 1, to: Math.min(rows.length, start + size) } } })
    }
    const match = path.match(/\/landlord\/properties\/(\d+)(.*)$/)
    if (!match) return json([])
    const property = state.properties.find(item => item.id === Number(match[1])), suffix = match[2]
    if (request.method() === 'GET') { state.detailReads++; return json(property) }
    const payload = request.headers()['content-type']?.includes('multipart/form-data') ? {} : request.postDataJSON()
    state.writes.push({ path, payload })
    if (suffix === '/photos' && state.changeOnUpload) {
      property.description = 'A newer description saved in another window that must not be overwritten.'; property.revision++
      return route.fulfill({ status: 409, json: { message: 'The listing changed. Review the saved version.' } })
    }
    if (payload.revision !== property.revision) return route.fulfill({ status: 409, json: { message: 'The listing changed. Your edits have been kept.' } })
    if (suffix === '/availability') {
      if (state.failAvailability) return route.fulfill({ status: 503, json: { message: 'Vacancy update unavailable.' } })
      for (const option of payload.options) Object.assign(property.room_options.find(item => item.id === option.id), { available_units: option.available_units, availability_stale: false, availability_confirmed_at: new Date().toISOString() })
      property.availability = { status: 'current', rooms_needing_confirmation: 0 }
    } else if (suffix === '/lifecycle') property.status = payload.action === 'archive' ? 'archived' : 'draft'
    else if (suffix.startsWith('/room-options')) {
      const optionId = Number(suffix.split('/')[2])
      const saved = { ...room, ...payload, id: optionId || property.id * 10 + 1 }
      if (optionId) property.room_options = property.room_options.map(option => option.id === optionId ? saved : option)
      else property.room_options.push(saved)
      property.status = 'draft'
    } else { Object.assign(property, payload); property.status = 'draft' }
    property.revision++
    return json(property)
  })
  return state
}

test('owner search, views and pagination use the server and the editor returns to the same results', async ({ page }, testInfo) => {
  const state = await fixture(page)
  await page.goto('/landlord?sort=title_asc&page=2')
  await expect(page.locator('.owner-property-card')).toHaveCount(12)
  const card = page.getByRole('article', { name: 'Campus Residence 13', exact: true })
  await card.getByRole('link', { name: /Manage property/ }).click()
  await page.getByRole('link', { name: '← Your properties', exact: true }).click()
  await expect(page).toHaveURL(/sort=title_asc&page=2/)
  await page.getByLabel('Search your properties').fill('Residence 2')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.locator('.owner-property-card')).toHaveCount(6)
  expect(state.requests.at(-1).params).toMatchObject({ q: 'Residence 2', view: 'active', sort: 'title_asc' })
  await page.getByRole('navigation', { name: 'Property views' }).getByRole('button', { name: 'In review', exact: true }).click()
  await expect(page.locator('.owner-property-card')).toHaveCount(1)
  await expect(page.getByRole('link', { name: /View submission.*Manage property/ })).toBeVisible()
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: `../.local/landlord-directory-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
})

test('attention links find all overdue properties and an empty removed view explains recovery', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/landlord')
  await page.getByRole('link', { name: /Availability updates/ }).click()
  await expect(page).toHaveURL(/availability=needs_confirmation/)
  await expect(page.locator('.owner-property-card')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Refresh availability', exact: true })).toHaveCount(2)
  state.properties = state.properties.filter(property => property.status !== 'archived')
  await page.getByRole('navigation', { name: 'Property views' }).getByRole('button', { name: 'Removed', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No removed properties', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create your first draft', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show current properties', exact: true }).click()
  await expect(page.locator('.owner-property-card')).toHaveCount(12)
})

test('vacancy updates are separate from room edits and marking taken requires a successful confirmation', async ({ page }, testInfo) => {
  const state = await fixture(page)
  await page.goto('/landlord/properties/17#rooms')
  await expect(page.getByRole('heading', { name: 'Rooms and availability', exact: true })).toBeVisible()
  await expect(page.getByLabel('Room option name', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Set all as taken', exact: true }).click()
  await expect(page.getByLabel('Available units for Twin beds')).toHaveValue('0')
  expect(state.writes).toHaveLength(0)
  state.failAvailability = true
  await page.getByRole('button', { name: 'Confirm vacancies today', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Vacancy update unavailable.')
  await expect(page.getByLabel('Available units for Twin beds')).toHaveValue('0')
  state.failAvailability = false
  await page.getByRole('button', { name: 'Confirm vacancies today', exact: true }).click()
  await expect(page.getByText('Marked sold out. Availability confirmed today.', { exact: true })).toBeVisible()
  expect(state.properties.find(property => property.id === 17).status).toBe('approved')
  await page.getByRole('button', { name: 'Add another room option', exact: true }).click()
  await expect(page.getByLabel('Room option name', { exact: true })).toBeFocused()
  await page.getByLabel('Room option name', { exact: true }).fill('Unsaved room')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Clear room form', exact: true }).click()
  await expect(page.getByLabel('Room option name', { exact: true })).toHaveCount(0)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width !== 320) await page.screenshot({ path: `../.local/landlord-vacancies-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
})

test('cancel and explicit refresh preserve location drafts and load another window’s changes safely', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/landlord/properties/1#location')
  await page.getByLabel('Property name', { exact: true }).fill('My unsaved title')
  const property = state.properties.find(item => item.id === 1)
  property.description = 'A newer description from another window that must be preserved.'; property.revision++
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Your edits have been kept.' })).toBeVisible()
  await expect(page.getByLabel('Property name', { exact: true })).toHaveValue('My unsaved title')
  const reads = state.detailReads
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Refresh saved listing', exact: true }).click()
  expect(state.detailReads).toBe(reads)
  await page.getByRole('button', { name: 'Cancel location changes', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh saved listing', exact: true }).click()
  await expect(page.getByLabel('About the property')).toHaveValue(property.description)
  await expect(page.getByLabel('Property name', { exact: true })).toHaveValue('Campus Residence 01')
  expect(property.title).toBe('Campus Residence 01')
})

test('a refreshed photo conflict cannot upgrade the revision of conflicting location edits', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/landlord/properties/1#location')
  await page.getByLabel('Property name', { exact: true }).fill('My location draft')
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Photos', exact: true }).click()
  state.changeOnUpload = true
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'room.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo fixture') })
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Review the saved version.')
  await expect.poll(() => state.detailReads).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Clear photo form', exact: true }).click()
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Location & details', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Your edits have been kept.' })).toBeVisible()
  expect(state.writes.at(-1).payload.revision).toBe(1)
  expect(state.properties.find(item => item.id === 1).title).toBe('Campus Residence 01')
})

test('nonconflicting room updates can be saved without losing a location draft', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/landlord/properties/1#location')
  await page.getByLabel('Street address').fill('New address saved with my room changes')
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Rooms & costs', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Twin beds', exact: true }).click()
  await page.getByLabel('Monthly rent (PHP)').fill('4500')
  await page.getByRole('button', { name: 'Save room option', exact: true }).click()
  await expect(page.getByText('Room information saved.', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Location & details', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/landlord$/)
  const property = state.properties.find(item => item.id === 1)
  expect(property.address).toBe('New address saved with my room changes')
  expect(property.room_options[0].monthly_rent_centavos).toBe(450000)
  expect(state.writes.at(-1).payload.revision).toBe(2)
})
