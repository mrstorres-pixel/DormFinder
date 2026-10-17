import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { apiWrite } from './discovery-flow'

test('campus finder, saved places and viewing negotiation form a complete practical flow', async ({ browser, baseURL }, testInfo) => {
  test.skip(!process.env.E2E_DEMO_MANIFEST, 'Uses the explicitly prepared fictional listings.')
  test.setTimeout(180_000)
  const manifest = JSON.parse(await readFile(process.env.E2E_DEMO_MANIFEST,'utf8'))
  const environment = baseURL.startsWith('https:') ? 'cloud' : 'local'
  const dir = dirname(process.env.E2E_DEMO_MANIFEST)
  const ownerAccount = JSON.parse(await readFile(join(dir,'demo-landlord-' + environment + '.json'),'utf8'))
  const accounts = JSON.parse(await readFile(join(dir,'discovery-browser-' + environment + '-' + testInfo.project.name + '.json'),'utf8'))
  const contexts = []
  let student, createdView, createdList, savedProperty, hadFavorite = true
  const suffix = randomUUID()
  async function open() {
    const context = await browser.newContext({ baseURL }); contexts.push(context)
    const page = await context.newPage(); page.setDefaultTimeout(20_000)
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=','base64')
    await page.route('https://tile.openstreetmap.org/**',route => route.fulfill({ contentType:'image/png',body:tile }))
    return page
  }
  async function login(page,account) {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(account.email)
    await page.getByLabel('Password',{exact:true}).fill(account.password)
    const dashboard = page.waitForResponse(response => /\/api\/v1\/(dashboard|saved-places)$/.test(response.url()) && response.status() === 200)
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await dashboard
  }
  try {
    student = await open()
    await student.goto('/find')
    await student.getByRole('combobox',{name:'College or university'}).fill('CEU Manila')
    await student.getByRole('combobox',{name:'College or university'}).press('Enter')
    await student.getByLabel('Maximum monthly base rent (PHP)').fill('5000')
    const resultsRead = student.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/listings' && response.status() === 200)
    await student.getByRole('button',{name:'Find my campus matches'}).click()
    const results = (await (await resultsRead).json()).data
    expect(results.length).toBeGreaterThan(0)
    await expect(student.locator('.match-reasons').first()).toContainText('fits your budget')
    const demo = results.find(row => manifest.ids.slice(0,16).includes(row.id))
    expect(demo).toBeTruthy()
    const option = demo.room_options.find(room => room.available_units > 0 && !room.availability_stale)
    expect(option).toBeTruthy()
    await student.locator('#listing-card-' + demo.id).getByRole('button',{name:'Show on map'}).click()
    await student.getByRole('article', { name: 'Selected map listing' }).getByRole('button', { name: 'Room details' }).click()
    await expect(student.getByLabel('Room in map preview')).toHaveValue(String(option.id))
    await login(student,accounts.student)
    const oldViews = await apiWrite(student,'/viewings',undefined,'GET')
    expect(oldViews.status).toBe(200)
    for (const old of oldViews.body.data) {
      if (old.student_note.startsWith('Practical demo viewing ') && ['requested','proposed','accepted'].includes(old.status)) expect((await apiWrite(student,'/viewings/' + old.id,{ action:'cancel',revision:old.revision },'PATCH')).status).toBe(200)
    }
    savedProperty = demo.id
    const oldFavorites = await apiWrite(student, '/favorites/ids', undefined, 'GET')
    expect(oldFavorites.status).toBe(200)
    hadFavorite = oldFavorites.body.data.includes(demo.id)
    await student.goto('/saved')
    await student.getByRole('button', { name: '＋ New collection' }).click()
    await student.getByLabel('Collection name').fill('Campus choices ' + suffix)
    const newList = student.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/shortlists' && response.request().method() === 'POST' && response.status() === 201)
    await student.getByRole('button', { name: 'Create collection', exact: true }).click()
    createdList = (await (await newList).json()).data.id
    await expect(student.getByRole('dialog', { name: 'New collection', exact: true })).toBeHidden()
    await student.goto('/listings/' + demo.id + '?option=' + option.id)
    await expect(student.getByRole('button', { name: /^(Save place|Edit saved place) / })).toBeVisible()
    const save = student.getByRole('button', { name: 'Save place ' + demo.title, exact: true })
    if (await save.count()) await save.click()
    await expect(student.getByRole('button', { name: 'Edit saved place ' + demo.title, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await student.getByRole('button', { name: 'Edit saved place ' + demo.title, exact: true }).click()
    const editor = student.getByRole('dialog', { name: 'Saved place', exact: true })
    await expect(editor).toBeVisible()
    await student.getByLabel('Campus choices ' + suffix, { exact: true }).check()
    await student.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(editor.getByRole('status')).toHaveText('Saved changes.')
    await student.getByLabel('Details for').selectOption(String(createdList))
    await student.getByLabel('Room option', { exact: true }).selectOption(String(option.id))
    const note = student.getByLabel('Your private note')
    await note.fill('Practical demo note ' + suffix)
    await student.keyboard.press('Escape')
    await student.getByRole('link', { name: 'Browse', exact: true }).click()
    const guard = student.getByRole('dialog', { name: 'Keep your changes?' })
    await expect(guard).toBeVisible()
    await student.getByRole('button', { name: 'Stay and edit' }).click()
    await expect(guard).not.toBeVisible()
    await student.getByRole('article', { name: 'Saved place ' + demo.title, exact: true }).getByRole('button', { name: /(?:Edit saved place|Choose room & edit)/ }).click()
    await expect(note).toHaveValue('Practical demo note ' + suffix)
    await student.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(editor.getByRole('status')).toHaveText('Saved changes.')
    await student.keyboard.press('Escape')
    await student.getByRole('button', { name: 'Campus choices ' + suffix, exact: true }).click()
    await student.getByRole('article', { name: 'Saved place ' + demo.title, exact: true }).getByRole('heading').getByRole('link').click()
    expect(new URL(student.url()).searchParams.get('option')).toBe(String(option.id))
    await student.getByRole('button',{name:'Request a viewing',exact:true}).click()
    const time = new Date(Date.now() + 3 * 86400000 + 8 * 3600000).toISOString().slice(0,16)
    await student.getByLabel('Preferred viewing time (Philippine time, UTC+8)').fill(time)
    await student.getByLabel('Viewing note for the owner').fill('Practical demo viewing ' + suffix)
    const request = student.waitForResponse(response => response.url().endsWith('/listings/' + demo.id + '/viewings') && response.status() === 201)
    await student.getByRole('button',{name:'Send viewing request'}).click()
    createdView = (await (await request).json()).data.id
    await expect(student.getByRole('dialog', { name: 'Request a viewing' }).getByRole('status')).toContainText('Viewing requested')
    await student.getByRole('button', { name: 'Done', exact: true }).click()
    const owner = await open(); await login(owner,ownerAccount)
    await owner.goto('/viewings?status=requested')
    const requestCard = owner.locator('#viewing-' + createdView)
    await owner.goto('/viewings?status=requested#viewing-' + createdView)
    await expect(requestCard).toBeVisible()
    const proposed = new Date(Date.now() + 4 * 86400000 + 8 * 3600000).toISOString().slice(0,16)
    await requestCard.getByRole('button', { name: 'Suggest another time', exact: true }).click()
    await expect(requestCard.getByLabel('Suggest another time (Philippine time)')).toBeFocused()
    await requestCard.getByLabel('Suggest another time (Philippine time)').fill(proposed)
    await requestCard.getByLabel('Message for the student').fill('Practical demo alternate time')
    const proposal = owner.waitForResponse(response => response.url().endsWith('/viewings/' + createdView) && response.request().method() === 'PATCH' && response.status() === 200)
    await requestCard.getByRole('button',{name:'Suggest another time',exact:true}).click()
    expect((await (await proposal).json()).data.status).toBe('proposed')
    await student.goto('/viewings?status=proposed#viewing-' + createdView)
    const studentCard = student.locator('#viewing-' + createdView)
    await expect(studentCard).toContainText('New time suggested')
    await studentCard.getByRole('button',{name:'Accept suggested time'}).click()
    await expect(studentCard).toContainText('Confirmed visit')
    await student.getByRole('button', { name: 'Upcoming', exact: true }).click()
    await expect(student.locator('#viewing-' + createdView)).toContainText('Confirmed visit')
    const other = await open(); await login(other,accounts.landlord)
    const denied = await apiWrite(other,'/viewings/' + createdView,{ action:'cancel',revision:3 },'PATCH')
    expect(denied.status).toBe(404)
    expect((await apiWrite(other,'/shortlists/' + createdList,undefined,'GET')).status).toBe(403)
    for (const width of [360,768,1440]) {
      await student.setViewportSize({ width,height:900 })
      expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  } finally {
    if(student && createdView) {
      const read = await apiWrite(student,'/viewings',undefined,'GET')
      if(read.status === 200) {
        const current = read.body.data.find(row => row.id === createdView)
        if(current && ['requested','proposed','accepted'].includes(current.status)) expect((await apiWrite(student,'/viewings/' + createdView,{action:'cancel',revision:current.revision},'PATCH')).status).toBe(200)
      }
    }
    if(student && createdList) expect((await apiWrite(student,'/shortlists/' + createdList,undefined,'DELETE')).status).toBe(200)
    if (student && savedProperty && !hadFavorite) expect((await apiWrite(student, '/favorites/' + savedProperty, undefined, 'DELETE')).status).toBe(200)
    for (const context of contexts) await context.close()
  }
})
