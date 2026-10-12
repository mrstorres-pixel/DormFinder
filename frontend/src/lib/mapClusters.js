// Merge overlapping label footprints in projected map pixels. Unlike grid buckets,
// labels on opposite sides of an arbitrary cell boundary still group together.
export function mapClusters(properties, project) {
  const groups = properties.map(property => {
    const { x, y } = project(property)
    return { items: [property], x, y }
  })
  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < groups.length && !merged; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j]
        if (Math.abs(a.x - b.x) >= 132 || Math.abs(a.y - b.y) >= 60) continue
        const count = a.items.length + b.items.length
        groups[i] = { items: [...a.items, ...b.items], x: (a.x * a.items.length + b.x * b.items.length) / count, y: (a.y * a.items.length + b.y * b.items.length) / count }
        groups.splice(j, 1)
        merged = true
        break
      }
    }
  }
  return groups.map(group => group.items)
}
