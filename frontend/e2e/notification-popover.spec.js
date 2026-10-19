import { test, expect } from '@playwright/test'

async function fixture(page, { role = 'student', empty = false, failed = false } = {}) {
  const state = { feedRequests: 0, failed }
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1 } } })
    if (path.endsWith('/me')) return role === 'guest' ? route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }) : json({ id: 987, name: 'Alex Student', email: 'fixture@example.test', role })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: empty ? 0 : 2 })
    if (path.endsWith('/notifications')) {
      state.feedRequests++
      if (state.failed) return route.fulfill({ status: 503, json: { message: 'Synthetic notification outage' } })
      return json(empty ? [] : Array.from({ length: 8 }, (_, index) => ({ id: index + 1, title: index ? 'A viewing request was updated.' : 'You have a new private inquiry message.', path: '/saved', created_at: '2026-10-19T08:00:00Z', read_at: index < 2 ? null : '2026-10-19T09:00:00Z' })))
    }
    return json([])
  })
  return state
}

test('popup anchors to the bell, expands over the current page, and supports keyboard dismissal', async ({ page }, testInfo) => {
  const state = await fixture(page, { role: 'admin' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible()
  const bell = page.locator('.notification-bell')
  await expect(bell).toBeVisible()
  expect(state.feedRequests).toBe(0)
  await bell.click()
  const popup = page.locator('.notification-popover')
  await expect(popup.locator('.notification-item')).toHaveCount(5)
  const button = await bell.boundingBox(), panel = await popup.boundingBox()
  expect(panel.y).toBeGreaterThanOrEqual(button.y + button.height)
  expect(Math.abs(panel.x + panel.width - button.x - button.width)).toBeLessThan(2)
  await page.screenshot({ path: `../.local/notification-popover-${testInfo.project.name}-desktop.png` })
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(bell).toBeFocused()
  await bell.click()
  await page.getByRole('heading', { name: 'Your profile', exact: true }).click()
  await expect(popup).toHaveCount(0)
  await bell.click()
  await page.getByRole('button', { name: 'Expand notifications' }).click()
  const modal = page.getByRole('dialog', { name: 'Notifications', exact: true })
  await expect(modal).toHaveAttribute('open', '')
  await expect(modal.locator('.notification-item')).toHaveCount(8)
  await expect(page).toHaveURL(/\/profile$/)
  await page.keyboard.press('Shift+Tab')
  await expect(modal.locator('a,button').last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(modal.getByRole('button', { name: 'Close notifications' })).toBeFocused()
  await page.screenshot({ path: `../.local/notification-expanded-${testInfo.project.name}-desktop.png` })
  await page.keyboard.press('Escape')
  await expect(bell).toBeFocused()
})

test('notification windows preserve a profile draft and notification links respect its navigation guard', async ({ page }, testInfo) => {
  await fixture(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profile')
  const name = page.getByLabel('Your name', { exact: true })
  await name.fill('Keep this unsaved profile')
  const bell = page.locator('.notification-bell')
  await bell.click()
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 740, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => {
      const box = await page.locator('.notification-popover').boundingBox()
      return box.x >= 8 && box.x + box.width <= viewport.width - 8 && box.y + box.height <= viewport.height - 8
    }).toBe(true)
    await expect(page.getByRole('button', { name: 'Expand notifications' })).toBeInViewport()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await page.locator('.notification-popover').boundingBox()).x).toBeLessThanOrEqual(13)
  await expect(page.locator('.notification-popover').getByRole('link').last()).toBeInViewport()
  await page.screenshot({ path: `../.local/notification-popover-${testInfo.project.name}-mobile.png` })
  await page.getByRole('button', { name: 'Expand notifications' }).click()
  await page.getByRole('button', { name: 'Close notifications' }).click()
  await expect(name).toHaveValue('Keep this unsaved profile')
  await bell.click()
  await page.getByRole('link', { name: 'You have a new private inquiry message.' }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(name).toHaveValue('Keep this unsaved profile')
  await expect(page).toHaveURL(/\/profile$/)
})

test('errors can be retried, empty updates stay compact, and old links open the expanded window', async ({ page }) => {
  const state = await fixture(page, { failed: true, empty: true })
  await page.goto('/account')
  await page.locator('.notification-bell').click()
  await expect(page.getByRole('alert')).toContainText('Synthetic notification outage')
  state.failed = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('No notifications yet.', { exact: true })).toBeVisible()
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0)
  await page.goto('/notifications')
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('.notifications-expanded')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your notifications' })).toHaveCount(0)
})

test('guest Sign in label is centered on desktop and inside the phone menu', async ({ page }) => {
  const state = await fixture(page, { role: 'guest' })
  await page.goto('/login')
  await page.evaluate(() => document.fonts.ready)
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport)
    if (viewport.width < 600) await page.getByRole('button', { name: 'Menu', exact: true }).click()
    const signIn = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Sign in', exact: true })
    await expect(signIn).toBeVisible()
    const offset = await signIn.evaluate(node => {
      const button = node.getBoundingClientRect(), range = document.createRange()
      range.selectNodeContents(node)
      const text = range.getBoundingClientRect()
      return { x: text.x + text.width / 2 - button.x - button.width / 2, y: text.y + text.height / 2 - button.y - button.height / 2 }
    })
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(1)
  }
  expect(state.feedRequests).toBe(0)
})
