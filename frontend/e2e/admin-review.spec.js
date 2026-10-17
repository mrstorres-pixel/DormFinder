import { test, expect } from '@playwright/test'

const room = { id: 21, name: 'Shared twin beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 4, available_units: 2, monthly_rent_centavos: 400000, deposit_centavos: 400000, advance_months: 1, fees: [{ name: 'Internet', amount_centavos: 25000, frequency: 'monthly' }], monthly_fixed_total_centavos: 425000, move_in_fixed_total_centavos: 800000, utilities_notes: 'Electricity is metered separately.', availability_confirmed_at: '2026-10-17T00:00:00Z', availability_stale: false }
async function reviewFixture(page, overrides = {}) {
  const state = { failQueue: false, failDecision: false, empty: false, writes: [], dashboardReads: 0, property: { id: 55, title: 'Fictional Campus House', description: 'A fictional listing used to check the administrator review experience.', property_type: 'dormitory', address: 'Sample address', city: 'Manila', status: 'pending_review', landlord_id: 9, revision: 7, is_demo: true, submitted_at: '2026-10-17T07:00:00Z', latitude: 14.6, longitude: 120.99, amenities: ['wifi', 'study_area'], house_rules: 'Quiet after 10pm.', photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional twin room' }, { id: 2, url: '/images/demo/studio-room.webp', caption: 'Fictional studio' }], room_options: [room, { ...room, id: 22, name: 'Private studio', inventory_type: 'whole_room', price_basis: 'per_room', capacity: 1, total_units: 1, available_units: 0, monthly_rent_centavos: 950000, monthly_fixed_total_centavos: 975000 }], ...overrides } }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://tile.openstreetmap.org/**', route => route.abort())
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data } })
    if (path.endsWith('/me')) return json({ id: 987, name: 'Alex Reviewer', role: 'admin' })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    if (path.endsWith('/dashboard')) { state.dashboardReads++; return json({ pending_reviews: 13, open_reports: 2 }) }
    if (request.method() !== 'GET') state.writes.push({ path, values: request.postDataJSON() })
    if (path.endsWith('/admin/reviews')) {
      if (state.failQueue) return route.fulfill({ status: 503, json: { message: 'Synthetic queue unavailable.' } })
      const second = url.searchParams.get('page') === '2'
      const rows = state.empty ? [] : [{ ...state.property, id: second ? 56 : 55, title: second ? 'Fictional Second Residence' : state.property.title }]
      return route.fulfill({ json: { data: rows, meta: { current_page: second ? 2 : 1, last_page: 2, total: state.empty ? 0 : 13 } } })
    }
    if (path.endsWith('/decision')) {
      if (state.failDecision) { state.failDecision = false; state.property.revision = 8; return route.fulfill({ status: 409, json: { message: 'Synthetic stale submission.' } }) }
      const values = request.postDataJSON()
      state.empty = true; state.property.status = values.decision; state.property.moderation_reason = values.reason; state.property.revision++
      return json(state.property)
    }
    if (/\/admin\/reviews\/\d+$/.test(path)) return state.failRead ? route.fulfill({ status: 503, json: { message: 'Synthetic refresh unavailable.' } }) : json(state.property)
    return route.fulfill({ json: { data: [], meta: { current_page: 1, last_page: 1 } } })
  })
  return { state, errors }
}
const acknowledged = page => page.getByLabel('I have checked the listing against these review criteria.')

test('photo-led review queue supports retry, correct pagination, back navigation and empty recovery', async ({ page }, testInfo) => {
  const { state, errors } = await reviewFixture(page)
  state.failQueue = true
  await page.goto('/admin')
  await expect(page.getByRole('alert')).toContainText('Synthetic queue unavailable.')
  state.failQueue = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('13 awaiting review', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Review photos: Fictional Campus House' }).getByRole('img')).toBeVisible()
  expect(state.dashboardReads).toBe(0)
  const tabs = page.getByRole('navigation', { name: 'Administrator sections' })
  await expect(tabs.getByRole('link', { name: 'Reviews', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: `../.local/admin-queue-${testInfo.project.name}-desktop.png`, fullPage: true })
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\?page=2$/)
  await page.getByRole('link', { name: 'Review Fictional Second Residence', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fictional Campus House', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '← Review queue', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\?page=2$/)
  await expect(page.getByRole('heading', { name: 'Fictional Second Residence', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 360, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/admin-queue-${testInfo.project.name}-mobile.png`, fullPage: true })
  state.empty = true
  await page.reload()
  await expect(page.getByRole('heading', { name: 'You’re all caught up.' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to first page' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  expect(errors).toEqual([])
})

test('review keeps gallery, room costs, map fallback and unsaved feedback connected on desktop and phones', async ({ page }, testInfo) => {
  const { state, errors } = await reviewFixture(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/reviews/55')
  await expect(page.getByRole('button', { name: 'Approve listing', exact: true })).toBeDisabled()
  await page.getByLabel('Feedback for the owner').fill('Keep my unsaved review feedback.')
  await page.getByRole('radio', { name: /Private studio/ }).check()
  await expect(page.locator('.review-room-panel .room-price')).toContainText('₱9,500.00')
  await expect(page.locator('.review-room-panel .room-price')).toContainText('per room')
  await expect(page.locator('.review-room-panel')).toContainText('Sold out')
  await page.getByRole('button', { name: 'Enlarge photo 1: Fictional twin room' }).click()
  await expect(page.getByRole('dialog', { name: 'Listing photos' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Listing photos' })).toContainText('Photo 2 of 2')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Enlarge photo 2: Fictional studio' })).toBeFocused()
  await expect(page.getByLabel('Feedback for the owner')).toHaveValue('Keep my unsaved review feedback.')
  await page.getByRole('button', { name: 'Show location map' }).click()
  await expect(page.getByRole('region', { name: 'Owner-supplied property location' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Map imagery could not load.')
  await page.getByText('Coordinates', { exact: true }).click()
  await expect(page.locator('.review-coordinates')).toContainText('14.6, 120.99')
  await expect(page.locator('.review-location-map .leaflet-marker-draggable')).toHaveCount(0)
  await page.getByRole('link', { name: '← Review queue', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(page.getByLabel('Feedback for the owner')).toHaveValue('Keep my unsaved review feedback.')
  await page.locator('#review-rooms').scrollIntoViewIfNeeded()
  expect((await page.locator('.review-decision-column').boundingBox()).y).toBeGreaterThanOrEqual(85)
  expect((await page.locator('.review-decision-column').boundingBox()).y).toBeLessThan(160)
  await page.screenshot({ path: `../.local/admin-review-${testInfo.project.name}-desktop.png` })
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation', { name: 'Listing review sections' }).getByRole('link', { name: 'Decision', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review decision', exact: true })).toBeInViewport()
  await expect(page.getByLabel('Feedback for the owner')).toHaveValue('Keep my unsaved review feedback.')
  await page.screenshot({ path: `../.local/admin-review-${testInfo.project.name}-mobile.png` })
  expect(state.writes).toEqual([])
  expect(errors).toEqual([])
})

test('returned feedback is required and survives conflicts, refresh and retry with the current revision', async ({ page }) => {
  const { state, errors } = await reviewFixture(page)
  state.failDecision = true
  await page.goto('/admin/reviews/55?page=2')
  await page.getByRole('radio', { name: /Request changes/ }).check()
  await acknowledged(page).check()
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click()
  expect(state.writes).toHaveLength(0)
  await expect(page.getByLabel('Feedback for the owner')).toBeFocused()
  await page.getByLabel('Feedback for the owner').fill('   ')
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(page.getByText('Explain what the owner should correct.', { exact: true })).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await page.getByLabel('Feedback for the owner').fill('Please clarify which utilities are included.')
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic stale submission.')
  expect(state.writes[0].values.revision).toBe(7)
  state.failRead = true
  await page.getByRole('button', { name: 'Refresh listing', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic refresh unavailable.' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByLabel('Feedback for the owner')).toHaveValue('Please clarify which utilities are included.')
  state.failRead = false
  await page.getByRole('button', { name: 'Refresh listing', exact: true }).click()
  await expect(page.getByText('Listing #55 · Revision 8', { exact: true })).toBeVisible()
  await expect(acknowledged(page)).not.toBeChecked()
  await expect(page.getByLabel('Feedback for the owner')).toHaveValue('Please clarify which utilities are included.')
  await expect(page.getByRole('button', { name: 'Send feedback', exact: true })).toBeDisabled()
  await acknowledged(page).check()
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\?page=2$/)
  expect(state.writes[1].values).toEqual({ decision: 'rejected', reason: 'Please clarify which utilities are included.', revision: 8, review_confirmed: true })
  await expect(page.getByRole('heading', { name: 'You’re all caught up.' })).toBeVisible()
  expect(errors).toEqual([])
})

test('approval protects other moderation drafts and reviewed listings expose no new decision', async ({ page }) => {
  const { state, errors } = await reviewFixture(page)
  await page.goto('/admin/reviews/55')
  await page.getByText('Other listing actions', { exact: true }).click()
  await page.getByLabel('Reason for listing action').fill('Keep these separate moderation notes.')
  await acknowledged(page).check()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Approve listing', exact: true }).click()
  expect(state.writes).toHaveLength(0)
  await expect(page.getByLabel('Reason for listing action')).toHaveValue('Keep these separate moderation notes.')
  // Clearing the optional notes leaves that form dirty; explicitly discard before a fresh review.
  await page.getByRole('link', { name: '← Review queue', exact: true }).click()
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await page.getByRole('link', { name: 'Review Fictional Campus House', exact: true }).click()
  await acknowledged(page).check()
  await page.getByRole('button', { name: 'Approve listing', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  expect(state.writes[0].values).toEqual({ decision: 'approved', reason: '', revision: 7, review_confirmed: true })
  state.property.latitude = null
  await page.goto('/admin/reviews/55')
  await expect(page.getByText('No valid location pin provided.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve listing', exact: true })).toHaveCount(0)
  await expect(page.locator('.review-finished')).toContainText('This listing is now approved.')
  expect(errors).toEqual([])
})
