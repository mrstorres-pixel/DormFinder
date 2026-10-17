import { test, expect } from '@playwright/test'

async function notifications(page, { failed = false, guest = false } = {}) {
  const state = { unread: 1, failRead: true, reads: 0 }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1 } } })
    if (path.endsWith('/me')) return guest ? route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }) : json({ id: 987, name: 'Alex Student', role: 'student' })
    if (path.endsWith('/notifications/unread-count')) { state.reads++; return failed ? route.fulfill({ status: 503, json: { message: 'Synthetic unread status outage' } }) : json({ unread_count: state.unread }) }
    if (path.endsWith('/notifications/1/read')) {
      if (state.failRead) { state.failRead = false; return route.fulfill({ status: 503, json: { message: 'Synthetic mark-read failure' } }) }
      state.unread = 0; return json({ id: 1 })
    }
    if (path.endsWith('/notifications')) {
      const pageNumber = Number(url.searchParams.get('page')) || 1
      const rows = pageNumber === 1 ? Array.from({ length: 20 }, (_, index) => ({ id: index + 2, title: 'Earlier update ' + index, path: '/saved', read_at: '2026-10-16T08:00:00Z', created_at: '2026-10-16T08:00:00Z' })) : [{ id: 1, title: 'Owner replied', path: '/inquiries/7', read_at: state.unread ? null : '2026-10-16T08:00:00Z', created_at: '2026-10-15T08:00:00Z' }]
      return route.fulfill({ json: { data: rows, current_page: pageNumber, last_page: 2 } })
    }
    return json([])
  })
  return state
}

test('navbar bell stays visible on phones and reflects unread notifications beyond the first page', async ({ page }, testInfo) => {
  await page.clock.install()
  const state = await notifications(page)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Your space', exact: true })).toBeVisible()
  const bell = page.getByRole('link', { name: 'Notifications — 1 unread', exact: true })
  await expect(bell).toBeVisible()
  await expect(bell.locator('.notification-unread-dot')).toBeVisible()
  await page.locator('.account-menu > summary').click()
  await expect(page.locator('.account-menu').getByRole('link', { name: 'Your reports' })).toHaveCount(0)
  await expect(page.locator('.account-menu').getByRole('link', { name: 'Notifications' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 360, height: 800 })
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
  await expect(bell).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/notification-bell-${testInfo.project.name}-mobile.png` })
  await bell.click()
  await expect(page.getByRole('heading', { name: 'Your notifications' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mark notification/ })).toHaveCount(0)
  await expect(bell).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const markRead = page.getByRole('button', { name: 'Mark notification #1 read' })
  await markRead.click()
  await expect(page.getByRole('alert')).toContainText('Synthetic mark-read failure')
  await expect(bell).toBeVisible()
  await markRead.click()
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()
  state.unread = 1
  await page.clock.fastForward(45_001)
  await expect(page.getByRole('link', { name: 'Notifications — 1 unread', exact: true })).toBeVisible()
  await expect(page.locator('.notification-unread-dot')).toBeVisible()
})

test('unknown unread status stays usable and guests do not request private notification data', async ({ page }) => {
  await notifications(page, { failed: true })
  await page.goto('/account')
  await expect(page.getByRole('link', { name: 'Notifications — unread status unavailable' })).toBeVisible()
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0)
  await page.unroute('**/api/v1/**')
  const guest = await notifications(page, { guest: true })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.locator('.notification-bell')).toHaveCount(0)
  expect(guest.reads).toBe(0)
})

test('campus stays prominent and price labels retain anchors at their actual coordinate positions', async ({ page }, testInfo) => {
  const campus = { id: 8, name: 'Synthetic University', institution_name: 'Synthetic University', city: 'Manila', latitude: 14.6, longitude: 120.98 }
  const room = { id: 21, name: 'Shared room', capacity: 2, price_basis: 'per_person', inventory_type: 'bedspace', monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 425000, available_units: 2, availability_stale: false }
  const places = [{ id: 1, title: 'Northwest room', latitude: 14.6037, longitude: 120.9755 }, { id: 2, title: 'Southeast room', latitude: 14.5971, longitude: 120.9842 }].map(place => ({ ...place, city: 'Manila', property_type: 'dormitory', is_demo: true, photos: [], room_options: [room] }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64') }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } })
    return route.fulfill({ json: { data: path.endsWith('/campuses') ? [campus] : places, meta: { current_page: 1, last_page: 1, total: 2, limit: 200 } } })
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings?campus_id=8')
  const map = page.getByRole('region', { name: 'Listing map', exact: true })
  await expect(map.locator('.price-marker')).toHaveCount(2)
  await expect(map.locator('.campus-pin-label')).toHaveText('Campus')
  await expect(map.locator('.campus-marker')).toHaveAttribute('title', /Synthetic University.*selected campus/)
  const positions = await map.evaluate((node, { places, campus }) => {
    const rect = node.getBoundingClientRect(), center = node.querySelector('.campus-pin').getBoundingClientRect()
    const pixel = point => { const sin = Math.sin(point.latitude * Math.PI / 180); return { x: (point.longitude + 180) / 360 * 256 * 2 ** 15, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 256 * 2 ** 15 } }
    const reference = pixel(campus)
    return { campusError: Math.hypot(center.x + center.width / 2 - rect.x - rect.width / 2, center.y + center.height / 2 - rect.y - rect.height / 2), campusZ: Number(getComputedStyle(node.querySelector('.campus-marker')).zIndex), pins: places.map(place => { const pin = [...node.querySelectorAll('.price-marker')].find(pin => pin.title.startsWith(place.title)), bounds = pin.getBoundingClientRect(), expected = pixel(place), style = getComputedStyle(pin); return { error: Math.hypot(bounds.x - parseFloat(style.marginLeft) - rect.x - rect.width / 2 - expected.x + reference.x, bounds.y - parseFloat(style.marginTop) - rect.y - rect.height / 2 - expected.y + reference.y), z: Number(style.zIndex) } }) }
  }, { places, campus })
  expect(positions.campusError).toBeLessThan(2)
  for (const pin of positions.pins) { expect(pin.error).toBeLessThan(2); expect(positions.campusZ).toBeGreaterThan(pin.z) }
  await expect(page.getByText(/Demo pins are fictional/)).toBeVisible()
  await page.screenshot({ path: `../.local/campus-marker-${testInfo.project.name}-desktop.png`, fullPage: true })
  await map.locator('.campus-pin').click()
  await expect(map.locator('.leaflet-popup-content')).toContainText('Synthetic University — approximate campus reference')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(map.locator('.campus-pin-label')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `../.local/campus-marker-${testInfo.project.name}-mobile.png`, fullPage: true })
})
