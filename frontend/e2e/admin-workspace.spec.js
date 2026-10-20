import { test, expect } from '@playwright/test'

async function fixture(page) {
  const state = { requests: [], writes: [], fail: false, failWrite: false }
  const listings = Array.from({ length: 26 }, (_, index) => ({ id: index + 1, title: 'Campus Residence ' + String(index + 1).padStart(2, '0'), city: 'Manila', property_type: 'dormitory', status: 'draft', landlord_name: 'Jamie Owner', updated_at: '2026-10-20T00:00:00Z', photos: [{ url: '/images/demo/twin-room.webp' }], room_options: [] }))
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data } })
    if (path.endsWith('/me')) return json({ id: 987, name: 'Alex Reviewer', role: 'admin' })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    state.requests.push({ path, params: Object.fromEntries(url.searchParams) })
    if (req.method() !== 'GET') {
      state.writes.push({ path, body: req.postDataJSON() })
      return state.failWrite ? route.fulfill({ status: 503, json: { message: 'Synthetic write failure' } }) : json({ id: 8 })
    }
    if (state.fail) return route.fulfill({ status: 503, json: { message: 'Synthetic directory outage' } })
    if (path.endsWith('/admin/users')) return route.fulfill({ json: { data: [{ id: 91, name: 'Jamie Owner', email: 'sample@example.invalid', role: 'landlord', status: 'active', moderation_revision: 3 }], total: 1, last_page: 1, from: 1, to: 1 } })
    if (path.endsWith('/admin/reports')) return route.fulfill({ json: { data: [{ id: 8, property_id: 1, student_id: 7, student_name: 'Jamie Student', listing_title: 'Campus Residence', category: 'other', body: 'A private concern needing a clear resolution.', status: 'open', revision: 3, created_at: '2026-10-20T00:00:00Z' }], total: 1, last_page: 1 } })
    if (path.endsWith('/admin/audit')) return route.fulfill({ json: { data: [{ id: 8, property_id: 1, listing_title: 'Campus Residence', actor_name: 'Alex Reviewer', action: 'listing_review', before_status: 'pending_review', after_status: 'approved', reason: 'Reviewed property details.', revision: 3, created_at: '2026-10-20T00:00:00Z' }], total: 1, last_page: 1 } })
    let rows = listings
    if (url.searchParams.get('q')) rows = rows.filter(row => row.title.includes(url.searchParams.get('q')))
    if (url.searchParams.get('sort') === 'title_desc') rows = [...rows].reverse()
    const size = Number(url.searchParams.get('per_page') || 12), current = Number(url.searchParams.get('page') || 1), start = (current - 1) * size
    return route.fulfill({ json: { data: rows.slice(start, start + size), meta: { total: rows.length, current_page: current, last_page: Math.ceil(rows.length / size), from: start + 1, to: Math.min(rows.length, start + size) } } })
  })
  return state
}

test('admin directories filter and paginate on the server, preserve URL state and fit phones', async ({ page }, testInfo) => {
  const state = await fixture(page)
  await page.goto('/admin/listings')
  await expect(page.getByRole('status')).toContainText('1\u201312 of 26 listings')
  await expect(page.locator('tbody tr')).toHaveCount(12)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('tbody tr').first()).toContainText('Campus Residence 13')
  await page.getByLabel('Search listings').fill('Residence 2')
  await page.getByLabel('Sort by').selectOption('title_desc')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.locator('tbody tr').first()).toContainText('Campus Residence 26')
  expect(state.requests.at(-1).params).toMatchObject({ q: 'Residence 2', sort: 'title_desc', per_page: '12' })
  await page.getByLabel('Per page').selectOption('24')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect.poll(() => state.requests.at(-1).params.per_page).toBe('24')
  for (const route of ['/admin/listings', '/admin/users', '/admin/reports', '/admin/audit']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Result pages' })).toBeVisible()
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width !== 320) await page.screenshot({ path: `../.local/admin-polished-${route.split('/').pop()}-${testInfo.project.name}-${width}.png`, fullPage: true })
    }
  }
  await page.getByLabel('From date').fill('2026-10-20')
  await page.getByLabel('To date').fill('2026-10-20')
  await page.getByLabel('Action', { exact: true }).selectOption('listing_review')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect.poll(() => state.requests.at(-1).params).toMatchObject({ action: 'listing_review', from: '2026-10-20', to: '2026-10-20' })
})

test('focused moderation preserves notes on failure and dismissal, and closes after success', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/admin/users')
  await expect(page.getByLabel('Reason for account action #91')).toHaveCount(0)
  await page.getByRole('button', { name: 'Manage account: Jamie Owner' }).click()
  await page.getByLabel('Reason for account action #91').fill('A documented synthetic moderation action.')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Close manage account' }).click()
  await expect(page.getByRole('dialog', { name: 'Manage account' })).toBeVisible()
  await page.getByLabel('Confirm suspend account #91').check()
  state.failWrite = true
  await page.getByRole('button', { name: 'Suspend account #91' }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic write failure')
  await expect(page.getByLabel('Reason for account action #91')).toHaveValue('A documented synthetic moderation action.')
  state.failWrite = false
  await page.getByRole('button', { name: 'Suspend account #91' }).click()
  await expect(page.getByRole('dialog', { name: 'Manage account' })).toHaveCount(0)
  expect(state.writes.at(-1).body).toMatchObject({ revision: 3, action: 'suspend' })
  await page.goto('/admin/reports')
  await page.getByRole('button', { name: 'Review report: Campus Residence' }).click()
  await page.getByLabel('Private resolution notes').fill('Reviewed the concern and documented the outcome.')
  await page.getByLabel('Report outcome').selectOption('dismissed')
  await page.getByRole('button', { name: 'Close report #8' }).click()
  await expect(page.getByRole('dialog', { name: 'Review report' })).toHaveCount(0)
  expect(state.writes.at(-1).body).toMatchObject({ status: 'dismissed', revision: 3 })
})

test('admin directory errors can be retried and empty filters can be cleared', async ({ page }) => {
  const state = await fixture(page)
  state.fail = true
  await page.goto('/admin/listings')
  await expect(page.getByRole('alert')).toContainText('Synthetic directory outage')
  state.fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(12)
  await page.getByLabel('Search listings').fill('No such listing')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('heading', { name: 'No matching listings' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(12)
})

test('registration rejects numeric and symbol names while accepting international names', async ({ page }) => {
  await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }))
  await page.goto('/register')
  const name = page.getByLabel('Your name', { exact: true })
  for (const value of ['123#@%', 'Ana123', 'A', 'Ana \u{1F600}']) {
    await name.fill(value)
    expect(await name.evaluate(input => input.validity.patternMismatch)).toBe(true)
  }
  for (const value of ['Jos\u00e9 Dela-Cruz', 'Mar\u00eda O\u2019Neill', '\u674e\u660e', 'J. Santos']) {
    await name.fill(value)
    expect(await name.evaluate(input => input.checkValidity())).toBe(true)
  }
})
