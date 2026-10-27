import { test, expect } from '@playwright/test'

async function setup(page, role = 'admin') {
  const campuses = Array.from({ length: 15 }, (_, index) => ({ id: index + 1, slug: 'campus-' + (index + 1), name: 'University Campus ' + String(index + 1).padStart(2, '0'), institution_name: 'Example University', city: 'Manila', address: '12 College Street', latitude: 14.6, longitude: 120.99, aliases: ['EU' + (index + 1)], source_url: 'https://example.edu/campus', reference_note: 'Pedestrian entrance on College Street.', active: index !== 14, revision: 1, updated_at: '2026-10-27T00:00:00Z' }))
  const suggestions = [{ id: 91, user_id: 44, client_id: 'old-request', name: 'Proposed Malolos Campus', city: 'Malolos', address: '20 University Road', source_url: 'https://example.edu/malolos', status: 'pending', revision: 1, requester_name: 'Jamie Student', created_at: '2026-10-27T00:00:00Z' }]
  const state = { campuses, suggestions, writes: [], histories: [], failSave: false, failSuggestion: false }
  const paginate = (rows, url) => { const size = Number(url.searchParams.get('per_page') || 12), current = Number(url.searchParams.get('page') || 1), start = (current - 1) * size; return { data: rows.slice(start, start + size), meta: { total: rows.length, current_page: current, last_page: Math.ceil(rows.length / size), from: rows.length ? start + 1 : null, to: Math.min(rows.length, start + size) } } }
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: { data } })
    if (path.endsWith('/me')) return json({ id: role === 'admin' ? 901 : 44, role, name: role === 'admin' ? 'Campus Administrator' : 'Jamie Student', email: 'person@example.test' })
    if (path.endsWith('/notifications/unread-count')) return json({ unread_count: 0 })
    if (path.endsWith('/dashboard')) return json({ pending_reviews: 0, open_reports: 0 })
    if (path === '/api/v1/campuses') return json(state.campuses.filter(campus => campus.active))
    if (path === '/api/v1/landlord/address-search') return json([{ label: '20 University Road, Malolos', street_address: '20 University Road', city: 'Malolos', latitude: 14.85, longitude: 120.81 }])
    if (request.method() !== 'GET') {
      const body = request.postDataJSON(); state.writes.push({ path, body })
      if (path === '/api/v1/campus-suggestions') {
        if (state.failSuggestion) return route.fulfill({ status: 503, json: { message: 'Suggestion could not be saved. Try again.' } })
        const existing = state.suggestions.find(row => row.client_id === body.client_id)
        const row = existing || { ...body, id: state.suggestions.length + 100, status: 'pending', revision: 1, user_id: 44, requester_name: 'Jamie Student', created_at: new Date().toISOString() }
        if (!existing) state.suggestions.push(row)
        return json(row)
      }
      if (path.includes('/campus-suggestions/')) {
        const id = Number(path.split('/').at(-2)), row = state.suggestions.find(item => item.id === id)
        if (row.revision !== body.revision) return route.fulfill({ status: 409, json: { message: 'Suggestion changed.' } })
        Object.assign(row, { status: body.status, resolution_note: body.note, campus_id: body.campus_id, revision: row.revision + 1 })
        return json(row)
      }
      if (state.failSave) return route.fulfill({ status: 503, json: { message: 'Campus save unavailable. Your inputs are kept.' } })
      const id = Number(path.split('/')[5]), existing = state.campuses.find(campus => campus.id === id)
      if (existing && existing.revision !== body.revision) return route.fulfill({ status: 409, json: { message: 'This campus changed. Reload its saved details.' } })
      if (path.endsWith('/visibility')) {
        existing.active = body.active; existing.revision++
        state.histories.unshift({ id: state.histories.length + 1, campus_id: id, action: body.active ? 'activated' : 'deactivated', revision: existing.revision, actor_name: 'Campus Administrator', created_at: new Date().toISOString(), changes: { before: { active: !body.active }, after: { active: body.active } } })
        return json(existing)
      }
      const row = existing || { id: state.campuses.length + 1, active: true, slug: 'new-campus', revision: 0 }
      Object.assign(row, body, { revision: row.revision + 1, updated_at: new Date().toISOString() })
      if (!existing) state.campuses.push(row)
      if (body.suggestion_id) Object.assign(state.suggestions.find(item => item.id === body.suggestion_id), { status: 'added', campus_id: row.id, revision: 2 })
      state.histories.unshift({ id: state.histories.length + 1, campus_id: row.id, action: existing ? 'updated' : 'created', revision: row.revision, actor_name: 'Campus Administrator', created_at: new Date().toISOString(), changes: { before: {}, after: { name: row.name } } })
      return json(row)
    }
    if (path === '/api/v1/admin/campuses') {
      let rows = [...state.campuses]
      if (url.searchParams.get('q')) rows = rows.filter(row => [row.name, row.city, row.institution_name, ...row.aliases].join(' ').toLowerCase().includes(url.searchParams.get('q').toLowerCase()))
      if (url.searchParams.get('active')) rows = rows.filter(row => row.active === (url.searchParams.get('active') === 'active'))
      rows.sort((a, b) => a.name.localeCompare(b.name))
      return route.fulfill({ json: { ...paginate(rows, url), pending_suggestions: state.suggestions.filter(row => row.status === 'pending').length } })
    }
    if (path.startsWith('/api/v1/admin/campuses/')) {
      const id = Number(path.split('/')[5])
      if (path.endsWith('/history')) return route.fulfill({ json: { data: state.histories.filter(row => row.campus_id === id), last_page: 1 } })
      return json(state.campuses.find(campus => campus.id === id))
    }
    if (path.endsWith('/campus-suggestions')) {
      let rows = [...state.suggestions].reverse()
      const status = url.searchParams.get('status') || (role === 'admin' ? 'pending' : 'all')
      if (status !== 'all') rows = rows.filter(row => row.status === status)
      if (url.searchParams.get('q')) rows = rows.filter(row => row.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()))
      return route.fulfill({ json: paginate(rows, url) })
    }
    return json([])
  })
  return state
}

test('campus directory has search and server pages and edits retain fields after failure and conflicting revisions', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/admin/campuses')
  await expect(page.getByRole('heading', { name: 'Campuses', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.getByLabel('Search campuses', { exact: true }).fill('Campus 01')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Edit campus University Campus 01', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit campus', exact: true })
  await dialog.getByLabel('Campus and branch name').fill('Edited Campus Name')
  await dialog.getByLabel('I checked the campus branch, source and pedestrian entrance pin.').check()
  state.failSave = true
  await dialog.getByRole('button', { name: 'Save campus changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Campus save unavailable')
  await expect(dialog.getByLabel('Campus and branch name')).toHaveValue('Edited Campus Name')
  state.failSave = false; state.campuses[0].revision = 2; state.campuses[0].name = 'Saved in another window'
  await dialog.getByRole('button', { name: 'Save campus changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('campus changed')
  page.once('dialog', prompt => prompt.accept())
  await dialog.getByRole('button', { name: 'Reload saved campus', exact: true }).click()
  await expect(dialog.getByLabel('Campus and branch name')).toHaveValue('Saved in another window')
  expect(state.writes.at(-1).body.revision).toBe(1)
})

test('adding a verified campus uses the map search to populate editable address and entrance coordinates', async ({ page }, testInfo) => {
  const state = await setup(page)
  await page.goto('/admin/campuses')
  await page.getByRole('button', { name: 'Add campus', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add campus', exact: true })
  await dialog.getByLabel('Campus and branch name').fill('New Malolos Campus')
  await dialog.getByLabel('Institution name', { exact: true }).fill('Example University')
  await dialog.getByLabel('Find the property address').fill('University Road Malolos')
  await dialog.getByRole('button', { name: 'Find address', exact: true }).click()
  await dialog.getByRole('listbox', { name: 'Address search results' }).getByRole('button').first().click()
  await expect(dialog.getByLabel('Street address', { exact: true })).toHaveValue('20 University Road')
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Malolos')
  await dialog.getByLabel('Source link', { exact: true }).fill('https://example.edu/malolos')
  await dialog.getByLabel('Entrance or reference note').fill('Pedestrian gate on University Road.')
  await dialog.getByLabel('Search aliases (optional)').fill('EU Malolos, Example Malolos')
  await dialog.getByRole('button', { name: 'Add verified campus', exact: true }).click()
  await expect(dialog.getByLabel('I checked the campus branch, source and pedestrian entrance pin.')).toBeFocused()
  expect(state.writes).toHaveLength(0)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width !== 320) await page.screenshot({ path: `../.local/admin-campus-editor-${testInfo.project.name}-${width}.png` })
  }
  await dialog.getByLabel('I checked the campus branch, source and pedestrian entrance pin.').check()
  await dialog.getByRole('button', { name: 'Add verified campus', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Campus added.' })).toBeVisible()
  expect(state.writes.at(-1).body).toMatchObject({ address: '20 University Road', city: 'Malolos', latitude: '14.850000', longitude: '120.810000', aliases: ['EU Malolos', 'Example Malolos'] })
})

test('campus deactivation and reactivation preserve the record and expose human-readable history', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/admin/campuses?q=Campus+01')
  await page.getByRole('button', { name: 'Deactivate University Campus 01', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Deactivate campus', exact: true })
  await expect(dialog).toContainText('Existing account preferences, links and history are retained')
  await dialog.getByRole('button', { name: 'Deactivate campus', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reactivate University Campus 01', exact: true })).toBeVisible()
  expect(state.campuses[0]).toMatchObject({ id: 1, active: false })
  await page.getByRole('button', { name: 'History University Campus 01', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Campus history', exact: true })).toContainText('deactivated')
  await page.getByRole('button', { name: 'Close campus history', exact: true }).click()
  await page.getByRole('button', { name: 'Reactivate University Campus 01', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Reactivate campus', exact: true })
  await dialog.getByRole('button', { name: 'Reactivate campus', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Deactivate University Campus 01', exact: true })).toBeVisible()
  expect(state.campuses).toHaveLength(15)
})

test('admin verifies a suggested branch before adding it and can link a duplicate to an existing campus', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/admin/campuses?view=suggestions')
  await page.getByRole('button', { name: 'Verify and add campus', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add campus', exact: true })
  await expect(dialog.getByLabel('Campus and branch name')).toHaveValue('Proposed Malolos Campus')
  await dialog.getByLabel('Institution name', { exact: true }).fill('Example University')
  await dialog.getByLabel('Entrance latitude').fill('14.85')
  await dialog.getByLabel('Entrance longitude').fill('120.81')
  await dialog.getByLabel('Entrance or reference note').fill('Verified pedestrian gate on University Road.')
  await dialog.getByLabel('I checked the campus branch, source and pedestrian entrance pin.').check()
  await dialog.getByRole('button', { name: 'Add verified campus', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No matching suggestions', exact: true })).toBeVisible()
  expect(state.suggestions[0].status).toBe('added')
  expect(state.writes.at(-1).body).toMatchObject({ suggestion_id: 91, suggestion_revision: 1 })
  state.suggestions.push({ ...state.suggestions[0], id: 92, name: 'Another spelling of a campus', status: 'pending', revision: 1 })
  await page.getByRole('button', { name: 'Refresh results', exact: true }).click()
  await page.getByRole('button', { name: 'Use existing campus', exact: true }).click()
  const resolution = page.getByRole('dialog', { name: 'Use existing campus', exact: true })
  await resolution.getByRole('combobox', { name: 'Existing campus', exact: true }).fill('Campus 01')
  await expect(resolution.getByRole('option', { name: /University Campus 01/ })).toBeVisible()
  await resolution.getByRole('combobox', { name: 'Existing campus', exact: true }).press('Enter')
  await resolution.getByLabel('Reply to the requester').fill('This branch is already listed under its official name.')
  await resolution.getByRole('button', { name: 'Save outcome', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No matching suggestions', exact: true })).toBeVisible()
  expect(state.suggestions[1]).toMatchObject({ status: 'duplicate', campus_id: 1 })
})

test('a student suggests a missing campus with retained edits, stable retry identity and visible review status', async ({ page }) => {
  const state = await setup(page, 'student')
  await page.goto('/campuses/suggest?name=Missing%20Campus')
  await expect(page.getByLabel('Campus and branch name')).toHaveValue('Missing Campus')
  await page.getByLabel('City', { exact: true }).fill('Manila')
  await page.getByLabel('Street address or location').fill('25 University Street')
  state.failSuggestion = true
  await page.getByRole('button', { name: 'Send suggestion', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Try again')
  await expect(page.getByLabel('Campus and branch name')).toHaveValue('Missing Campus')
  await page.getByRole('link', { name: 'Campus directory', exact: false }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit', exact: true }).click()
  state.failSuggestion = false
  await page.getByRole('button', { name: 'Send suggestion', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'suggestion has been received' })).toBeVisible()
  expect(state.writes[0].body.client_id).toBe(state.writes[1].body.client_id)
  await expect(page.getByRole('heading', { name: 'Missing Campus', exact: true })).toBeVisible()
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Missing Campus', exact: true }) }).getByText('Awaiting review', { exact: true })).toBeVisible()
})
