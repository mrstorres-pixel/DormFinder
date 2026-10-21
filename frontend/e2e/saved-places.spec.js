import { test, expect } from '@playwright/test'

const twin = { id: 42, name: 'Twin room', capacity: 2, monthly_rent_centavos: 400000, price_basis: 'per_person', inventory_type: 'bedspace', available_units: 2, total_units: 2, fees: [], monthly_fixed_total_centavos: 425000, move_in_fixed_total_centavos: 800000 }
const solo = { ...twin, id: 43, name: 'Solo room', capacity: 1, monthly_rent_centavos: 900000, price_basis: 'per_room' }
const property = { id: 21, title: '[DEMO] Near Campus Twin Dorm', is_demo: true, property_type: 'dormitory', description: 'Fictional test residence.', address: 'Sample address', city: 'Manila', photos: [], room_options: [twin, solo] }
const snapshot = { title: property.title, room_name: twin.name }
const legacyContexts = [
  { id: 101, collection_id: 1, collection_name: 'Near campus', room_option_id: 42, note: 'Keep the twin by campus', revision: 2, listing_snapshot: snapshot },
  { id: 102, collection_id: 2, collection_name: 'Quiet options', room_option_id: 43, note: 'Solo option for later', revision: 3, listing_snapshot: { ...snapshot, room_name: solo.name } },
]

async function fixture(page, { legacy = false, unavailable = false, guest = false } = {}) {
  const state = { row: legacy ? { property_id: 21, room_option_id: null, note: '', saved_details: { room_option_id: null, note: '' }, listing_snapshot: snapshot, listing: unavailable ? null : property, contexts: structuredClone(legacyContexts) } : null, revision: 1, lists: legacy ? [{ id: 1, name: 'Near campus' }, { id: 2, name: 'Quiet options' }] : [], failSave: false, failEdit: false, conflict: false, writes: [] }
  function row() { return state.row ? { ...state.row, version: String(state.revision).padStart(64, '0') } : null }
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/v1', ''), method = request.method()
    const json = (data, status = 200) => route.fulfill({ status, json: { data, meta: { current_page: 1, last_page: 1, total: Array.isArray(data) ? data.length : 1 } } })
    const error = (status, message) => route.fulfill({ status, json: { message } })
    if (path === '/me') return guest ? error(401, 'Unauthenticated.') : json({ id: 987, name: 'Alex Student', role: 'student' })
    if (path === '/campuses') return json([])
    if (path === '/listings/21') return json(property)
    if (path === '/saved-places/ids') return json(state.row ? [21] : [])
    if (path === '/shortlists') {
      if (method === 'POST') { const list = { id: state.lists.length + 1, ...request.postDataJSON() }; state.lists.push(list); return json(list, 201) }
      return json(state.lists)
    }
    if (path === '/saved-places') { const collection = Number(url.searchParams.get('collection')); return json(state.row && (!collection || state.row.contexts.some(item => item.collection_id === collection)) ? [row()] : []) }
    if (path === '/saved-places/21') {
      if (method === 'GET') return state.row ? json(row()) : error(404, 'Saved place unavailable')
      const data = request.postDataJSON(); state.writes.push({ method, data })
      if (method === 'PUT') {
        if (state.failSave) { state.failSave = false; return error(503, 'Synthetic save failure') }
        state.row ||= { property_id: 21, room_option_id: data.room_option_id, note: '', saved_details: { room_option_id: data.room_option_id, note: '' }, contexts: [], listing_snapshot: snapshot, listing: property }
        return json(row())
      }
      if (state.conflict) { state.conflict = false; state.revision++; return error(409, 'This saved place changed. Reload before saving.') }
      if (method === 'DELETE') { state.row = null; return json({ deleted: true }) }
      if (state.failEdit) { state.failEdit = false; return error(503, 'Synthetic edit failure') }
      const context = state.row.contexts.find(item => item.collection_id === data.context_id)
      if (context) { context.room_option_id = data.room_option_id; context.note = data.note; context.revision++ }
      else { Object.assign(state.row, { room_option_id: data.room_option_id, note: data.note, saved_details: { room_option_id: data.room_option_id, note: data.note } }) }
      state.row.contexts = state.row.contexts.filter(item => data.collection_ids.includes(item.collection_id))
      for (const id of data.collection_ids) if (!state.row.contexts.some(item => item.collection_id === id)) state.row.contexts.push({ id: 100 + id, collection_id: id, collection_name: state.lists.find(item => item.id === id).name, room_option_id: data.room_option_id, note: '', revision: 1, listing_snapshot: snapshot })
      state.revision++
      return json(row())
    }
    if (path === '/comparison') {
      const option = url.searchParams.get('items')?.includes(':43') ? solo : twin
      return json([{ ...property, room_options: [option], alternative_room_options: property.room_options }])
    }
    return json([])
  })
  return state
}

test('one-click saving, optional collections, exact-room comparison and retained edit drafts', async ({ page }, testInfo) => {
  const state = await fixture(page)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  state.failSave = true
  await page.goto('/listings/21?option=43&campus_id=8')
  const save = page.getByRole('button', { name: 'Save place ' + property.title, exact: true })
  await save.click()
  await expect(page.getByRole('alert')).toContainText('Synthetic save failure')
  await expect(save).toHaveAttribute('aria-pressed', 'false')
  await save.click()
  await expect(page.getByRole('button', { name: 'Unsave place ' + property.title })).toHaveAttribute('aria-pressed', 'true')
  expect(state.writes.at(-1).data.room_option_id).toBe(43)
  expect(state.lists).toHaveLength(0)
  await page.getByRole('link', { name: 'Saved places', exact: true }).click()
  await expect(page.locator('.saved-menu')).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Saved place ' + property.title })).toContainText('₱9,000')
  await page.getByRole('button', { name: '＋ New collection' }).click()
  await page.getByLabel('Collection name').fill('Campus choices')
  await page.getByRole('button', { name: 'Create collection', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New collection', exact: true })).toBeHidden()
  const edit = page.getByRole('button', { name: 'Notes & collections', exact: true })
  await edit.click()
  const editor = page.getByRole('dialog', { name: 'Saved place', exact: true })
  await expect(page.getByLabel('Room option', { exact: true })).toHaveValue('43')
  await page.getByLabel('Your private note').fill('Ask about the sunny desk')
  await page.getByLabel('Campus choices', { exact: true }).check()
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await edit.click()
  await expect(page.getByLabel('Your private note')).toHaveValue('Ask about the sunny desk')
  state.failEdit = true
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('Synthetic edit failure')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor.getByRole('status')).toHaveText('Saved changes.')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Compare room', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select one more', exact: true })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Your comparison selection' }).getByRole('link')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Ask about the sunny desk', { exact: true })).toBeVisible()
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: `../.local/saved-places-${testInfo.project.name}-${width}.png`, fullPage: true })
  }
  await edit.click()
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    expect((await editor.boundingBox()).height).toBeLessThanOrEqual(viewport.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: `../.local/saved-editor-${testInfo.project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})

test('legacy saves keep collection-specific rooms and notes, handle conflicts and require removal confirmation', async ({ page }) => {
  const state = await fixture(page, { legacy: true })
  const original = structuredClone(state.row.contexts)
  await page.goto('/favorites')
  await expect(page).toHaveURL(/\/saved$/)
  await expect(page.locator('.saved-place-card')).toHaveCount(1)
  expect(state.row.contexts).toEqual(original)
  await page.goto('/shortlists?list=2')
  await expect(page).toHaveURL(/\/saved\?collection=2$/)
  const card = page.locator('.saved-place-card')
  await expect(card.getByText('Solo room', { exact: true })).toBeVisible()
  await expect(card.getByText('Solo option for later', { exact: false })).toBeVisible()
  await card.getByRole('button', { name: 'Notes & collections', exact: true }).click()
  await expect(page.getByLabel('Details for')).toHaveValue('2')
  await page.getByLabel('Your private note').fill('Updated solo note')
  state.conflict = true
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('This saved place changed')
  await expect(page.getByLabel('Your private note')).toHaveValue('Updated solo note')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Reload saved details' }).click()
  await expect(page.getByLabel('Your private note')).toHaveValue('Updated solo note')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reload saved details' }).click()
  await expect(page.getByLabel('Your private note')).toHaveValue('Solo option for later')
  await page.getByLabel('Your private note').fill('Updated solo note')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Saved changes.')
  expect(state.row.contexts[0]).toEqual(original[0])
  expect(state.row.contexts[1].room_option_id).toBe(43)
  expect(state.row.contexts[1].note).toBe('Updated solo note')
  await page.getByLabel('Details for').selectOption('')
  await page.getByLabel('Quiet options', { exact: true }).uncheck()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect(state.row.contexts).toHaveLength(2)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Saved changes.')
  expect(state.row.contexts).toEqual([original[0]])
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Remove saved place', exact: true }).click()
  expect(state.row).not.toBeNull()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Remove saved place', exact: true }).click()
  await expect(page.locator('.saved-place-card')).toHaveCount(0)
})

test('unpublished saves retain private notes and guest saving preserves the selected room through sign-in', async ({ page }) => {
  await fixture(page, { legacy: true, unavailable: true })
  await page.goto('/saved?collection=1')
  await expect(page.getByText('Listing unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Keep the twin by campus', { exact: false })).toBeVisible()
  await expect(page.locator('.saved-place-card a')).toHaveCount(0)
  await page.getByRole('button', { name: 'Notes & collections', exact: true }).click()
  await expect(page.getByLabel('Room option', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Your private note')).toHaveValue('Keep the twin by campus')
  await page.keyboard.press('Escape')
  await page.unroute('**/api/v1/**')
  await fixture(page, { guest: true })
  await page.goto('/listings/21?option=43&campus_id=8')
  await page.getByRole('link', { name: 'Sign in to save', exact: true }).click()
  const returnTo = new URL(page.url()).searchParams.get('returnTo')
  expect(returnTo).toBe('/listings/21?option=43&campus_id=8&save=1')
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTo)
})

test('switching collections opens the right room and explicit discard clears only abandoned drafts', async ({ page }) => {
  const state = await fixture(page, { legacy: true })
  await page.goto('/saved?collection=1')
  const edit = page.getByRole('button', { name: 'Notes & collections', exact: true })
  await edit.click()
  await expect(page.getByLabel('Details for')).toHaveValue('1')
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  const nextCollection = page.getByRole('button', { name: 'Quiet options', exact: true })
  await nextCollection.focus()
  await nextCollection.press('Enter')
  await expect(nextCollection).toBeFocused()
  await edit.click()
  await expect(page.getByLabel('Details for')).toHaveValue('2')
  await expect(page.getByLabel('Your private note')).toHaveValue('Solo option for later')
  await page.getByLabel('Your private note').fill('An abandoned collection draft')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Near campus', exact: true }).click()
  await page.getByRole('button', { name: 'Stay and edit', exact: true }).click()
  await edit.click()
  await expect(page.getByLabel('Your private note')).toHaveValue('An abandoned collection draft')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Near campus', exact: true }).click()
  await page.getByRole('button', { name: 'Discard and leave', exact: true }).click()
  await edit.click()
  await expect(page.getByLabel('Details for')).toHaveValue('1')
  await expect(page.getByLabel('Your private note')).toHaveValue('Keep the twin by campus')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '＋ New collection' }).click()
  await page.getByLabel('Collection name').fill('Abandoned collection name')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'All saved', exact: true }).click()
  await page.getByRole('button', { name: 'Discard and leave', exact: true }).click()
  await page.getByRole('button', { name: '＋ New collection' }).click()
  await expect(page.getByLabel('Collection name')).toHaveValue('')
  expect(state.row.contexts).toEqual(legacyContexts)
  expect(state.writes).toEqual([])
})
