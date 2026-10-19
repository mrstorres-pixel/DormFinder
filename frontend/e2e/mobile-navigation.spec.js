import { test, expect } from '@playwright/test'

async function fixture(page, role = 'student') {
  const thread = { id: 7, property_id: 1, participant_name: 'Jamie Owner', can_reply: true, property_status: 'approved', last_message_body: 'See you soon.', listing_snapshot: { title: 'Fictional Campus House', room_option: { name: 'Twin room' } } }
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1 } } })
    if (path.endsWith('/me')) return role === 'guest' ? route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }) : json({ id: 987, name: 'Alex Student', role, preferred_campus_id: 8 })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 1 })
    if (path.endsWith('/inquiries/7')) return json(thread)
    if (path.endsWith('/inquiries/7/messages')) return json([{ id: 1, sender_id: 7, sender_name: 'Jamie Owner', body: 'See you soon.', created_at: '2026-10-16T00:00:00Z' }])
    if (path.endsWith('/inquiries')) return json([thread])
    return json([])
  })
}

test('mobile student navigation is direct, role-aware and leaves the conversation composer usable', async ({ page }, testInfo) => {
  await fixture(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/inquiries/7')
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
  await expect(nav.getByRole('link')).toHaveCount(4)
  await expect(nav.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden()
  const bell = page.getByRole('button', { name: 'Notifications — 1 unread', exact: true })
  await expect(bell).toBeVisible()
  await expect(page.locator('.account-menu .person-avatar')).toBeVisible()
  await page.locator('.account-menu > summary').click()
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  const reply = page.getByLabel('Your reply')
  await reply.fill('Keep this unsent message')
  for (const viewport of [{ width: 390, height: 844 }, { width: 740, height: 390 }, { width: 390, height: 480 }]) {
    await page.setViewportSize(viewport)
    const composer = await page.locator('.chat-compose').boundingBox(), tabs = await nav.boundingBox()
    expect(composer.y + composer.height).toBeLessThanOrEqual(tabs.y + 1)
    await expect(reply).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `../.local/mobile-navigation-chat-${testInfo.project.name}.png` })
  await nav.getByRole('link', { name: 'Saved places' }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(reply).toHaveValue('Keep this unsent message')
  await nav.getByRole('link', { name: 'Saved places' }).click()
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(nav.getByRole('link', { name: 'Saved places' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Viewings' }).click()
  await expect(nav.getByRole('link', { name: 'Viewings' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Browse' }).click()
  await expect(page).toHaveURL(/campus_id=8/)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(nav).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Browse', exact: true })).toBeVisible()
})

test('mobile landlord gets Properties while guest and admin retain their existing header navigation', async ({ page }) => {
  for (const role of ['landlord', 'admin', 'guest']) {
    await fixture(page, role)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/listings')
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
    if (role === 'landlord') {
      await expect(nav.getByRole('link', { name: 'Properties' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Saved places' })).toHaveCount(0)
    } else {
      await expect(nav).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
