import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('existing cloud accounts read their role workspace and notification windows', async ({ browser, baseURL }, testInfo) => {
  test.skip(!baseURL.startsWith('https:'), 'Read-only production acceptance uses existing cloud test accounts.')
  test.setTimeout(120_000)
  const read = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
  const accounts = await read(new URL(`../../.secrets/discovery-browser-cloud-${testInfo.project.name}.json`, import.meta.url))
  const admin = await read(process.env.E2E_ADMIN_FILE || '../.secrets/phase2-cloud-admin.json')
  for (const role of ['student', 'landlord', 'admin']) {
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      await page.goto('/login')
      expect((await page.request.get('/api/v1/notifications/unread-count', { headers: { Accept: 'application/json' } })).status()).toBe(401)
      const account = role === 'admin' ? admin : accounts[role]
      await page.getByLabel('Email').fill(account.email)
      await page.getByLabel('Password', { exact: true }).fill(account.password)
      const endpoint = { student: '/api/v1/saved-places', landlord: '/api/v1/landlord/properties', admin: '/api/v1/admin/reviews' }[role]
      const workspace = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(endpoint) && response.status() === 200)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      const rows = (await (await workspace).json()).data
      const unreadResponse = await page.evaluate(async () => { const response = await fetch('/api/v1/notifications/unread-count', { credentials: 'include', headers: { Accept: 'application/json' } }); return { status: response.status, body: await response.json() } })
      expect(unreadResponse.status).toBe(200)
      const unread = unreadResponse.body.data.unread_count
      expect(Number.isSafeInteger(unread) && unread >= 0).toBe(true)
      await expect(page.locator('.notification-bell')).toHaveAttribute('aria-label', unread ? `Notifications — ${unread} unread` : 'Notifications')
      await expect(page.locator('.notification-unread-dot')).toHaveCount(unread ? 1 : 0)
      await expect(page).toHaveURL(role === 'student' ? /\/account$/ : role === 'landlord' ? /\/landlord$/ : /\/admin$/)
      const workspaceUrl = page.url()
      const notifications = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/v1/notifications') && response.status() === 200)
      await page.locator('.notification-bell').click()
      const updates = (await (await notifications).json()).data
      const popup = page.getByRole('dialog', { name: 'Notifications', exact: true })
      await expect(popup.locator('.notification-item')).toHaveCount(Math.min(updates.length, 5))
      if (updates.length) await expect(popup.getByRole('link').first()).toHaveText(updates[0].title)
      await expect(page).toHaveURL(workspaceUrl)
      await page.getByRole('button', { name: 'Expand notifications' }).click()
      await expect(page.locator('.notifications-expanded .notification-item')).toHaveCount(updates.length)
      await page.getByRole('button', { name: 'Close notifications' }).click()
      await expect(page.locator('.notification-bell')).toBeFocused()
      await expect(page.locator('.notification-unread-dot')).toHaveCount(unread ? 1 : 0)
      if (role === 'student') {
        await expect(page.getByRole('heading', { name: 'Your space', exact: true })).toBeVisible()
        await expect(page.locator('.dashboard-counts')).toHaveCount(0)
        if (rows.length) await expect(page.locator('.space-saved').getByRole('heading', { name: rows[0].listing?.title || rows[0].listing_snapshot.title, exact: true })).toBeVisible()
        await page.getByRole('link', { name: 'Edit profile' }).click()
        await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible()
        await expect(page.locator('.settings-email')).toHaveText(account.email)
        await expect(page.getByLabel('Current password')).toBeHidden()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        continue
      }
      await expect(page.getByRole('heading', { name: role === 'landlord' ? 'Your properties' : 'Listing review queue', exact: true })).toBeVisible()
      await expect(page.locator('.dashboard-counts')).toHaveCount(0)
      if (role === 'landlord') await expect(page.getByRole('link', { name: '+ Add a property' })).toBeVisible()
      else await expect(page.getByRole('navigation', { name: 'Administrator sections' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    } finally { await context.close() }
  }
})
