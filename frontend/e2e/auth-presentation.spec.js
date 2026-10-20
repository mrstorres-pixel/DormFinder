import { test, expect } from '@playwright/test'

// Measure rendered text on the solid auth surfaces, including inherited child colors.
async function textContrast(root) {
  return root.evaluate(element => {
    const rgb = value => value.match(/[\d.]+/g).map(Number)
    const over = (foreground, background) => foreground.slice(0, 3).map((value, index) => value * (foreground[3] ?? 1) + background[index] * (1 - (foreground[3] ?? 1)))
    const backgroundOf = node => {
      const parents = []
      for (let current = node; current; current = current.parentElement) parents.unshift(current)
      return parents.reduce((background, parent) => over(rgb(getComputedStyle(parent).backgroundColor), background), [255, 255, 255])
    }
    const luminance = color => color.map(value => {
      const channel = value / 255
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
    const failures = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let text
    while ((text = walker.nextNode())) {
      const parent = text.parentElement
      if (!text.textContent.trim() || parent.closest('.visually-hidden, [aria-hidden="true"], :disabled, script, style')) continue
      const style = getComputedStyle(parent), range = document.createRange()
      range.selectNodeContents(text)
      if (!range.getBoundingClientRect().height || style.visibility === 'hidden') continue
      const background = backgroundOf(parent), foreground = over(rgb(style.color), background)
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
      const ratio = (values[0] + .05) / (values[1] + .05)
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && parseInt(style.fontWeight) >= 700)
      if (ratio < (large ? 3 : 4.5)) failures.push({ text: text.textContent.trim(), ratio: Number(ratio.toFixed(2)), color: style.color, background })
    }
    return failures
  })
}

for (const [name, path] of [['sign-in', '/login'], ['student-registration', '/register?role=student'], ['owner-registration', '/register?role=landlord']]) {
  test(`${name} has readable text and a centered campus card at desktop, tablet and phone widths`, async ({ page }, testInfo) => {
    await page.route('**/api/v1/**', route => {
      if (route.request().method() !== 'GET') return route.abort()
      return new URL(route.request().url()).pathname.endsWith('/me')
        ? route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } })
        : route.fulfill({ json: { data: [] } })
    })
    await page.goto(path)
    await expect(page.locator('.auth-panel form')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(page.locator('.campus-card')).toBeVisible()
      expect(await textContrast(page.locator('.auth-grid')), `Auth text contrast at ${width}px`).toEqual([])
      const geometry = await page.locator('.campus-card').evaluate(card => {
        const box = card.getBoundingClientRect(), group = card.querySelector('span').getBoundingClientRect()
        const lines = [card.querySelector('span').firstChild, card.querySelector('strong').firstChild].map(text => {
          const range = document.createRange()
          range.selectNodeContents(text)
          const line = range.getBoundingClientRect()
          return Math.abs(line.x + line.width / 2 - box.x - box.width / 2)
        })
        return { lines, vertical: Math.abs(group.y + group.height / 2 - box.y - box.height / 2), centered: getComputedStyle(card).textAlign }
      })
      expect(geometry.centered).toBe('center')
      expect(Math.max(...geometry.lines)).toBeLessThan(1)
      expect(geometry.vertical).toBeLessThan(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if ([1440, 390].includes(width)) await page.screenshot({ path: `../.local/auth-${name}-${testInfo.project.name}-${width}.png`, fullPage: true })
    }
  })
}
