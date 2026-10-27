import { test, expect } from '@playwright/test'

async function setup(page) {
  const property = { id: 987, title: 'Entrance test property', description: 'A furnished student residence close to transport and schools.', address: 'Saved Street', city: 'Manila', status: 'draft', revision: 1, amenities: [], latitude: 14.6, longitude: 120.99, photos: [], room_options: [] }
  const state = { searches: [], reverses: [], writes: 0, delay: 0, failure: false }
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (route.request().method() !== 'GET') state.writes++
    if (path.endsWith('/me')) return route.fulfill({ json: { data: { id: 987, name: 'Test Owner', role: 'landlord' } } })
    if (path.endsWith('/landlord/properties/987')) return route.fulfill({ json: { data: property } })
    if (path.endsWith('/address-search')) {
      state.searches.push(url.searchParams.get('q'))
      return route.fulfill({ json: { data: [{ label: '12 College Street, Manila', street_address: '12 College Street', city: 'Manila', latitude: 14.5991, longitude: 120.9922 }] } })
    }
    if (path.endsWith('/address-reverse')) {
      state.reverses.push(Object.fromEntries(url.searchParams))
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
      return route.fulfill(state.failure ? { status: 503, json: { message: 'Unavailable' } } : { json: { data: [{ label: '40 Entrance Road, Quezon City', street_address: '40 Entrance Road', city: 'Quezon City', latitude: 14.61, longitude: 121.01 }] } }).catch(() => {})
    }
    return route.fulfill({ json: { data: [], meta: { last_page: 1 } } })
  })
  await page.goto('/landlord/properties/987#location')
  await expect(page.getByRole('region', { name: 'Property location picker' })).toHaveClass(/leaflet-container/)
  return state
}

test('typing suggests addresses without pressing Find and keyboard selection fills editable fields', async ({ page }) => {
  const state = await setup(page), search = page.getByRole('combobox', { name: 'Find the property address' })
  await expect(search).toHaveValue('Saved Street, Manila')
  await search.fill('College Street Manila')
  await expect(page.getByRole('option', { name: /12 College Street/ })).toBeVisible()
  expect(state.searches).toEqual(['College Street Manila'])
  await search.press('ArrowDown'); await search.press('Enter')
  await expect(search).toHaveValue('12 College Street, Manila')
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('12 College Street')
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('14.599100')
  expect(state.reverses).toHaveLength(0)
  await page.getByLabel('Street address', { exact: true }).fill('12 College Street, Gate B')
  await expect(search).toHaveValue('12 College Street, Manila')
  expect(state.writes).toBe(0)
})

test('moving the entrance pin updates the address while retaining the exact chosen coordinates; cancel restores saved values', async ({ page }) => {
  const state = await setup(page)
  const map = page.getByRole('region', { name: 'Property location picker' })
  await map.click({ position: { x: 160, y: 140 } })
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  const latitude = await page.getByLabel('Latitude', { exact: true }).inputValue(), longitude = await page.getByLabel('Longitude', { exact: true }).inputValue()
  await expect(page.getByRole('combobox', { name: 'Find the property address' })).toHaveValue('40 Entrance Road, Quezon City')
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('40 Entrance Road')
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('Quezon City')
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue(latitude)
  await expect(page.getByLabel('Longitude', { exact: true })).toHaveValue(longitude)
  expect(state.reverses).toEqual([{ latitude, longitude }])
  await page.getByRole('button', { name: 'Cancel location changes', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Find the property address' })).toHaveValue('Saved Street, Manila')
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('Saved Street')
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('14.6')
  await expect(page.getByRole('button', { name: 'Cancel location changes', exact: true })).toHaveCount(0)
  expect(state.writes).toBe(0)
})

test('a delayed pin lookup cannot overwrite new search input or cancelled location changes', async ({ page }) => {
  const state = await setup(page); state.delay = 1500
  const map = page.getByRole('region', { name: 'Property location picker' })
  await map.click({ position: { x: 160, y: 140 } })
  await expect.poll(() => state.reverses.length).toBe(1)
  const search = page.getByRole('combobox', { name: 'Find the property address' })
  await search.fill('My new address')
  await expect(page.getByRole('option', { name: /12 College Street/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  await expect(search).toHaveValue('My new address')
  await map.click({ position: { x: 180, y: 130 } })
  await expect.poll(() => state.reverses.length).toBe(2)
  await page.getByRole('button', { name: 'Cancel location changes', exact: true }).click()
  await expect(search).toHaveValue('Saved Street, Manila')
  await page.waitForTimeout(1700)
  await expect(search).toHaveValue('Saved Street, Manila')
  expect(state.writes).toBe(0)
})

test('dragging the pin performs one lookup and failure keeps the pin with a manual address fallback', async ({ page }) => {
  const state = await setup(page); state.failure = true
  const marker = page.locator('.owner-property-pin')
  await marker.scrollIntoViewIfNeeded()
  const box = await marker.boundingBox()
  await page.mouse.move(box.x + 19, box.y + 18); await page.mouse.down(); await page.mouse.move(box.x + 70, box.y + 40, { steps: 8 }); await page.mouse.up()
  await expect(page.getByText('The address lookup could not load.', { exact: false })).toBeVisible()
  expect(state.reverses).toHaveLength(1)
  await expect(page.getByLabel('Latitude', { exact: true })).not.toHaveValue('14.6')
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('Saved Street')
  expect(state.writes).toBe(0)
})

test('editing coordinates cancels an older pin address lookup', async ({ page }) => {
  const state = await setup(page); state.delay = 1500
  await page.getByRole('region', { name: 'Property location picker' }).click({ position: { x: 160, y: 140 } })
  await expect.poll(() => state.reverses.length).toBe(1)
  await page.getByLabel('Latitude', { exact: true }).fill('14.62')
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  await page.waitForTimeout(1700)
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('Saved Street')
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('14.62')
  expect(state.writes).toBe(0)
})
