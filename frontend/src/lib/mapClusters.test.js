import { describe, expect, it } from 'vitest'
import { mapClusters } from './mapClusters'

describe('map label grouping', () => {
  it('groups labels across former grid boundaries while preserving every listing exactly once', () => {
    const points = [{ id: 1, x: 74, y: 54 }, { id: 2, x: 76, y: 56 }, { id: 3, x: 500, y: 300 }]
    expect(mapClusters(points, point => point).map(group => group.map(point => point.id))).toEqual([[1, 2], [3]])
  })
  it('keeps final label footprints separated after group centers move', () => {
    const points = Array.from({ length: 200 }, (_, id) => ({ id, x: (id % 20) * 48, y: Math.floor(id / 20) * 45 }))
    const groups = mapClusters(points, point => point)
    expect(groups.flat().map(point => point.id).sort((a, b) => a - b)).toEqual(points.map(point => point.id))
    const centers = groups.map(group => ({ x: group.reduce((sum, point) => sum + point.x, 0) / group.length, y: group.reduce((sum, point) => sum + point.y, 0) / group.length }))
    for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) {
      expect(Math.abs(centers[i].x - centers[j].x) >= 132 || Math.abs(centers[i].y - centers[j].y) >= 60).toBe(true)
    }
  })
  it('separates rooms as zoom increases and handles an empty result', () => {
    const points = [{ id: 1, x: 10, y: 10 }, { id: 2, x: 50, y: 20 }]
    expect(mapClusters(points, point => point)).toHaveLength(1)
    expect(mapClusters(points, point => ({ x: point.x * 4, y: point.y * 4 }))).toHaveLength(2)
    expect(mapClusters([], point => point)).toEqual([])
  })
})
