import { test, expect } from '@playwright/test'

test('new campuses remain distinct and searches keep the selected radius', async ({ page }) => {
  test.setTimeout(120_000)
  const response = await page.request.get('/api/v1/campuses')
  expect(response.ok()).toBe(true)
  const directory = (await response.json()).data
  for (const slug of ['adamson-manila', 'up-diliman', 'ateneo-loyola-heights']) {
    expect(directory.find(campus => campus.slug === slug)).toBeTruthy()
  }
  const up = directory.find(campus => campus.slug === 'up-diliman')
  const ateneo = directory.find(campus => campus.slug === 'ateneo-loyola-heights')
  expect(up.id).not.toBe(ateneo.id)
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
  await page.goto('/')
  await page.locator('.home-campus-form').getByRole('combobox', { name: 'College or university' }).fill('UP Diliman')
  await page.getByRole('button', { name: /UP.*Diliman.*Quezon City/ }).click()
  await page.getByRole('button', { name: 'Find housing near my campus' }).click()
  await expect(page).toHaveURL(new RegExp(`campus_id=${up.id}&radius_km=2&sort=recommended`))
  await expect(page.getByRole('heading', { name: 'No listings match your search.' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Remove distance limits' })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('radius_km')).toBe('2')
  await page.getByRole('link', { name: 'DormFinder home' }).click()
  await page.locator('.home-campus-form').getByRole('combobox', { name: 'College or university' }).fill('ADMU')
  await page.getByRole('button', { name: /Ateneo.*Loyola Heights/ }).click()
  await page.getByRole('button', { name: 'Find housing near my campus' }).click()
  await expect(page).toHaveURL(new RegExp(`campus_id=${ateneo.id}&radius_km=2&sort=recommended`))
  await expect(page.getByRole('heading', { name: 'No listings match your search.' })).toBeVisible({ timeout: 90_000 })
})

for (const role of ['student', 'landlord', 'admin']) {
  test(`${role} dashboard offers relevant next actions`, async ({ page }) => {
    await page.setViewportSize({ width: role === 'student' ? 360 : role === 'landlord' ? 768 : 1440, height: 1000 })
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/me')) return route.fulfill({ json: { data: { id: 987, name: 'Synthetic dashboard user', role, preferred_campus_id: role === 'student' ? 8 : null } } })
      if (path.endsWith('/dashboard')) return route.fulfill({ json: { data: { unread_notifications: 2, ...(role === 'student' ? { favorites: 3, inquiries: 1, open_reports: 0 } : role === 'landlord' ? { listings: { draft: 2, approved: 1 }, inquiries: 1 } : { pending_reviews: 2, open_reports: 1, published_listings: 16 }) } } })
      return route.fulfill({ json: { data: [], meta: { current_page: 1, last_page: 1 } } })
    })
    await page.goto(role === 'student' ? '/account' : role === 'landlord' ? '/landlord' : '/admin')
    if (role !== 'student') {
      await expect(page.getByRole('heading', { name: 'Your next steps' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Unread notifications', exact: true })).toHaveAttribute('href', '/notifications')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    if (role === 'student') {
      await expect(page.getByRole('heading', { name: 'Find your next place.' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Explore places' })).toHaveAttribute('href', '/listings?campus_id=8&radius_km=2&sort=recommended')
      await page.getByRole('link', { name: 'Compare room options' }).click()
      await expect(page).toHaveURL(/\/compare$/)
    } else if (role === 'landlord') {
      await expect(page.getByText(/2 drafts or returned listings/)).toBeVisible()
      await expect(page.getByRole('link', { name: 'Respond to students' })).toHaveAttribute('href', '/inquiries')
    } else {
      await expect(page.getByRole('link', { name: 'Follow up on reports' })).toHaveAttribute('href', '/admin/reports')
      await expect(page.getByRole('link', { name: 'Check moderation history' })).toHaveAttribute('href', '/admin/audit')
    }
  })
}
