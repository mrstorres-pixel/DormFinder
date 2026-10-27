import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { apiWrite } from './discovery-flow'

test('a real owner draft reaches admin review and publication with saved search context', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(240_000)
  const cloud = baseURL.startsWith('https:')
  const accounts = JSON.parse((await readFile(`../.secrets/discovery-browser-${cloud ? 'cloud' : 'local'}-${testInfo.project.name}.json`, 'utf8')).replace(/^\uFEFF/, ''))
  const admin = JSON.parse((await readFile(process.env.E2E_ADMIN_FILE || (cloud ? '../.secrets/phase2-cloud-admin.json' : '../.secrets/phase2-e2e-admin.json'), 'utf8')).replace(/^\uFEFF/, ''))
  const contexts = [await browser.newContext({ baseURL }), await browser.newContext({ baseURL })]
  const [owner, reviewer] = await Promise.all(contexts.map(context => context.newPage()))
  const title = 'Synthetic workflow ' + randomUUID()
  let id
  const errors = []
  for (const page of [owner, reviewer]) page.on('pageerror', error => errors.push(error.message))
  async function login(page, credentials) {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(credentials.email)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }
  try {
    await login(owner, accounts.landlord)
    await expect(owner).toHaveURL(/\/landlord$/, { timeout: 45_000 })
    await owner.getByRole('link', { name: 'Add a property' }).click()
    await owner.getByLabel('Property name').fill(title)
    await owner.getByRole('button', { name: 'Start listing' }).click()
    await expect(owner).toHaveURL(/\/landlord\/properties\/\d+#photos$/)
    id = new URL(owner.url()).pathname.split('/').pop()
    const png = await owner.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; canvas.getContext('2d').fillRect(0, 0, 32, 32); return canvas.toDataURL('image/png').split(',')[1] })
    await owner.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await owner.getByLabel('Photo description').fill('Synthetic workflow image')
    await owner.getByRole('button', { name: 'Upload photo', exact: true }).click()
    const photo = owner.getByRole('img', { name: 'Synthetic workflow image', exact: true })
    await expect(photo).toBeVisible()
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
    await owner.getByRole('button', { name: 'Continue', exact: true }).click()
    await owner.getByLabel('Room option name').fill('Synthetic twin beds')
    await owner.getByLabel('Room capacity', { exact: true }).fill('2')
    await owner.getByLabel('Total units', { exact: true }).fill('2')
    await owner.getByLabel('Available units', { exact: true }).fill('1')
    await owner.getByLabel('Monthly rent (PHP)').fill('4000')
    await owner.getByLabel('Utilities and other charge terms').fill('Synthetic terms. Water included, electricity metered.')
    await owner.getByRole('button', { name: 'Save and continue', exact: true }).click()
    await expect(owner).toHaveURL(/#location$/)
    await owner.getByLabel('Street address').fill('Synthetic test address, Manila')
    await owner.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(owner.getByRole('status').filter({ hasText: 'Your changes have been saved.' })).toBeVisible()
    await expect(owner).toHaveURL(/#location$/)
    await owner.getByLabel('About the property').fill('Synthetic residence for verifying required listing details and administrator review. This is not a real rental offer.')
    await owner.getByLabel('Latitude', { exact: true }).fill('14.598')
    await owner.getByLabel('Longitude', { exact: true }).fill('120.99')
    await owner.getByRole('button', { name: 'Save and continue' }).click()
    await expect(owner.getByRole('heading', { name: 'Ready for review', exact: true })).toBeVisible()
    await owner.getByLabel('These options describe separate inventory and do not double-count the same beds or rooms.').check()
    await owner.getByRole('button', { name: 'Submit for review', exact: true }).click()
    await expect(owner.getByRole('heading', { name: 'In review', exact: true })).toBeVisible()
    await login(reviewer, admin)
    await expect(reviewer).toHaveURL(/\/admin$/, { timeout: 45_000 })
    await reviewer.getByLabel('Search listings', { exact: true }).fill(title)
    await reviewer.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(reviewer.getByRole('status')).toContainText('1 submission')
    await reviewer.getByRole('link', { name: 'Review ' + title, exact: true }).click()
    await reviewer.getByLabel('I have checked the listing against these review criteria.').check()
    await reviewer.getByRole('button', { name: 'Approve listing', exact: true }).click()
    await expect(reviewer).toHaveURL(/\/admin\?q=/)
    await expect(reviewer.getByRole('heading', { name: 'No matching submissions' })).toBeVisible()
    expect((await reviewer.request.get('/api/v1/listings/' + id)).status()).toBe(200)
    await reviewer.goto('/admin/listings?q=' + encodeURIComponent(title))
    await expect(reviewer.locator('tbody')).toContainText(title)
    await expect(reviewer.locator('tbody')).toContainText('approved')
    await reviewer.goto('/admin/audit?q=' + encodeURIComponent(title))
    await expect(reviewer.locator('.admin-audit-list')).toContainText('Awaiting review')
    await expect(reviewer.locator('.admin-audit-list')).toContainText('approved')
    expect(errors).toEqual([])
  } finally {
    if (id) {
      const result = await owner.evaluate(async id => { const response = await fetch('/api/v1/landlord/properties/' + id, { headers: { Accept: 'application/json' } }); return response.ok ? (await response.json()).data : null }, id)
      if (result && result.status !== 'archived') expect((await apiWrite(owner, `/landlord/properties/${id}/lifecycle`, { action: 'archive', revision: result.revision, reason: 'Synthetic workflow acceptance finished; retain history privately.' })).status).toBe(200)
    }
    await Promise.all(contexts.map(context => context.close()))
  }
})
