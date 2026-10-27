import { test, expect } from '@playwright/test'

async function fixture(page, role = 'admin') {
  const state = { requests: [], writes: [], failAvatar: false }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    state.requests.push(path)
    const json = data => route.fulfill({ json: { data } })
    if (request.method() !== 'GET') { state.writes.push(path); return route.fulfill({ status: 422, json: { message: 'Keep your edits and try again.' } }) }
    if (path.endsWith('/me')) return json({ id: 81, name: 'Alex Reviewer', email: 'alex@example.invalid', role })
    if (path.endsWith('/me/avatar')) return state.failAvatar ? route.fulfill({ status: 503, json: { message: 'Photo unavailable.' } }) : json({ has_avatar: false, avatar_url: null })
    if (path.endsWith('/dashboard')) return json({ pending_reviews: 0, open_reports: 0 })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    return json([])
  })
  return state
}

test('admin Profile opens from Account without a deferred page download and keeps failed edits', async ({ page }, testInfo) => {
  const state = await fixture(page)
  let deferredProfileRequests = 0
  await page.route('**/assets/ProfileSettings-*.js', route => { deferredProfileRequests++; return route.abort() })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Listing review queue', exact: true })).toBeVisible()
  await page.locator('.account-menu summary').click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Administrator sections' }).getByRole('link', { name: /^Profile/ })).toHaveAttribute('aria-current', 'page')
  expect(deferredProfileRequests).toBe(0)
  expect(state.requests.some(path => path.endsWith('/campuses'))).toBe(false)
  await page.getByLabel('Your name', { exact: true }).fill('Alex Updated')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Keep your edits')
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Alex Updated')
  await page.getByRole('navigation', { name: 'Administrator sections' }).getByRole('link', { name: /^All listings/ }).click()
  await expect(page.getByRole('dialog')).toContainText('unsaved')
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width !== 320) await page.screenshot({ path: `../.local/admin-profile-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
})

test('an unavailable profile photo can be retried without blocking personal details', async ({ page }) => {
  const state = await fixture(page)
  state.failAvatar = true
  await page.goto('/profile')
  await expect(page.getByRole('alert')).toContainText('Photo unavailable.')
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Alex Reviewer')
  state.failAvatar = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
})

test('failed page download retains navigation and offers recovery instead of a blank error screen', async ({ page }) => {
  await fixture(page)
  await page.route(/\/(?:assets\/ReviewPages-[^/]+\.js|src\/components\/ReviewPages\.jsx)(?:\?.*)?$/, route => route.abort('failed'))
  await page.goto('/admin/listings')
  await page.getByRole('navigation', { name: 'Administrator sections' }).getByRole('link', { name: /^Reviews/ }).click()
  await expect(page.getByRole('heading', { name: 'This page needs a refresh.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh page', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Open listing directory', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All listings', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Administrator sections' }).getByRole('link', { name: /^Profile/ }).click()
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
})

for (const role of ['student', 'landlord']) test(`${role} Profile remains usable and cannot open admin routes`, async ({ page }) => {
  await fixture(page, role)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Alex Reviewer')
  await expect(page.getByRole('navigation', { name: 'Administrator sections' })).toHaveCount(0)
  await page.goto('/admin')
  await expect(page).toHaveURL(role === 'student' ? /\/account$/ : /\/landlord$/)
  await expect(page.getByRole('heading', { name: 'Listing review queue', exact: true })).toHaveCount(0)
})
