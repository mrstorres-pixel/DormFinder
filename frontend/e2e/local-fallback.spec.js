import { test, expect } from '@playwright/test'
import { applyLocalFallbackPolicy } from './local-fallback-policy'

test('local fallback policy refuses cloud targets and blocks an external request', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL })
  const previousMode = process.env.E2E_LOCAL_ONLY
  process.env.E2E_LOCAL_ONLY = '1'
  try {
    await expect(applyLocalFallbackPolicy(context, 'https://dormfinder-pink.vercel.app')).rejects.toThrow('refuses a cloud base URL')
    await applyLocalFallbackPolicy(context, 'http://127.0.0.1:5173')
    const page = await context.newPage()
    const failed = page.waitForEvent('requestfailed', request => request.url() === 'https://example.invalid/blocked-rehearsal-request')
    await page.goto(baseURL)
    const blocked = await page.evaluate(() => fetch('https://example.invalid/blocked-rehearsal-request').then(() => false).catch(() => true))
    expect(blocked).toBe(true)
    expect((await failed).failure()?.errorText).toBe(testInfo.project.name === 'webkit' ? 'Blocked by Web Inspector' : 'net::ERR_INTERNET_DISCONNECTED')
    await expect(page.getByRole('button', { name: 'Find housing' })).toBeEnabled()
  } finally {
    if (previousMode === undefined) delete process.env.E2E_LOCAL_ONLY
    else process.env.E2E_LOCAL_ONLY = previousMode
    await context.close()
  }
})
