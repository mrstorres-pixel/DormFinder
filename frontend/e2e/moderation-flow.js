import { expect } from '@playwright/test'
import { apiWrite } from './discovery-flow'

async function get(page, path) {
  return page.evaluate(async path => {
    const response = await fetch('/api/v1' + path, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    return { status: response.status, body: await response.json() }
  }, path)
}

export async function verifyModeration({ landlord, reviewer, student, propertyId, title, inquiryId, ownerCredentials }) {
  const owner = (await get(landlord, '/me')).body.data
  expect(owner.role).toBe('landlord')
  expect(owner.name).toMatch(/^Synthetic /)
  expect(owner.email).toMatch(/@example\.test$/)
  const reason = 'Synthetic Phase 4 moderation verification only.'
  let restricted = false
  async function action(page, name, value) {
    await page.getByLabel('Listing action', { exact: true }).selectOption(value)
    await page.getByLabel('Reason for listing action').fill(reason)
    await page.getByLabel('I understand how this listing action affects publication and replies.').check()
    await page.getByRole('button', { name: 'Apply listing action', exact: true }).click()
    const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name, exact: true }) })
    await expect(panel.getByText('Current status:', { exact: false })).toContainText(value === 'restore' ? 'draft' : value === 'suspend' ? 'suspended' : 'archived')
  }
  async function publish() {
    const current = await get(landlord, '/landlord/properties/' + propertyId)
    expect((await apiWrite(landlord, '/landlord/properties/' + propertyId + '/submit', { revision: current.body.data.revision, inventory_confirmed: true })).status).toBe(200)
    await reviewer.goto('/admin/reviews/' + propertyId)
    await reviewer.getByLabel('I have checked the listing against these review criteria.').check()
    await reviewer.getByRole('button', { name: 'Save review decision', exact: true }).click()
    await expect(reviewer).toHaveURL(/\/admin$/)
  }
  try {
    await student.goto('/notifications')
    const notification = (await get(student, '/notifications')).body.data.find(row => row.kind === 'inquiry_message' && row.path === '/inquiries/' + inquiryId)
    expect(notification).toBeTruthy()
    expect(notification.title).not.toContain('Quiet hours')
    await student.getByRole('button', { name: 'Mark notification #' + notification.id + ' read', exact: true }).click()
    await expect(student.getByRole('button', { name: 'Mark notification #' + notification.id + ' read', exact: true })).toHaveCount(0)

    await student.goto('/listings/' + propertyId)
    await student.getByText('Report this listing', { exact: true }).click()
    await student.getByLabel('Report details').fill('Synthetic report: please inspect these listing details.')
    await student.getByRole('button', { name: 'Send listing report', exact: true }).click()
    await expect(student.getByRole('status').filter({ hasText: 'Your report has been received.' })).toBeVisible()
    await student.getByRole('link', { name: 'View your reports', exact: true }).click()
    await expect(student.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(student.locator('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) }).getByText('open', { exact: true })).toBeVisible()
    expect((await get(student, '/admin/reports')).status).toBe(403)
    expect((await get(landlord, '/reports')).status).toBe(403)
    await reviewer.goto('/admin/reports')
    const reported = reviewer.locator('article').filter({ has: reviewer.getByRole('heading', { name: title, exact: true }) })
    await reported.getByRole('link', { name: 'Inspect reported listing' }).click()
    await action(reviewer, 'Listing moderation', 'suspend')
    expect((await get(student, '/listings/' + propertyId)).status).toBe(404)
    await student.goto('/inquiries/' + inquiryId)
    await expect(student.getByText('Replies are paused because the listing or a participant is suspended. Earlier messages remain available to participants.')).toBeVisible()
    await expect(student.getByText('Is this shared room quiet after 10 PM?', { exact: true })).toBeVisible()
    expect((await get(reviewer, '/inquiries/' + inquiryId + '/messages')).status).toBe(404)
    await landlord.goto('/landlord/properties/' + propertyId)
    await expect(landlord.getByText('Only an administrator can restore a suspended listing.')).toBeVisible()
    const suspended = await get(landlord, '/landlord/properties/' + propertyId)
    expect((await apiWrite(landlord, '/landlord/properties/' + propertyId + '/lifecycle', { revision: suspended.body.data.revision, action: 'restore', reason })).status).toBe(409)

    await reviewer.goto('/admin/reports')
    const report = reviewer.locator('article').filter({ has: reviewer.getByRole('heading', { name: title, exact: true }) })
    await report.getByLabel('Private resolution notes').fill(reason)
    await report.getByRole('button', { name: /Close report #/ }).click()
    await expect(report).toHaveCount(0)
    await student.goto('/reports')
    await expect(student.locator('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) }).getByText('resolved', { exact: true })).toBeVisible()
    await expect(student.getByText(reason, { exact: true })).toHaveCount(0)
    await reviewer.goto('/admin/reviews/' + propertyId)
    await action(reviewer, 'Listing moderation', 'restore')
    expect((await get(student, '/listings/' + propertyId)).status).toBe(404)
    await publish()

    await landlord.goto('/landlord/properties/' + propertyId)
    await action(landlord, 'Archive and restore', 'archive')
    await student.goto('/inquiries/' + inquiryId)
    await expect(student.getByLabel('Your reply')).toBeVisible()
    expect((await get(student, '/listings/' + propertyId)).status).toBe(404)
    await action(landlord, 'Archive and restore', 'restore')
    await publish()

    await reviewer.goto('/admin/users?id=' + owner.id)
    await reviewer.getByLabel('Reason for account action #' + owner.id).fill(reason)
    await reviewer.getByLabel('Confirm suspend account #' + owner.id).check()
    restricted = true
    await reviewer.getByRole('button', { name: 'Suspend account #' + owner.id, exact: true }).click()
    await expect(reviewer.getByRole('button', { name: 'Reactivate account #' + owner.id, exact: true })).toBeDisabled()
    expect((await get(landlord, '/me')).status).toBe(401)
    expect((await get(student, '/listings/' + propertyId)).status).toBe(404)
    await student.goto('/inquiries/' + inquiryId)
    await expect(student.getByLabel('Your reply')).toHaveCount(0)
    await reviewer.getByLabel('Reason for account action #' + owner.id).fill(reason)
    await reviewer.getByLabel('Confirm reactivate account #' + owner.id).check()
    await reviewer.getByRole('button', { name: 'Reactivate account #' + owner.id, exact: true }).click()
    await expect(reviewer.getByRole('button', { name: 'Suspend account #' + owner.id, exact: true })).toBeDisabled()
    restricted = false
    await reviewer.setViewportSize({ width: 360, height: 900 })
    expect(await reviewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await reviewer.setViewportSize({ width: 1280, height: 900 })
    expect((await get(landlord, '/me')).status).toBe(401)
    await landlord.goto('/login')
    await landlord.getByLabel('Email address').fill(ownerCredentials.email)
    await landlord.getByLabel('Password', { exact: true }).fill(ownerCredentials.password)
    await landlord.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(landlord).toHaveURL(/\/landlord$/)
    const restored = (await get(landlord, '/landlord/properties/' + propertyId)).body.data
    expect(restored.status).toBe('draft')
    expect((await get(student, '/listings/' + propertyId)).status).toBe(404)
    await reviewer.goto('/admin/audit')
    await expect(reviewer.getByRole('heading', { name: 'account reactivate', exact: true }).first()).toBeVisible()
    await expect(reviewer.getByRole('heading', { name: 'report closed', exact: true }).first()).toBeVisible()
    await reviewer.goto('/admin')
    await expect(reviewer.getByText('Open reports', { exact: true })).toBeVisible()
    for (const width of [360, 768, 1440]) {
      await reviewer.setViewportSize({ width, height: 900 })
      expect(await reviewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  } finally {
    if (restricted) {
      const users = (await get(reviewer, '/admin/users?id=' + owner.id)).body.data
      const current = users.find(user => user.id === owner.id)
      if (current?.status === 'suspended') {
        expect((await apiWrite(reviewer, '/admin/users/' + owner.id + '/moderation', { action: 'reactivate', revision: current.moderation_revision, reason: 'Synthetic test recovery after an interrupted check.' })).status).toBe(200)
      }
    }
  }
}
