import { expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

export async function apiWrite(page, path, data, method = 'POST') {
  return page.evaluate(async ({ path, data, method }) => {
    await fetch('/sanctum/csrf-cookie', { headers: { Accept: 'application/json' }, credentials: 'include', signal: AbortSignal.timeout(15000) })
    const token = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))
    const response = await fetch('/api/v1' + path, { method, credentials: 'include', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token?.split('=').slice(1).join('=') || '') }, body: JSON.stringify(data) })
    return { status: response.status, body: await response.json() }
  }, { path, data, method })
}

export async function withdrawSyntheticListings(owner, ids) {
  for (const id of ids) {
    const current = await owner.evaluate(async id => { const response = await fetch('/api/v1/landlord/properties/' + id, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); return response.ok ? (await response.json()).data : null }, id)
    if (current?.status === 'approved') {
      const result = await apiWrite(owner, '/landlord/properties/' + id, { revision: current.revision, title: current.title, description: current.description, property_type: current.property_type, city: current.city, address: current.address, latitude: current.latitude, longitude: current.longitude }, 'PATCH')
      expect(result.status).toBe(200)
    }
  }
}

export async function verifyDiscovery({ landlord, reviewer, student, originalId, originalTitle, png }) {
  const ids = []
  const group = 'Synthetic discovery ' + randomUUID()
  try {
    for (const [name, rent, vacant, latitude] of [['Matching residence', 400000, 2, 14.61], ['Cheap sold out residence', 200000, 0, 14.62]]) {
      const created = await apiWrite(landlord, '/landlord/properties', { title: group + ' ' + name, description: 'Clearly synthetic residence used only to test search, inventory, costs and maps. This is not an actual rental offer.', property_type: 'dormitory', address: 'Synthetic verification address, Quiapo', city: 'Manila', latitude, longitude: 120.99 })
      expect(created.status).toBe(201)
      const id = created.body.data.id
      ids.push(id)
      const uploaded = await landlord.evaluate(async ({ id, revision, png }) => {
        const blob = await (await fetch('data:image/png;base64,' + png)).blob()
        const form = new FormData(); form.append('photo', blob, 'synthetic.png'); form.append('caption', 'Synthetic discovery illustration'); form.append('revision', String(revision)); form.append('upload_id', crypto.randomUUID())
        const token = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))
        const response = await fetch(`/api/v1/landlord/properties/${id}/photos`, { method: 'POST', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token.split('=').slice(1).join('=')) }, body: form })
        return { status: response.status, body: await response.json() }
      }, { id, revision: 1, png })
      expect(uploaded.status).toBe(201)
      const detail = await landlord.evaluate(async id => (await (await fetch('/api/v1/landlord/properties/' + id, { headers: { Accept: 'application/json' } })).json()).data, id)
      let revision = detail.revision
      const option = { revision, name: 'Shared beds', inventory_type: 'bedspace', price_basis: 'per_person', capacity: 4, total_units: 4, available_units: vacant, monthly_rent_centavos: rent, deposit_centavos: rent, advance_months: 1, utilities_notes: 'Synthetic terms. Electricity charged by actual meter usage; water included.', fees: [] }
      const added = await apiWrite(landlord, `/landlord/properties/${id}/room-options`, option)
      expect(added.status).toBe(200)
      revision = added.body.data.revision
      if (!vacant) {
        const expensive = await apiWrite(landlord, `/landlord/properties/${id}/room-options`, { ...option, revision, name: 'Available premium beds', monthly_rent_centavos: 800000, available_units: 2 })
        expect(expensive.status).toBe(200)
        revision = expensive.body.data.revision
      }
      const submitted = await apiWrite(landlord, `/landlord/properties/${id}/submit`, { revision, inventory_confirmed: true })
      expect(submitted.status).toBe(200)
      await reviewer.goto('/admin/reviews/' + id)
      await reviewer.getByLabel('I have checked the listing against these review criteria.').check()
      await reviewer.getByRole('button', { name: 'Save review decision', exact: true }).click()
      await expect(reviewer).toHaveURL(/\/admin$/)
    }
    await student.goto('/listings?q=' + encodeURIComponent(group))
    await student.getByLabel('Price basis', { exact: true }).selectOption('per_person')
    await student.getByLabel('Maximum monthly rent (PHP)').fill('5000')
    await student.getByLabel('Available units confirmed within 14 days').check()
    await student.getByLabel('Sort listings').selectOption('rent_asc')
    await student.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(student.getByRole('heading', { name: group + ' Matching residence', exact: true })).toBeVisible()
    await expect(student.getByRole('heading', { name: group + ' Cheap sold out residence', exact: true })).toHaveCount(0)
    await expect(student).toHaveURL(/max_rent_centavos=500000/)
    await student.reload()
    await expect(student.getByLabel('Maximum monthly rent (PHP)')).toHaveValue('5000.00')
    await student.getByRole('button', { name: 'Save favorite ' + group + ' Matching residence', exact: true }).click()
    await expect(student.getByRole('button', { name: 'Remove favorite ' + group + ' Matching residence', exact: true })).toBeVisible()
    await student.getByLabel('Compare ' + group + ' Matching residence', { exact: true }).check()
    await student.goto('/listings/' + originalId)
    await expect(student.getByText('Photo 1 of 2')).toBeVisible()
    await student.getByRole('button', { name: 'Next photo', exact: true }).click()
    await expect(student.getByText('Photo 2 of 2')).toBeVisible()
    const gallery = student.getByRole('region', { name: 'Property photo gallery' })
    await gallery.focus()
    await student.keyboard.press('ArrowLeft')
    await expect(student.getByText('Photo 1 of 2')).toBeVisible()
    await student.getByLabel('Add ' + originalTitle + ' to comparison', { exact: true }).check()
    await student.getByRole('link', { name: 'Compare 2 listings', exact: true }).click()
    await expect(student.getByRole('table')).toBeVisible()
    await student.getByLabel('Room option for ' + originalTitle, { exact: true }).selectOption({ label: 'Private whole room' })
    await expect(student.getByRole('row', { name: /Price basis/ })).toContainText('Per room')
    await student.getByLabel('Room option for ' + originalTitle, { exact: true }).selectOption({ label: 'Shared student beds' })
    await expect(student.getByRole('row', { name: /Price basis/ })).not.toContainText('Per room')
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=', 'base64')
    await student.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
    await student.getByRole('button', { name: 'Show map', exact: true }).click()
    await expect(student.getByRole('region', { name: 'Listing map' }).locator('.leaflet-marker-icon')).toHaveCount(3)
    await expect(student.getByRole('region', { name: 'Listing map' }).locator('.leaflet-control-attribution')).toContainText('OpenStreetMap')
    for (const width of [360, 768, 1440]) {
      await student.setViewportSize({ width, height: 900 })
      expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await student.setViewportSize({ width: 1280, height: 900 })
    await student.goto('/favorites')
    await expect(student.getByRole('heading', { name: group + ' Matching residence', exact: true })).toBeVisible()
    await student.reload()
    await expect(student.getByRole('heading', { name: group + ' Matching residence', exact: true })).toBeVisible()
    await withdrawSyntheticListings(landlord, ids)
    await student.reload()
    await expect(student.getByText(/saved listing\(s\) are currently unpublished/)).toBeVisible()
    await expect(student.getByRole('heading', { name: group + ' Matching residence', exact: true })).toHaveCount(0)
    await student.getByRole('button', { name: 'Remove favorite unpublished listing ' + ids[0], exact: true }).click()
    await expect(student.getByRole('button', { name: 'Remove favorite unpublished listing ' + ids[0], exact: true })).toHaveCount(0)
  } finally { await withdrawSyntheticListings(landlord, ids) }
}
