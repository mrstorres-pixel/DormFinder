import { test, expect } from '@playwright/test'

test('built homepage defers page bundles until navigation', async ({ page, baseURL }) => {
  test.skip(!baseURL.startsWith('https:') && !process.env.E2E_BUILT, 'Checks production asset requests rather than Vite dev modules.')
  test.setTimeout(120_000)
  const chunks = []
  page.on('request', request => { if (/\/assets\/(ListingPages|ReviewPages|InquiryPages)-.*\.js/.test(request.url())) chunks.push(request.url()) })
  const directory = page.waitForResponse(response => response.url().endsWith('/api/v1/campuses') && response.status() === 200)
  const session = page.waitForResponse(response => response.url().endsWith('/api/v1/me') && response.status() === 401)
  await page.goto('/')
  await Promise.all([(await directory).finished(), (await session).finished()])
  await expect(page.getByRole('button', { name: 'Find housing near my campus' })).toBeEnabled()
  expect(chunks).toEqual([])
  const listingCode = page.waitForResponse(response => /\/assets\/ListingPages-.*\.js/.test(response.url()) && response.status() === 200)
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await listingCode
  await expect(page.getByRole('heading', { name: 'Places for your student life', exact: true })).toBeVisible()
  expect(chunks.some(url => /ListingPages-/.test(url))).toBe(true)
  expect(chunks.some(url => /ReviewPages-|InquiryPages-/.test(url))).toBe(false)
})
