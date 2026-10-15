import { test, expect } from '@playwright/test'

async function profileApi(page) {
  const user = { id: 987, name: 'Synthetic profile user', email: 'synthetic@example.test', role: 'student', preferred_campus_id: null }
  let profileWrites = 0, passwordWrites = 0, loggedOut = false
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/me/password')) {
      passwordWrites++
      if (passwordWrites === 1) return route.fulfill({ status: 422, json: { message: 'Synthetic password validation failure' } })
      loggedOut = true
      return route.fulfill({ json: { data: null } })
    }
    if (path.endsWith('/me')) {
      if (route.request().method() === 'PATCH') {
        profileWrites++
        if (profileWrites === 1) return route.fulfill({ status: 422, json: { message: 'Synthetic profile validation failure' } })
        Object.assign(user, route.request().postDataJSON())
      }
      return loggedOut ? route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }) : route.fulfill({ json: { data: user } })
    }
    return route.fulfill({ json: { data: [], meta: { current_page: 1, last_page: 1 } } })
  })
  return { passwordWrites: () => passwordWrites }
}
async function stay(page) {
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay and edit' }).click()
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).not.toBeVisible()
}

test('profile and password edits have independent guards and failed saves retain input', async ({ page }) => {
  await profileApi(page)
  await page.goto('/profile')
  await page.getByLabel('Your name').fill('Unsaved profile name')
  await page.locator('.settings-security > summary').click()
  await page.getByLabel('New password', { exact: true }).fill('Synthetic-password-27')
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await stay(page)
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic profile validation failure')
  await expect(page.getByLabel('Your name')).toHaveValue('Unsaved profile name')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved.')
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await stay(page)
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue('Synthetic-password-27')
  const stored = await page.evaluate(() => [...Object.values(sessionStorage), ...Object.values(localStorage)].join(' '))
  expect(stored.includes('Synthetic-password-27')).toBe(false)
  await page.getByLabel('New password', { exact: true }).fill('')
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue('')
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await expect(page).toHaveURL(/\/listings$/)
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('password changes confirm other profile edits before the API and clear guards only on success', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const api = await profileApi(page)
  await page.goto('/profile')
  await page.getByLabel('Your name').fill('Still unsaved name')
  await page.locator('.settings-security > summary').click()
  await page.getByLabel('Current password').fill('Synthetic-current-27')
  await page.getByLabel('New password', { exact: true }).fill('Synthetic-new-password-27')
  await page.getByLabel('Confirm new password').fill('Synthetic-new-password-27')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  expect(api.passwordWrites()).toBe(0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic password validation failure')
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await stay(page)
  await expect(page.getByLabel('Your name')).toHaveValue('Still unsaved name')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(errors).toEqual([])
})
