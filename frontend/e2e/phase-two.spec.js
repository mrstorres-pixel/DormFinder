import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { verifyDiscovery, withdrawSyntheticListings } from './discovery-flow'

test('landlord, administrator and student complete the listing and private inquiry workflow', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(300_000)
  const adminFile = process.env.E2E_ADMIN_FILE || '../.secrets/phase2-e2e-admin.json'
  const admin = JSON.parse((await readFile(adminFile, 'utf8')).replace(/^\uFEFF/, ''))
  const suffix = randomUUID()
  const password = 'Synthetic-8-' + randomUUID()
  const accountFile = new URL(`../../.secrets/discovery-browser-${baseURL.startsWith('https:') ? 'cloud' : 'local'}-${testInfo.project.name}.json`, import.meta.url)
  let accounts = {}
  try { accounts = JSON.parse(await readFile(accountFile, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const title = 'Synthetic Phase 2 Residence ' + suffix
  const contexts = []
  const errors = []
  const createdIds = []
  let ownerPage
  async function pageFor() {
    const context = await browser.newContext({ baseURL })
    contexts.push(context)
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(30_000)
    page.setDefaultTimeout(15_000)
    page.on('pageerror', error => errors.push(error.message))
    return page
  }
  async function register(page, role) {
    if (accounts[role]) {
      await page.goto('/login')
      await page.getByLabel('Email address').fill(accounts[role].email)
      await page.getByLabel('Password', { exact: true }).fill(accounts[role].password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(page).toHaveURL(role === 'landlord' ? /\/landlord$/ : /\/account$/)
      return
    }
    await page.goto('/register?role=' + role)
    await page.getByLabel('Your name', { exact: true }).fill('Synthetic Phase 2 ' + role)
    await page.getByLabel('Email address').fill(`${role}-${suffix}@example.test`)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page).toHaveURL(role === 'landlord' ? /\/landlord$/ : /\/account$/)
    accounts[role] = { email: `${role}-${suffix}@example.test`, password }
    await writeFile(accountFile, JSON.stringify(accounts), { mode: 0o600 })
  }
  try {
    const landlord = await pageFor()
    ownerPage = landlord
    await register(landlord, 'landlord')
    await landlord.getByRole('link', { name: '+ Add a property' }).click()
    await landlord.getByLabel('Property name').fill(title)
    await landlord.getByLabel('About the property').fill('Clearly marked synthetic residence for browser testing, with separate shared beds and whole-room inventory. This is not a real rental offer.')
    await landlord.getByLabel('Street address').fill('Synthetic test address, Quiapo, Manila')
    await landlord.getByLabel('Latitude (optional)').fill('14.598')
    await landlord.getByLabel('Longitude (optional)').fill('120.99')
    await landlord.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(landlord).toHaveURL(/\/landlord\/properties\/\d+$/)
    const propertyId = landlord.url().split('/').pop()
    createdIds.push(Number(propertyId))
    const png = await landlord.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32
      const drawing = canvas.getContext('2d'); drawing.fillStyle = '#17675b'; drawing.fillRect(0, 0, 32, 32)
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await landlord.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-room.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await landlord.getByLabel('Photo description').fill('Synthetic Phase 2 test illustration')
    await landlord.getByRole('button', { name: 'Upload photo', exact: true }).click()
    await expect(landlord.getByRole('img', { name: 'Synthetic Phase 2 test illustration' })).toBeVisible()
    await landlord.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-second-room.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await landlord.getByLabel('Photo description').fill('Synthetic second room illustration')
    await landlord.getByRole('button', { name: 'Upload photo', exact: true }).click()
    await expect(landlord.getByRole('img', { name: 'Synthetic second room illustration' })).toBeVisible()
    await landlord.getByLabel('Room option name').fill('Shared student beds')
    await landlord.getByLabel('Room capacity', { exact: true }).fill('4')
    await landlord.getByLabel('Total units', { exact: true }).fill('8')
    await landlord.getByLabel('Available units', { exact: true }).fill('3')
    await landlord.getByLabel('Monthly rent (PHP)').fill('3500.29')
    await landlord.getByLabel('Deposit (PHP)').fill('3500.29')
    await landlord.getByLabel('Advance rent in months').fill('1')
    await landlord.getByLabel('Utilities and other charge terms').fill('Water included; electricity is metered and billed separately.')
    await landlord.getByRole('button', { name: 'Add fixed fee' }).click()
    await landlord.getByLabel('Fee 1 name').fill('Internet')
    await landlord.getByLabel('Fee 1 amount (PHP)').fill('250.50')
    await landlord.getByRole('button', { name: 'Add room option', exact: true }).click()
    await expect(landlord.getByRole('heading', { name: 'Shared student beds', exact: true })).toBeVisible()
    await expect(landlord.getByText('₱3,750.79', { exact: true })).toBeVisible()
    await landlord.getByLabel('Room option name').fill('Private whole room')
    await landlord.getByLabel('Inventory and price basis').selectOption('whole_room')
    await landlord.getByLabel('Room capacity', { exact: true }).fill('2')
    await landlord.getByLabel('Total units', { exact: true }).fill('2')
    await landlord.getByLabel('Available units', { exact: true }).fill('1')
    await landlord.getByLabel('Monthly rent (PHP)').fill('8500')
    await landlord.getByLabel('Utilities and other charge terms').fill('All utilities billed at actual usage; no hidden fixed fees.')
    await landlord.getByRole('button', { name: 'Add room option', exact: true }).click()
    await expect(landlord.getByRole('heading', { name: 'Private whole room', exact: true })).toBeVisible()
    const guest = await browser.newContext({ baseURL }); contexts.push(guest)
    expect((await guest.request.get('/api/v1/listings/' + propertyId, { headers: { Accept: 'application/json' } })).status()).toBe(404)
    await landlord.getByLabel('These options describe separate inventory and do not double-count the same beds or rooms.').check()
    await landlord.getByRole('button', { name: 'Submit for review', exact: true }).click()
    await expect(landlord.getByText('Your listing is waiting for administrator review. Edits are locked during review.', { exact: true })).toBeVisible()
    await expect(landlord.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()

    const reviewer = await pageFor()
    await reviewer.goto('/login')
    await reviewer.getByLabel('Email address').fill(admin.email)
    await reviewer.getByLabel('Password', { exact: true }).fill(admin.password)
    await reviewer.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(reviewer.getByRole('heading', { name: 'Listing review queue', exact: true })).toBeVisible()
    await reviewer.goto('/admin/reviews/' + propertyId)
    await expect(reviewer.getByRole('heading', { name: 'Review: ' + title })).toBeVisible()
    await reviewer.getByLabel('I have checked the listing against these review criteria.').check()
    await reviewer.getByRole('button', { name: 'Save review decision', exact: true }).click()
    await expect(reviewer).toHaveURL(/\/admin$/)
    expect((await guest.request.get('/api/v1/listings/' + propertyId, { headers: { Accept: 'application/json' } })).status()).toBe(200)

    const student = await pageFor()
    await register(student, 'student')
    await student.goto('/listings?q=' + encodeURIComponent(title))
    await student.getByLabel('Room option for ' + title).selectOption({ label: 'Shared student beds' })
    await student.getByLabel('Compare ' + title, { exact: true }).check()
    await student.getByRole('link', { name: 'Compare 1 listing', exact: true }).click()
    await expect(student.getByRole('heading', { name: 'Compare your options', exact: true })).toBeVisible()
    await expect(student.getByText('₱3,750.79', { exact: true })).toBeVisible()
    await expect(student.getByText(/month · per person/)).toBeVisible()
    await student.getByRole('link', { name: 'View and ask owner' }).click()
    await expect(student.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await student.getByLabel('Your question').fill('Is this shared room quiet after 10 PM?')
    await student.getByRole('button', { name: 'Send private inquiry', exact: true }).click()
    await expect(student).toHaveURL(/\/inquiries\/\d+$/)
    const inquiryId = student.url().split('/').pop()
    await expect(student.getByText('Is this shared room quiet after 10 PM?', { exact: true })).toBeVisible()
    expect((await guest.request.get(`/api/v1/inquiries/${inquiryId}/messages`, { headers: { Accept: 'application/json' } })).status()).toBe(401)
    const adminDenied = await reviewer.evaluate(async inquiryId => {
      const response = await fetch(`/api/v1/inquiries/${inquiryId}/messages`, { headers: { Accept: 'application/json' } })
      return { status: response.status, body: await response.text() }
    }, inquiryId)
    expect(adminDenied.status).toBe(404)
    expect(adminDenied.body).not.toContain('quiet after 10 PM')
    await landlord.goto('/inquiries/' + inquiryId)
    await expect(landlord.getByText('Is this shared room quiet after 10 PM?', { exact: true })).toBeVisible()
    await landlord.getByLabel('Your reply').fill('Yes. Quiet hours start at 10 PM. This is synthetic test information.')
    await landlord.getByRole('button', { name: 'Send reply', exact: true }).click()
    await expect(landlord.getByText('Yes. Quiet hours start at 10 PM. This is synthetic test information.', { exact: true })).toBeVisible()
    await student.reload()
    await expect(student.getByText('Yes. Quiet hours start at 10 PM. This is synthetic test information.', { exact: true })).toBeVisible()
    await test.step('Phase 3 search, favorites, comparison, gallery and maps', async () => verifyDiscovery({ landlord, reviewer, student, originalId: propertyId, originalTitle: title, png }))
    await student.goto('/inquiries/' + inquiryId)
    for (const width of [360, 768, 1440]) {
      await student.setViewportSize({ width, height: 900 })
      expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await landlord.goto('/landlord/properties/' + propertyId)
    await landlord.getByLabel('Property name').fill(title + ' edited')
    await landlord.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(landlord.getByText('Your draft has been saved.', { exact: true })).toBeVisible()
    expect((await guest.request.get('/api/v1/listings/' + propertyId, { headers: { Accept: 'application/json' } })).status()).toBe(404)
    await student.reload()
    await expect(student.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(student.getByText('Yes. Quiet hours start at 10 PM. This is synthetic test information.', { exact: true })).toBeVisible()
    await student.getByLabel('Your reply').fill('Thank you. Please update me after the listing is reviewed again.')
    await student.getByRole('button', { name: 'Send reply', exact: true }).click()
    await expect(student.getByText('Thank you. Please update me after the listing is reviewed again.', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    try { if (ownerPage && !ownerPage.isClosed()) await withdrawSyntheticListings(ownerPage, createdIds) } finally {
      for (const context of contexts) {
        await context.close()
      }
    }
  }
})
