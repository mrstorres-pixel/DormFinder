import { expect } from '@playwright/test'

// Check the actual glyph bounds so text cannot silently sit against a panel edge.
export async function expectInsetText(locator, minimum = 12) {
  const inset = await locator.evaluate(element => {
    const box = element.getBoundingClientRect(), bounds = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let text
    while ((text = walker.nextNode())) {
      if (!text.textContent.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(text)
      for (const rect of range.getClientRects()) if (rect.width && rect.height) bounds.push(rect)
    }
    return bounds.length ? Math.min(...bounds.flatMap(rect => [rect.left - box.left, box.right - rect.right, rect.top - box.top, box.bottom - rect.bottom])) : -1
  })
  expect(inset, 'Visible text must stay inside its padded container').toBeGreaterThanOrEqual(minimum)
}

export async function expectAlignedControls(controls) {
  await expect(controls.first()).toBeVisible()
  const boxes = await controls.evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect()
    return { center: box.top + box.height / 2, height: box.height }
  }))
  expect(boxes.length).toBeGreaterThan(1)
  expect(Math.max(...boxes.map(box => box.center)) - Math.min(...boxes.map(box => box.center))).toBeLessThan(1)
  expect(Math.min(...boxes.map(box => box.height))).toBeGreaterThanOrEqual(44)
}
