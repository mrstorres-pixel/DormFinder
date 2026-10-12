import { test, expect } from '@playwright/test'

test('reply drafts remain protected after a failed send and clear after success', async ({ page }) => {
  let sends = 0
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/me')) return route.fulfill({ json: { data: { id: 987, name: 'Synthetic participant', role: 'student' } } })
    if (path.endsWith('/inquiries/987')) return route.fulfill({ json: { data: { id: 987, participant_name: 'Synthetic owner', listing_snapshot: { title: 'Synthetic conversation', room_option: { name: 'Shared beds' } }, property_status: 'approved', can_reply: true } } })
    if (path.endsWith('/inquiries/987/messages') && route.request().method() === 'POST') {
      sends++
      return sends === 1 ? route.fulfill({ status: 500, json: { message: 'Synthetic reply failure' } }) : route.fulfill({ json: { data: { id: 9 } } })
    }
    return route.fulfill({ json: { data: [], meta: { current_page: 1, last_page: 1 } } })
  })
  await page.goto('/inquiries/987')
  await page.getByLabel('Your reply').fill('Synthetic reply that should survive a failed request.')
  await page.getByRole('button', { name: 'Send reply', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic reply failure')
  await page.getByRole('link', { name: /Your inquiries/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByLabel('Your reply')).toHaveValue('Synthetic reply that should survive a failed request.')
  await page.getByRole('button', { name: 'Send reply', exact: true }).click()
  await expect(page.getByLabel('Your reply')).toHaveValue('')
  await page.getByRole('link', { name: /Your inquiries/ }).click()
  await expect(page).toHaveURL(/\/inquiries$/)
  await expect(page.getByRole('heading', { name: 'Your inquiries', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})
