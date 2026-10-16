import { test, expect } from '@playwright/test'

async function fixture(page, role = 'student') {
  const time = days => new Date(Date.now() + days * 86400000).toISOString()
  const room = { id: 42, name: 'Twin room', capacity: 2, monthly_rent_centavos: 400000, price_basis: 'per_person', inventory_type: 'bedspace', available_units: 2, total_units: 2, fees: [], monthly_fixed_total_centavos: 425000, move_in_fixed_total_centavos: 800000 }
  const property = { id: 21, title: '[DEMO] Near Campus Twin Dorm', is_demo: true, property_type: 'dormitory', description: 'Fictional test residence.', address: 'Sample address', city: 'Manila', photos: [], room_options: [room, { ...room, id: 43, name: 'Solo room' }] }
  const snapshot = { title: property.title, room_name: room.name, address: property.address, city: property.city }
  const base = { property_id: 21, room_option_id: 42, listing_snapshot: snapshot, property_preview: property, participant_name: role === 'student' ? 'Jamie Owner' : 'Alex Student', participant_avatar_url: null, conversation_id: 7, starts_at: time(2), requested_start: time(1), time_passed: false, revision: 1, can_schedule: true, student_note: 'Please meet by the entrance.', owner_note: '' }
  const state = { failSend: true, failDecision: true, sends: [], decisions: [], rows: [{ ...base, id: 1, status: 'accepted' }, { ...base, id: 2, status: 'proposed' }, { ...base, id: 3, status: 'requested' }, { ...base, id: 4, status: 'cancelled' }, { ...base, id: 5, status: 'accepted', time_passed: true, starts_at: time(-1) }], active: false }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = (data, meta = { current_page: 1, last_page: 1 }) => route.fulfill({ json: { data, meta } })
    const user = { id: 987, name: 'Alex Student', role: role === 'guest' ? 'student' : role, preferred_campus_id: null }
    if (path.endsWith('/auth/login')) { state.signedIn = true; return json(user) }
    if (path.endsWith('/me')) return role === 'guest' && !state.signedIn ? route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }) : json(user)
    if (path.endsWith('/saved-places/ids')) return json(state.saved ? [21] : [])
    if (path.endsWith('/saved-places/21') && request.method() === 'PUT') { state.saved = true; return json({ property_id: 21 }) }
    if (path.endsWith('/campuses')) return json([])
    if (path === '/api/v1/listings/21') return json(property)
    if (path.endsWith('/listings/21/viewings')) {
      state.sends.push(request.postDataJSON())
      if (state.failSend) { state.failSend = false; return route.fulfill({ status: 503, json: { message: 'Synthetic request outage' } }) }
      state.active = true
      state.rows.push({ ...base, id: 6, status: 'requested', starts_at: state.sends.at(-1).starts_at, requested_start: state.sends.at(-1).starts_at })
      return route.fulfill({ status: 201, json: { data: state.rows.at(-1) } })
    }
    if (/\/viewings\/\d+$/.test(path)) {
      const data = request.postDataJSON(); state.decisions.push(data)
      if (state.failDecision) { state.failDecision = false; return route.fulfill({ status: 409, json: { message: 'Synthetic changed request. Retry after reviewing.' } }) }
      const row = state.rows.find(row => String(row.id) === path.split('/').pop())
      row.status = data.action === 'accept' ? 'accepted' : data.action === 'propose' ? 'proposed' : data.action === 'cancel' ? 'cancelled' : 'declined'; row.revision++
      if (data.starts_at) row.starts_at = data.starts_at
      if (data.note) row.owner_note = data.note
      return json(row)
    }
    if (path.endsWith('/viewings')) {
      if (url.searchParams.has('id')) return json(state.rows.filter(row => String(row.id) === url.searchParams.get('id')))
      if (url.searchParams.has('active')) return json(state.active ? [state.rows.at(-1)] : [])
      const group = url.searchParams.get('group'), status = url.searchParams.get('status')
      return json(state.rows.filter(row => status ? row.status === status : group === 'upcoming' ? row.status === 'accepted' && !row.time_passed : group === 'requests' ? ['requested', 'proposed'].includes(row.status) : row.time_passed || ['cancelled', 'declined'].includes(row.status)))
    }
    return json([])
  })
  return state
}

test('viewings connect appointment sections, decisions, messages and mobile details', async ({ page }, testInfo) => {
  await fixture(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/viewings')
  await expect(page.getByRole('heading', { name: 'Viewings', exact: true })).toBeVisible()
  await expect(page.locator('.appointment-card')).toHaveCount(1)
  await expect(page.getByRole('article', { name: 'Viewing details' })).toContainText('Confirmed visit')
  await page.getByRole('button', { name: 'Requests', exact: true }).click()
  await expect(page.locator('.appointment-card')).toHaveCount(2)
  const details = page.getByRole('article', { name: 'Viewing details' })
  await expect(details).toContainText('New time suggested')
  await expect(details.getByRole('link', { name: 'Message owner' })).toHaveAttribute('href', '/inquiries/7')
  await page.screenshot({ path: `../.local/viewings-${testInfo.project.name}-requests-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.appointment-card').first().click()
  await expect(details.getByRole('button', { name: 'Accept suggested time' })).toBeInViewport()
  await page.screenshot({ path: `../.local/viewings-${testInfo.project.name}-requests-mobile.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await details.getByRole('button', { name: 'Accept suggested time' }).click()
  await expect(details.getByRole('alert')).toContainText('Synthetic changed request')
  await details.getByRole('button', { name: 'Accept suggested time' }).click()
  await page.getByRole('button', { name: 'Upcoming', exact: true }).click()
  await expect(page.locator('.appointment-card')).toHaveCount(2)
  await page.screenshot({ path: `../.local/viewings-${testInfo.project.name}-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(details).toBeHidden()
  await page.locator('.appointment-card').first().click()
  await expect(details).toBeVisible()
  await expect(details).toBeFocused()
  await expect(page.locator('.appointments-list')).toBeHidden()
  await page.goBack()
  await expect(page.locator('.appointments-list')).toBeVisible()
  await page.goForward()
  await expect(details).toBeFocused()
  await page.screenshot({ path: `../.local/viewings-${testInfo.project.name}-mobile.png`, fullPage: true })
  await page.getByRole('button', { name: 'Back to viewings' }).click()
  await expect(page.locator('.appointments-list')).toBeVisible()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.locator('.appointment-card')).toHaveCount(2)
  await page.goto('/viewings?group=requests#viewing-5')
  await expect(details).toContainText('Past visit')
  await page.goto('/viewings?group=requests#viewing-999')
  await expect(page.getByText('This viewing is unavailable to your account.')).toBeVisible()
})

test('visible listing actions preserve dialog drafts and retry identity and expose the new request', async ({ page }, testInfo) => {
  const state = await fixture(page)
  await page.goto('/listings/21?option=42')
  const button = page.getByRole('button', { name: 'Request a viewing', exact: true })
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'Request a viewing', exact: true })
  await page.getByLabel('Preferred viewing time (Philippine time, UTC+8)').fill('2026-12-01T14:00')
  await page.getByLabel('Viewing note for the owner').fill('Keep this viewing draft')
  await dialog.getByRole('button', { name: 'Discard viewing draft' }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close request a viewing' })).toBeFocused()
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport)
    const bounds = await dialog.boundingBox()
    expect(bounds.height).toBeLessThanOrEqual(viewport.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local/viewing-dialog-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(button).toBeFocused()
  await page.getByRole('button', { name: 'Message owner', exact: true }).click()
  await page.getByLabel('Your question').fill('Keep this message draft')
  await page.keyboard.press('Escape')
  await button.click()
  await expect(page.getByLabel('Viewing note for the owner')).toHaveValue('Keep this viewing draft')
  await page.getByRole('button', { name: 'Send viewing request', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Synthetic request outage')
  await page.getByRole('button', { name: 'Send viewing request', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Viewing requested')
  expect(state.sends[0].client_id).toBe(state.sends[1].client_id)
  expect(state.sends[1].room_option_id).toBe(42)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(button).toHaveCount(0)
  await expect(page.locator('.listing-visit-action').getByRole('link', { name: 'View request' })).toHaveAttribute('href', '/viewings?group=requests#viewing-6')
  await page.getByRole('button', { name: /Compare$/, exact: true }).click()
  await expect(page.getByRole('button', { name: '✓ Added to compare' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Save place [DEMO] Near Campus Twin Dorm', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit saved place [DEMO] Near Campus Twin Dorm', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('dialog', { name: 'Save to a shortlist' })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.listing-mobile-action')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/listing-actions-${testInfo.project.name}-mobile.png`, fullPage: true })
  await page.getByRole('button', { name: 'Message owner', exact: true }).click()
  await expect(page.getByLabel('Your question')).toHaveValue('Keep this message draft')
})

test('owner proposal edits survive failure and block appointment replacement', async ({ page }) => {
  await fixture(page, 'landlord')
  await page.goto('/viewings?group=requests#viewing-3')
  const details = page.getByRole('article', { name: 'Viewing details' })
  await details.getByRole('button', { name: 'Suggest another time', exact: true }).click()
  await expect(page.getByLabel('Suggest another time (Philippine time)')).toBeFocused()
  await page.getByLabel('Message for the student').fill('Please use the side entrance.')
  await page.getByLabel('Suggest another time (Philippine time)').fill('2026-12-01T14:00')
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.locator('.appointment-card').first().click()
  await expect(page.getByLabel('Message for the student')).toHaveValue('Please use the side entrance.')
  await details.getByRole('button', { name: 'Suggest another time', exact: true }).click()
  await expect(details.getByRole('alert')).toContainText('Synthetic changed request')
  await expect(page.getByLabel('Suggest another time (Philippine time)')).toHaveValue('2026-12-01T14:00')
  await details.getByRole('button', { name: 'Suggest another time', exact: true }).click()
  await expect(details).toContainText('Waiting for student')
  await expect(details).toContainText('Please use the side entrance.')
})

test('guest viewing shortcut returns through sign-in to the selected room and keeps an existing message draft', async ({ page }) => {
  await fixture(page, 'guest')
  await page.goto('/listings/21?option=42')
  await page.evaluate(() => sessionStorage.setItem('dormfinder-inquiry-987-21-42', 'Keep the earlier question.'))
  await page.locator('.listing-primary-actions > a').filter({ hasText: 'Request a viewing' }).click()
  await expect(page).toHaveURL(/\/login\?returnTo=/)
  await page.getByLabel('Email address').fill('synthetic@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-test-only-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/listings\/21\?option=42#request-viewing$/)
  await expect(page.getByRole('dialog', { name: 'Request a viewing', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Choose a room option' }).locator('input:checked')).toHaveValue('42')
  await expect(page.getByRole('dialog', { name: 'Message owner', exact: true })).toBeHidden()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Message owner', exact: true }).click()
  await expect(page.getByLabel('Your question')).toHaveValue('Keep the earlier question.')
})
