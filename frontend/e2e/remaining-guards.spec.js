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
  await expect(page.getByRole('alert')).toContainText('Upload your selected photo')
  await expect(caption).toHaveValue('Unsent private photo caption')
  expect(calls.submissions()).toBe(0)
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
  await page.getByRole('button', { name: 'Review report: Synthetic report' }).click()
  await page.getByLabel('Private resolution notes').fill('Unsaved investigation notes')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Close review report' }).click()
  await expect(page.getByLabel('Private resolution notes')).toHaveValue('Unsaved investigation notes')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Close review report' }).click()
  await page.getByRole('button', { name: 'Filters & sorting' }).click()
  await page.getByLabel('Report status', { exact: true }).selectOption('resolved')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page).toHaveURL(/status=resolved/)
  await expect(page.getByRole('heading', { name: 'No matching reports' })).toBeVisible()
})


test('room edits block availability writes and bulk counts survive cancelled dismissal', async ({ page }) => {
  const option = { id: 1, name: 'Synthetic shared beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 2, total_units: 2, available_units: 1, monthly_rent_centavos: 350000, deposit_centavos: 350000, advance_months: 1, fees: [], monthly_fixed_total_centavos: 350000, move_in_fixed_total_centavos: 700000, utilities_notes: 'Synthetic terms', availability_confirmed_at: new Date().toISOString(), availability_stale: false }
  const calls = await mockOwner(page, { status: 'approved', room_options: [option], photos: [{ id: 1, status: 'ready', url: '/images/demo/twin-room.webp', caption: 'Saved fictional photo' }] })
  await page.goto('/landlord/properties/987#rooms')
  await page.getByRole('button', { name: 'Edit Synthetic shared beds', exact: true }).click()
  await page.getByLabel('Room option name', { exact: true }).fill('Unsaved room name')
  await page.getByRole('button', { name: 'Update availability', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Update availability', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Room option name', { exact: true })).toHaveValue('Unsaved room name')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click()
  await page.getByRole('button', { name: 'Update availability', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Update availability', exact: true })
  const count = dialog.getByLabel(/Available beds/)
  await count.fill('0')
  page.once('dialog', prompt => prompt.dismiss())
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(count).toHaveValue('0')
  page.once('dialog', prompt => prompt.accept())
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.uploads()).toBe(0)
  expect(calls.roomRemovals()).toBe(0)
})
