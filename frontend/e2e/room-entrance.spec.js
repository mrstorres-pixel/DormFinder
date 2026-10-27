import { test, expect } from '@playwright/test'

const engineRequest = url => /(?:dormRoom|three(?:[./_-]|$))/.test(url)
async function scrollScene(page, progress) {
  await page.locator('.room-entrance').evaluate((el, p) => {
    const stage = el.querySelector('.room-stage')
    scrollTo(0, el.offsetTop + (el.offsetHeight - stage.clientHeight) * p)
  }, progress)
  await expect.poll(() => page.locator('.room-entrance').evaluate(el => Number(el.style.getPropertyValue('--journey-progress')))).toBeCloseTo(progress, 2)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

test('the real room enters and reverses on scroll, adapts to mobile, and leads to campus search', async ({ page, browserName }, testInfo) => {
  test.setTimeout(120_000)
  const errors = []
  page.on('console', message => { if (/WebGL|THREE|ROOM/.test(message.text())) console.info('Graphics diagnostic:', message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.roomRenderCount = 0
    document.addEventListener('webglcontextlost', () => console.info('ROOM context lost'), true)
    if (!window.WebGL2RenderingContext) return
    const original = WebGL2RenderingContext.prototype.clear
    WebGL2RenderingContext.prototype.clear = function (...args) { window.roomRenderCount++; return original.apply(this, args) }
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const room = page.locator('.room-entrance')
  await expect(room).toHaveAttribute('data-mode', /animated|static/, { timeout: 30_000 })
  console.info('Room renderer:', browserName, await room.getAttribute('data-mode'))
  if (await room.getAttribute('data-mode') === 'static') {
    expect(browserName, 'Chromium must exercise actual WebGL, not silently pass a fallback').not.toBe('chromium')
    testInfo.annotations.push({ type: 'graphics', description: 'WebGL unavailable in this browser runner; static fallback verified. Chromium covers the real scene.' })
    await expect(page.locator('.room-poster')).toBeVisible()
  } else {
    await expect(room).toHaveAttribute('data-ready', 'true')
    const canvas = page.locator('.room-canvas')
    await scrollScene(page, 0)
    const opening = await canvas.screenshot({ path: testInfo.outputPath('doorway.png') })
    await scrollScene(page, .5)
    const threshold = await canvas.screenshot({ path: testInfo.outputPath('threshold.png') })
    expect(threshold.equals(opening)).toBe(false)
    await scrollScene(page, 1)
    const inside = await canvas.screenshot({ path: testInfo.outputPath('inside.png') })
    expect(inside.equals(threshold)).toBe(false)
    await expect(page.locator('.room-ending')).toHaveCSS('opacity', '1')
    await scrollScene(page, 0)
    await expect(page.locator('.room-intro')).toHaveCSS('opacity', '1')
    const returned = await canvas.screenshot({ path: testInfo.outputPath('returned-doorway.png') })
    const changedPixels = await page.evaluate(async ([first, second]) => {
      const images = await Promise.all([first, second].map(data => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = 'data:image/png;base64,' + data })))
      // Compare composition at a common thumbnail size: adaptive GPU resolution can change edge antialiasing.
      const pixels = images.map(image => { const surface = document.createElement('canvas'); surface.width = 144; surface.height = 90; const context = surface.getContext('2d'); context.drawImage(image, 0, 0, 144, 90); return context.getImageData(0, 0, 144, 90).data })
      let changed = 0
      for (let i = 0; i < pixels[0].length; i += 4) if ([0, 1, 2].some(channel => Math.abs(pixels[0][i + channel] - pixels[1][i + channel]) > 12)) changed++
      return changed / (pixels[0].length / 4)
    }, [opening.toString('base64'), returned.toString('base64')])
    expect(changedPixels).toBeLessThan(.02)
    const stationaryFrames = await page.evaluate(async () => { const before = window.roomRenderCount; await new Promise(resolve => setTimeout(resolve, 300)); return window.roomRenderCount - before })
    expect(stationaryFrames).toBe(0)
    const hiddenFrames = await page.evaluate(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
      const before = window.roomRenderCount, el = document.querySelector('.room-entrance')
      scrollTo({ top: el.offsetTop + (el.offsetHeight - innerHeight) / 2, behavior: 'instant' })
      await new Promise(resolve => setTimeout(resolve, 150))
      const frames = window.roomRenderCount - before
      delete document.hidden
      document.dispatchEvent(new Event('visibilitychange'))
      return frames
    })
    expect(hiddenFrames).toBe(0)
    await scrollScene(page, .5)
    await page.setViewportSize({ width: 390, height: 844 })
    await scrollScene(page, 1)
    await expect(page.getByRole('link', { name: 'Find housing', exact: true })).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath('mobile-room.png') })
    expect(await canvas.evaluate(el => el.width)).toBeLessThanOrEqual(390)
    await page.setViewportSize({ width: 844, height: 390 })
    await scrollScene(page, .5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await expect(page.getByRole('button', { name: 'Find housing' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('link', { name: 'Find housing', exact: true }).click()
  const campus = page.locator('#find-housing').getByRole('combobox', { name: 'Campus, location or listing' })
  await expect(campus).toBeFocused()
  await expect(campus).toBeInViewport()
  await campus.fill('TIP Manila')
  await campus.press('ArrowDown'); await campus.press('ArrowDown'); await campus.press('Enter')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByLabel('Room type and price basis').selectOption('bedspace')
  await page.getByLabel('Maximum monthly base rent (PHP)').fill('7000')
  await page.getByRole('button', { name: 'Find housing' }).click()
  await expect(page).toHaveURL(/campus_id=\d+.*inventory_type=bedspace.*price_basis=per_person.*max_rent_centavos=700000/)
  await expect(page.getByRole('heading', { name: 'Places for your student life', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: /Your next place/ })).toBeVisible()
  await expect(page.locator('#find-housing')).toBeAttached()
  expect(errors).toEqual([])
})

test('the hallway facade covers the top and left edges beneath the navbar', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('.room-entrance')).toHaveAttribute('data-ready', 'true')
  const gap = await page.evaluate(() => document.querySelector('.room-entrance').getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom)
  expect(Math.abs(gap)).toBeLessThan(2)
  const frame = await page.locator('.room-canvas').screenshot({ path: testInfo.outputPath('flush-hallway.png') })
  const coverage = await page.evaluate(async data => {
    const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode()
    const surface = document.createElement('canvas'); surface.width = 144; surface.height = 90
    const context = surface.getContext('2d'); context.drawImage(image, 0, 0, surface.width, surface.height)
    return [[.55, .005], [.72, .005], [.28, .14]].map(([x, y]) => {
      const color = context.getImageData(Math.floor(surface.width * x), Math.floor(surface.height * y), 1, 1).data
      return [240, 244, 250].reduce((difference, value, index) => difference + Math.abs(color[index] - value), 0)
    })
  }, frame.toString('base64'))
  for (const difference of coverage) expect(difference, 'The wall must cover the frame rather than expose the scene background').toBeGreaterThan(18)
})

test('reduced motion skips the engine and long scroll, and preference changes work', async ({ page }) => {
  const requests = []
  page.on('request', request => { if (engineRequest(request.url())) requests.push(request.url()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const room = page.locator('.room-entrance')
  await expect(room).toHaveAttribute('data-mode', 'static')
  expect(await room.evaluate(el => el.offsetHeight <= Math.max(innerHeight, 540))).toBe(true)
  await expect(page.locator('.room-canvas')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Find housing' })).toBeEnabled({ timeout: 30_000 })
  expect(requests).toEqual([])
  await page.getByRole('link', { name: 'Find housing', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#find-housing input[role=combobox]')).toBeFocused()
  await page.evaluate(() => scrollTo(0, 0))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  await expect(room).toHaveAttribute('data-mode', /animated|static/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(room).toHaveAttribute('data-mode', 'static')
  await expect(page.locator('.room-canvas')).toBeHidden()
})

test('scene download failure preserves the page and campus search', async ({ page }) => {
  await page.route('**/*dormRoom*', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.room-entrance')).toHaveAttribute('data-mode', 'static', { timeout: 30_000 })
  await expect(page.locator('.room-poster')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Find housing' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('link', { name: 'Find housing', exact: true }).click()
  await expect(page.locator('#find-housing input[role=combobox]')).toBeFocused()
})

test('campus search is usable while the room engine is still downloading', async ({ page }) => {
  let pending
  await page.route('**/*dormRoom*', route => { pending = route })
  await page.goto('/')
  await expect.poll(() => Boolean(pending)).toBe(true)
  await expect(page.locator('.room-entrance')).toHaveAttribute('data-mode', 'loading')
  await expect(page.getByRole('button', { name: 'Find housing' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('link', { name: 'Find housing', exact: true }).click()
  const campus = page.locator('#find-housing input[role=combobox]')
  await expect(campus).toBeFocused()
  await campus.fill('TIP Manila')
  await campus.press('ArrowDown'); await campus.press('ArrowDown'); await campus.press('Enter')
  await page.getByRole('button', { name: 'Find housing' }).click()
  await expect(page.getByRole('heading', { name: 'Places for your student life', exact: true })).toBeVisible()
  await pending.abort()
})

test('graphics context loss falls back and direct listing visits do not load the room', async ({ page, browserName }) => {
  const requests = []
  page.on('request', request => { if (engineRequest(request.url())) requests.push(request.url()) })
  await page.goto('/listings')
  await expect(page.getByRole('heading', { name: 'Places for your student life', exact: true })).toBeVisible()
  expect(requests).toEqual([])
  await page.getByRole('link', { name: 'DormFinder home' }).click()
  const room = page.locator('.room-entrance')
  await expect(room).toHaveAttribute('data-mode', /animated|static/, { timeout: 30_000 })
  if (await room.getAttribute('data-mode') === 'animated') {
    await expect(room).toHaveAttribute('data-ready', 'true')
    await page.locator('.room-canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2')
      const extension = gl.getExtension('WEBGL_lose_context')
      if (!extension) throw new Error('Context loss extension unavailable')
      extension.loseContext()
    })
    await expect(room).toHaveAttribute('data-mode', 'static')
  } else expect(browserName).not.toBe('chromium')
  await expect(page.locator('.room-canvas')).toBeHidden()
  await expect(page.locator('.room-poster')).toBeVisible()
})
