import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const role of ['student', 'landlord', 'admin']) test(`existing ${role} can follow the walkthrough using real read-only data`, async ({ browser, baseURL }, testInfo) => {
  test.skip(!baseURL.startsWith('https:'), 'Acceptance against existing live accounts without changing listing data.')
  test.setTimeout(150_000)
  const accounts = JSON.parse((await readFile(`../.secrets/discovery-browser-cloud-${testInfo.project.name}.json`, 'utf8')).replace(/^\uFEFF/, ''))
  const credentials = role === 'admin' ? JSON.parse((await readFile('../.secrets/phase2-cloud-admin.json', 'utf8')).replace(/^\uFEFF/, '')) : accounts[role]
  const context = await browser.newContext({ baseURL })
  const writes = [], errors = []
  await context.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET' || (request.method() === 'POST' && path === '/api/v1/auth/login')) return route.continue()
    writes.push({ path, method: request.method() })
    return route.abort('blockedbyclient')
  })
  try {
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/login')
    await page.getByLabel('Email address').fill(credentials.email)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(role === 'student' ? /\/account$/ : role === 'landlord' ? /\/landlord$/ : /\/admin$/, { timeout: 45_000 })
    await page.locator('.site-header').getByRole('button', { name: 'Start walkthrough' }).click()
    const coach = page.locator('.walkthrough-coach'), tour = page.locator('.walkthrough-layer')
    await expect(coach.getByRole('button', { name: 'Start walkthrough', exact: true })).toBeEnabled({ timeout: 30_000 })
    await expect(coach).not.toContainText('Some listing details could not load')
    await coach.getByRole('button', { name: 'Start walkthrough', exact: true }).click()
    let count = 0
    while (await tour.getAttribute('data-walkthrough-step') !== 'complete') {
      expect(++count).toBeLessThan(16)
      await expect(page.locator('.walkthrough-spotlight')).toBeVisible({ timeout: 30_000 })
      await expect(coach).not.toContainText('unavailable right now')
      await coach.getByRole('button', { name: /^(Next|Finish tour)/ }).click()
    }
    await coach.getByRole('button', { name: /Start exploring|Go to my properties|Go to reviews/ }).click()
    await expect(tour).toHaveCount(0)
    expect(writes).toEqual([])
    expect(errors).toEqual([])
  } finally { await context.close() }
})
