import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('existing cloud accounts read their student space and operational dashboards', async ({ browser, baseURL }, testInfo) => {
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
      const dashboard = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(role === 'student' ? '/api/v1/saved-places' : '/api/v1/dashboard') && response.status() === 200)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      const counts = (await (await dashboard).json()).data
      const unreadResponse = await page.evaluate(async () => { const response = await fetch('/api/v1/notifications/unread-count', { credentials: 'include', headers: { Accept: 'application/json' } }); return { status: response.status, body: await response.json() } })
      expect(unreadResponse.status).toBe(200)
      const unread = unreadResponse.body.data.unread_count
      expect(Number.isSafeInteger(unread) && unread >= 0).toBe(true)
      await expect(page.locator('.notification-bell')).toHaveAttribute('aria-label', unread ? `Notifications — ${unread} unread` : 'Notifications')
      await expect(page.locator('.notification-unread-dot')).toHaveCount(unread ? 1 : 0)
      await expect(page).toHaveURL(role === 'student' ? /\/account$/ : role === 'landlord' ? /\/landlord$/ : /\/admin$/)
      if (role === 'student') {
        await expect(page.getByRole('heading', { name: 'Your space', exact: true })).toBeVisible()
        await expect(page.locator('.dashboard-counts')).toHaveCount(0)
        if (counts.length) await expect(page.locator('.space-saved').getByRole('heading', { name: counts[0].listing?.title || counts[0].listing_snapshot.title, exact: true })).toBeVisible()
        await page.getByRole('link', { name: 'Edit profile' }).click()
        await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible()
        await expect(page.locator('.settings-email')).toHaveText(account.email)
        await expect(page.getByLabel('Current password')).toBeHidden()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        continue
      }
      await expect(page.getByRole('heading', { name: 'Your next steps' })).toBeVisible()
      const notificationCard = page.locator('.dashboard-counts > div').filter({ has: page.getByRole('link', { name: 'Unread notifications', exact: true }) })
      await expect(notificationCard.locator('dd')).toHaveText(String(counts.unread_notifications))
      const practicalCounts = role === 'admin'
        ? { older_reviews: ['Reviews waiting over two days', '/admin'] }
        : {
            upcoming_viewings: ['Upcoming viewings', '/viewings?status=accepted'],
            pending_viewings: ['Viewing decisions waiting', role === 'student' ? '/viewings?status=proposed' : '/viewings?status=requested'],
            awaiting_reply: ['Awaiting your reply', '/inquiries'],
            ...(role === 'student' ? { shortlists: ['Private shortlists', '/shortlists'] } : { stale_listings: ['Availability needs updating', '/landlord'] }),
          }
      for (const [key, [label, destination]] of Object.entries(practicalCounts)) {
        expect(Number.isInteger(counts[key])).toBe(true)
        const card = page.locator('.dashboard-counts > div').filter({ has: page.getByRole('link', { name: label, exact: true }) })
        await expect(card.locator('dd')).toHaveText(String(counts[key]))
        await expect(card.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', destination)
      }
      if (role === 'student') await expect(page.getByRole('link', { name: 'Compare your shortlist' })).toHaveAttribute('href', '/compare')
      else if (role === 'landlord') await expect(page.getByRole('link', { name: 'Respond to students' })).toHaveAttribute('href', '/inquiries')
      else await expect(page.getByRole('link', { name: 'Follow up on reports' })).toHaveAttribute('href', '/admin/reports')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    } finally { await context.close() }
  }
})
