import { describe, it, expect } from 'vitest'
import { mapLabelLayout } from './mapLabelLayout'

describe('map labels', () => {
  it('does not reserve space for an unselected campus', () => {
    expect(mapLabelLayout([{ x: 0, y: 0, width: 104, height: 42 }], null)).toEqual([[0, 0]])
  })
  it('keeps distant labels at their exact anchor and separates nearby labels from the campus', () => {
    const labels = [{ x: -200, y: -200, width: 104, height: 42 }, { x: 0, y: 40, width: 84, height: 42 }, { x: 0, y: -45, width: 120, height: 42 }]
    const original = structuredClone(labels)
    const offsets = mapLabelLayout(labels, { x: 0, y: 0 })
    expect(offsets[0]).toEqual([0, 0])
    const placed = labels.map((label, index) => ({ ...label, x: label.x + offsets[index][0], y: label.y + offsets[index][1] }))
    const campus = { x: 0, y: 12, width: 76, height: 100 }
    for (const [index, label] of placed.entries()) {
      for (const other of [campus, ...placed.slice(0, index)]) {
        expect(Math.abs(label.x - other.x) >= (label.width + other.width) / 2 + 8 || Math.abs(label.y - other.y) >= (label.height + other.height) / 2 + 8).toBe(true)
      }
    }
    expect(labels).toEqual(original)
  })
})
