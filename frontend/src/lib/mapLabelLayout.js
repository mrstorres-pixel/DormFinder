// Move labels, never their geographic anchors. Leader lines show displaced labels' locations.
export function mapLabelLayout(labels, campus) {
  const occupied = campus ? [{ x: campus.x, y: campus.y + 12, width: 76, height: 100 }] : []
  return labels.map(label => {
    const choices = [[0, 0]]
    for (let distance = 80; distance <= 640; distance += 80) choices.push([0, -distance], [0, distance], [-distance, 0], [distance, 0])
    const overlaps = box => occupied.some(other => Math.abs(box.x - other.x) < (box.width + other.width) / 2 + 8 && Math.abs(box.y - other.y) < (box.height + other.height) / 2 + 8)
    const offset = choices.find(([dx, dy]) => !overlaps({ ...label, x: label.x + dx, y: label.y + dy })) || [0, -720]
    occupied.push({ ...label, x: label.x + offset[0], y: label.y + offset[1] })
    return offset
  })
}
