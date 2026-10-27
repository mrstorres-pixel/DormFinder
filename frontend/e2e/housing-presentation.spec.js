import { test, expect } from '@playwright/test'
import { expectInsetText, expectAlignedControls } from './ui-layout'

const campus = { id: 8, name: 'Test University', slug: 'test-campus', latitude: 14.6, longitude: 120.98 }
const twin = { id: 21, name: 'Twin beds', capacity: 2, monthly_rent_centavos: 400000, monthly_fixed_total_centavos: 425000, move_in_fixed_total_centavos: 800000, price_basis: 'per_person', inventory_type: 'bedspace', available_units: 2, total_units: 2, availability_stale: false, availability_confirmed_at: '2026-10-16T00:00:00Z', deposit_centavos: 400000, advance_months: 1, utilities_notes: 'Electricity is metered separately.', fees: [{ name: 'Wi-Fi', amount_centavos: 25000, frequency: 'monthly' }] }
const solo = { ...twin, id: 22, name: 'Solo studio', capacity: 1, monthly_rent_centavos: 900000, monthly_fixed_total_centavos: 925000, move_in_fixed_total_centavos: 1800000, price_basis: 'per_room', inventory_type: 'whole_room', available_units: 1, total_units: 1, deposit_centavos: 900000 }
const sold = { ...twin, id: 23, name: 'Four-person room', capacity: 4, available_units: 0, availability_stale: true }
const listings = [
  { id: 1, title: 'Campus House', description: 'Fictional room for tests.', is_demo: true, property_type: 'dormitory', address: 'Test address', city: 'Manila', latitude: 14.601, longitude: 120.98, room_options: [twin, solo, sold], photos: [{ id: 1, url: '/images/demo/twin-room.webp', caption: 'Fictional room illustration' }], distance_from_campus: { campus_id: 8, meters: 200 }, amenities: ['wifi'], house_rules: 'Quiet after 10pm.' },
  { id: 2, title: 'Garden House', description: 'Another fictional room.', is_demo: true, property_type: 'dormitory', address: 'Another address', city: 'Manila', latitude: 14.602, longitude: 120.98, room_options: [{ ...twin, id: 31, monthly_rent_centavos: 500000, monthly_fixed_total_centavos: 525000 }], photos: [{ id: 2, url: '/images/demo/studio-room.webp', caption: 'Fictional studio illustration' }], distance_from_campus: { campus_id: 8, meters: 300 }, amenities: [], house_rules: 'No smoking.' },
  { id: 3, title: 'No-photo residence', description: 'No photo fixture.', property_type: 'apartment', city: 'Manila', address: 'Third address', latitude: null, longitude: null, room_options: [{ ...solo, id: 41 }], photos: [], distance_from_campus: null },
]
async function fixture(page) {
  const state = { fail: false }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1, total: 3 } } })
    if (path.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } })
    if (path.endsWith('/campuses')) return json([campus])
    if (path.endsWith('/compare')) {
      if (state.fail) return route.fulfill({ status: 422, json: { message: 'A selected listing is unavailable.' } })
      return json(route.request().postDataJSON().selections.map(selection => {
        const property = listings.find(property => property.id === selection.property_id)
        return { ...property, alternative_room_options: property.room_options, room_options: [property.room_options.find(room => room.id === selection.room_option_id)] }
      }))
    }
    const id = path.match(/\/listings\/(\d+)$/)?.[1]
    return json(id ? listings.find(property => property.id === Number(id)) : listings)
  })
  return state
}

test('map preview and guest listing actions align, with readable padded map notes at all widths', async ({ page }, testInfo) => {
  await fixture(page)
  await page.goto('/listings?campus_id=8')
  await page.locator('#listing-card-1').getByRole('button', { name: 'Show on map' }).click()
  const preview = page.getByRole('article', { name: 'Selected map listing' })
  await expect(preview.getByRole('img')).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await expectAlignedControls(preview.locator('.map-preview-links > *'))
    await expectInsetText(page.locator('.map-note'))
    await expect(preview.getByRole('group', { name: 'Room options', exact: true })).toBeVisible()
    await expect(preview.getByRole('button', { name: 'Twin beds', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await preview.scrollIntoViewIfNeeded()
    if ([1440, 390].includes(width)) await page.screenshot({ path: `../.local/layout-map-${testInfo.project.name}-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto('/listings/1?option=21&campus_id=8')
  const actions = page.locator('.listing-small-actions')
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await expectAlignedControls(actions.locator(':scope > a, :scope > button'))
    await actions.scrollIntoViewIfNeeded()
    if ([1440, 390].includes(width)) await page.screenshot({ path: `../.local/layout-listing-${testInfo.project.name}-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await actions.getByRole('button', { name: '+ Compare', exact: true }).click()
  await expect(actions.getByRole('link', { name: 'Open comparison' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select one more' })).toBeDisabled()
  await expect(actions.getByRole('link', { name: 'Sign in to save' })).toHaveAttribute('href', /option%3D21/)
})

test('photo-led cards keep capacity, inventory and selected-room costs without the full address', async ({ page }, testInfo) => {
  await fixture(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/listings?campus_id=8')
  const card = page.locator('#listing-card-1')
  await expect(card).toContainText('2-person room')
  await expect(card).toContainText('2 beds available')
  await expect(card).toContainText('200 m · straight line to campus')
  await expect(card).not.toContainText('Test address')
  await card.getByRole('combobox').selectOption('22')
  await expect(card.locator('.room-price')).toContainText('₱9,000.00')
  await expect(card).toContainText('1-person room')
  await expect(card).toContainText('1 room available')
  await expect(page.locator('#listing-card-2').getByRole('combobox')).toHaveCount(0)
  await expect.poll(() => card.locator('.property-cover img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  const cover = await card.locator('.property-cover').boundingBox()
  expect(cover.width / cover.height).toBeCloseTo(4 / 3, 1)
  await page.screenshot({ path: `../.local/housing-cards-${testInfo.project.name}-desktop.png` })
  await card.getByRole('link', { name: 'Open listing: ' + listings[0].title }).click()
  await expect(page).toHaveURL(/option=22&campus_id=8/)
  await expect(page.getByRole('group', { name: 'Choose a room option' }).locator('input:checked')).toHaveValue('22')
})

test('visible room choices support keyboard selection, sold-out inspection and accurate next steps', async ({ page }, testInfo) => {
  await fixture(page)
  await page.goto('/listings/1?option=21&campus_id=8')
  const rooms = page.getByRole('group', { name: 'Choose a room option' })
  const summary = page.getByRole('region', { name: 'Selected room summary' })
  await expect(rooms.getByRole('radio')).toHaveCount(3)
  await rooms.locator('input[value="21"]').focus()
  await page.keyboard.press('ArrowDown')
  await expect(rooms.locator('input:checked')).toHaveValue('22')
  await expect(summary.locator('.room-overview-price')).toContainText('₱9,000.00')
  await expect(summary.locator('.cost-quick-list')).toContainText('₱9,250.00')
  await expect(summary.locator('.cost-quick-list')).toContainText('₱18,000.00')
  await expect(summary.getByRole('link', { name: 'Request a viewing', exact: true }).first()).toHaveAttribute('href', /option%3D22/)
  await rooms.locator('input[value="23"]').check()
  await expect(rooms.locator('input:checked')).toHaveValue('23')
  await expect(rooms).toContainText('Sold out · Needs confirmation')
  await rooms.locator('input[value="22"]').check()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await rooms.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `../.local/housing-room-choices-${testInfo.project.name}-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('comparison prioritizes images and essentials while retaining expandable terms, room changes and removal', async ({ page }, testInfo) => {
  await fixture(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/compare?items=1:21,2:31,3:41&campus_id=8')
  const primary = page.getByRole('table').first()
  await expect(primary.getByRole('combobox')).toHaveCount(3)
  await expect(primary.locator('.comparison-photo')).toHaveCount(2)
  await expect(primary).toContainText('No photo available')
  await expect(primary.getByRole('rowheader', { name: 'Monthly base rent' })).toBeVisible()
  await expect(primary).toContainText('Lowest known monthly charges')
  await expect(page.getByRole('rowheader', { name: 'House rules' })).toBeHidden()
  await page.getByText('Full costs and property details', { exact: true }).click()
  const terms = page.getByRole('region', { name: 'Detailed comparison' })
  await expect(terms).toContainText('Quiet after 10pm.')
  await expect(terms).toContainText('Electricity is metered separately.')
  await expect(terms).toContainText('Test address, Manila')
  await primary.getByRole('combobox').first().selectOption('22')
  await expect(primary.getByRole('combobox').first()).toHaveValue('22')
  await expect(page).toHaveURL(/items=1%3A22%2C2%3A31%2C3%3A41/)
  await expect(primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Known monthly charges', exact: true }) })).toContainText('₱9,250.00')
  await expect(primary).not.toContainText('Lowest known monthly charges')
  await expect(primary.getByRole('link', { name: 'Open listing: ' + listings[0].title })).toHaveAttribute('href', '/listings/1?option=22&campus_id=8')
  await page.screenshot({ path: `../.local/housing-comparison-${testInfo.project.name}-desktop.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scroller = page.getByRole('region', { name: 'Listing comparison table' })
  await scroller.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
  await scroller.evaluate(node => { node.scrollLeft = node.scrollWidth })
  await primary.getByRole('button', { name: 'Remove No-photo residence' }).scrollIntoViewIfNeeded()
  await expect(primary.getByRole('button', { name: 'Remove No-photo residence' })).toBeInViewport()
  await page.screenshot({ path: `../.local/housing-comparison-${testInfo.project.name}-mobile.png` })
  await primary.getByRole('button', { name: 'Remove No-photo residence' }).click()
  await expect(primary.getByRole('combobox')).toHaveCount(2)
  await primary.getByRole('button', { name: 'Remove ' + listings[1].title }).click()
  await expect(page.getByRole('heading', { name: 'Choose at least two listings' })).toBeVisible()
})

test('unavailable comparison remains recoverable and invalid comparisons make no request', async ({ page }) => {
  const state = await fixture(page)
  state.fail = true
  await page.goto('/compare?items=1:21,2:31&campus_id=8')
  await expect(page.getByText('A selected listing is unavailable.')).toBeVisible()
  state.fail = false
  await page.getByRole('button', { name: 'Remove listing 2', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose at least two listings' })).toBeVisible()
  let requests = 0
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/compare') && request.method() === 'POST') requests++ })
  await page.goto('/compare?items=1:21,1:22')
  await expect(page.getByRole('heading', { name: 'Choose at least two listings' })).toBeVisible()
  expect(requests).toBe(0)
})
