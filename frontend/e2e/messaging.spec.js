import { test, expect } from '@playwright/test'

const avatar = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#c8dbff"/><circle cx="40" cy="30" r="14" fill="#315aca"/><path d="M12 80Q12 45 40 45T68 80" fill="#315aca"/></svg>'
async function messagingApi(page) {
  const state = { sends: [], failSend: true, failPhoto: true, photo: false, photoWrites: 0, user: { id: 987, name: 'Alex Student', email: 'alex@example.test', role: 'student', preferred_campus_id: null, avatar_url: '/api/v1/avatars/987?v=1' } }
  const room = { id: 42, name: 'Twin room' }
  const threads = [7, 8].map(id => ({ id, property_id: 21, participant_name: id === 7 ? 'Jamie Owner' : 'Sam Owner', participant_role: 'landlord', participant_avatar_url: '/api/v1/avatars/' + id, property_status: 'approved', can_reply: true, awaiting_reply: true, last_message_body: 'The room is available for a visit.', last_message_at: '2026-10-15T02:00:00Z', listing_snapshot: { title: 'Synthetic student residence', room_option: room } }))
  const history = Array.from({ length: 35 }, (_, index) => ({ id: index + 1, sender_id: index % 2 ? 987 : 7, sender_name: index % 2 ? 'Alex Student' : 'Jamie Owner', sender_avatar_url: '/api/v1/avatars/' + (index % 2 ? 987 : 7), body: 'Synthetic chat message ' + (index + 1), created_at: new Date(Date.UTC(2026, 9, 15, 1, index)).toISOString() }))
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = (data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } })
    if (path.includes('/avatars/')) return route.fulfill({ contentType: 'image/svg+xml', body: avatar })
    if (path.endsWith('/me/avatar')) {
      if (request.method() !== 'GET') {
        state.photoWrites++
        if (state.failPhoto && request.method() === 'POST') { state.failPhoto = false; return route.fulfill({ status: 503, json: { message: 'Synthetic photo failure' } }) }
        state.photo = request.method() === 'POST'; state.user.avatar_url = '/api/v1/avatars/987?v=' + state.photoWrites
      }
      return json({ has_avatar: state.photo, avatar_url: state.user.avatar_url })
    }
    if (path.endsWith('/me')) return json(state.user)
    if (path.endsWith('/campuses')) return json([])
    if (/\/inquiries\/[78]\/messages$/.test(path)) {
      if (request.method() === 'POST') {
        const data = request.postDataJSON(); state.sends.push(data)
        if (state.failSend) { state.failSend = false; return route.fulfill({ status: 503, json: { message: 'Synthetic send failure' } }) }
        history.push({ id: history.length + 1, sender_id: 987, sender_name: state.user.name, sender_avatar_url: state.user.avatar_url, body: data.body, created_at: new Date().toISOString() })
        return json(history.at(-1))
      }
      const last = Math.ceil(history.length / 30), current = url.searchParams.has('latest') ? last : Number(url.searchParams.get('page')) || 1
      return json(history.slice((current - 1) * 30, current * 30), { current_page: current, last_page: last })
    }
    if (/\/inquiries\/[78]$/.test(path)) return json(threads.find(row => String(row.id) === path.split('/').pop()))
    if (path.endsWith('/inquiries')) return json(threads, { current_page: 1, last_page: 1 })
    return json([], { current_page: 1, last_page: 1 })
  })
  return state
}

test('messages feel like a conversation and preserve latest history, retries and mobile navigation', async ({ page }, testInfo) => {
  const state = await messagingApi(page), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/inquiries')
  await page.getByRole('link', { name: /Jamie Owner/ }).click()
  const chat = page.getByRole('region', { name: 'Conversation with Jamie Owner' }), log = page.getByRole('log', { name: 'Conversation messages' })
  await expect(chat.getByRole('heading', { name: 'Jamie Owner' })).toBeVisible()
  await expect(log.getByText('Synthetic chat message 35', { exact: true })).toBeVisible()
  await expect(log.getByText('Synthetic chat message 1', { exact: true })).toHaveCount(0)
  await expect(chat.getByRole('link', { name: /viewing/i })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Messages', exact: true })).toHaveClass(/is-current/)
  await page.getByRole('button', { name: 'Earlier messages' }).click()
  await expect(log.getByText('Synthetic chat message 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Latest messages' }).click()
  await expect(log.getByText('Synthetic chat message 35', { exact: true })).toBeVisible()
  const reply = page.getByLabel('Your reply')
  await reply.fill('A useful message')
  await reply.press('Shift+Enter')
  await reply.press('b')
  await reply.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Synthetic send failure')
  await expect(reply).toHaveValue('A useful message\nb')
  await page.getByRole('link', { name: /Sam Owner/ }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(reply).toHaveValue('')
  expect(state.sends).toHaveLength(2)
  expect(state.sends[0].client_id).toBe(state.sends[1].client_id)
  await expect(log.getByText('A useful message\nb', { exact: true })).toBeVisible()
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const composer = await page.locator('.chat-compose').boundingBox()
    expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height + 1)
    if (viewport.height > 500) await page.screenshot({ path: `../.local/messaging-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: 'Back to messages' }).click()
  await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible()
  await expect(page.locator('.chat-welcome')).toBeHidden()
  expect(errors).toEqual([])
})

test('a real photo control preserves a failed upload and protects unsaved selections', async ({ page }) => {
  const state = await messagingApi(page)
  await page.goto('/profile')
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a46sAAAAASUVORK5CYII=', 'base64')
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-profile.png', mimeType: 'image/png', buffer: bytes })
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await page.getByRole('button', { name: 'Save photo' }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic photo failure')
  await expect(page.getByLabel('Choose a photo')).toHaveValue(/synthetic-profile.png$/)
  await page.getByRole('button', { name: 'Save photo' }).click()
  await expect(page.getByRole('status')).toHaveText('Profile photo saved.')
  await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('status')).toHaveText('Profile photo removed.')
  await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0)
  expect(state.photo).toBe(false)
  expect(state.photoWrites).toBe(3)
})
