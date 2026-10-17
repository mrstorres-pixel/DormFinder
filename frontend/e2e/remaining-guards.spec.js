import { test, expect } from '@playwright/test'

async function mockOwner(page, overrides = {}) {
  const property = { id: 987, title: 'Synthetic protected draft', description: 'A synthetic listing used to test safe form behavior.', address: 'Sample address', city: 'Manila', status: 'draft', revision: 1, amenities: [], house_rules: '', latitude: 14.6, longitude: 121, photos: [], room_options: [] }
  Object.assign(property, overrides)
  let roomRemovals = 0
  const uploadIds = []
  let uploads = 0
  let submissions = 0
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/me')) return route.fulfill({ json: { data: { id: 987, name: 'Synthetic owner', role: 'landlord' } } })
    if (path.endsWith('/photos') && route.request().method() === 'POST') {
      uploads++
      uploadIds.push(route.request().postDataBuffer().toString().match(/name="upload_id"\r\n\r\n([^\r]+)/)?.[1])
      return route.fulfill(uploads === 1 ? { status: 503, json: { message: 'Synthetic upload failure' } } : { json: { data: {} } })
    }
    if (path.endsWith('/room-options/1') && route.request().method() === 'DELETE') { roomRemovals++; return route.fulfill({ json: { data: property } }) }
    if (path.endsWith('/submit')) { submissions++; return route.fulfill({ json: { data: { ...property, status: 'pending_review' } } }) }
    if (path.endsWith('/landlord/properties/987')) {
      if (route.request().method() === 'PATCH') Object.assign(property, route.request().postDataJSON(), { revision: property.revision + 1 })
      return route.fulfill({ json: { data: property } })
    }
    return route.fulfill({ json: { data: [], meta: { last_page: 1, current_page: 1 } } })
  })
  return { roomRemovals: () => roomRemovals, uploadIds: () => uploadIds, uploads: () => uploads, submissions: () => submissions }
}

test('photo selections survive failure and saving another form; submission preserves pending edits', async ({ page }) => {
  const calls = await mockOwner(page)
  await page.goto('/landlord/properties/987')
  const caption = page.getByLabel('Photo description')
  await caption.fill('Unsent private photo caption')
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('synthetic mock upload') })
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Location & details', exact: true }).click()
  await page.getByLabel('Property name').fill('Saved synthetic property')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Your draft has been saved')
  await expect(caption).toHaveValue('Unsent private photo caption')
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Preview & review', exact: true }).click()
  await page.getByLabel('These options describe separate inventory and do not double-count the same beds or rooms.').check()
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeDisabled()
  expect(calls.submissions()).toBe(0)
  await expect(caption).toHaveValue('Unsent private photo caption')
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Photos', exact: true }).click()
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('link', { name: /Your properties/ }).click()
  const guard = page.getByRole('dialog', { name: 'Keep your changes?' })
  await expect(guard).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(guard).not.toBeVisible()
  await expect(caption).toHaveValue('Unsent private photo caption')
  expect(await page.getByLabel('Choose a photo').evaluate(input => input.files[0].name)).toBe('synthetic.jpg')
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
  await expect(caption).toHaveValue('')
  expect(calls.uploads()).toBe(2)
  expect(calls.uploadIds()[0]).toMatch(/^[0-9a-f-]{36}$/)
  expect(calls.uploadIds()[1]).toBe(calls.uploadIds()[0])
  await page.getByRole('link', { name: /Your properties/ }).click()
  await expect(page).toHaveURL(/\/landlord$/)
})

test('report filters protect unsaved resolution notes on the same page', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/me')) return route.fulfill({ json: { data: { id: 987, name: 'Synthetic administrator', role: 'admin' } } })
    if (url.pathname.endsWith('/admin/reports')) return route.fulfill({ json: { data: url.searchParams.get('status') === 'resolved' ? [] : [{ id: 91, property_id: 987, student_id: 2, listing_title: 'Synthetic report', category: 'other', body: 'Synthetic concern', status: 'open', revision: 1 }], meta: { last_page: 1 } } })
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto('/admin/reports')
  await page.getByLabel('Private resolution notes').fill('Unsaved investigation notes')
  await page.getByLabel('Report status', { exact: true }).selectOption('resolved')
  const guard = page.getByRole('dialog', { name: 'Keep your changes?' })
  await expect(guard).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(guard).not.toBeVisible()
  await expect(page.getByLabel('Private resolution notes')).toHaveValue('Unsaved investigation notes')
  await expect(page.getByLabel('Report status', { exact: true })).toHaveValue('open')
  await page.getByLabel('Report status', { exact: true }).selectOption('resolved')
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page).toHaveURL(/status=resolved/)
  await expect(page.getByText('No resolved reports.')).toBeVisible()
})


test('publication-changing actions keep unsaved availability edits', async ({ page }) => {
  const option = { id: 1, name: 'Synthetic shared beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 2, available_units: 1, monthly_rent_centavos: 350000, deposit_centavos: 350000, advance_months: 1, fees: [], monthly_fixed_total_centavos: 350000, move_in_fixed_total_centavos: 700000, utilities_notes: 'Synthetic terms', availability_confirmed_at: new Date().toISOString(), availability_stale: false }
  const calls = await mockOwner(page, { status: 'approved', room_options: [option] })
  await page.goto('/landlord/properties/987')
  const vacancies = page.getByLabel('Available units for Synthetic shared beds')
  await vacancies.fill('0')
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Photos', exact: true }).click()
  await page.getByLabel('Photo description').fill('Unsent photo caption')
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('synthetic mock upload') })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
  expect(calls.uploads()).toBe(0)
  await expect(vacancies).toHaveValue('0')
  await page.getByRole('navigation', { name: 'Listing editor steps' }).getByRole('button', { name: 'Rooms & costs', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Remove option', exact: true }).click()
  expect(calls.roomRemovals()).toBe(0)
  await expect(vacancies).toHaveValue('0')
  await expect(page.getByLabel('Photo description')).toHaveValue('Unsent photo caption')
})
