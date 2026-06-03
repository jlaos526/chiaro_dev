import { describe, it, expect } from 'vitest'
import { radarPoint, radarPolygon } from '../../src/issues/radar-geometry.ts'

describe('radar geometry', () => {
  it('axis 0 at value 1 is straight up from center', () => {
    const { x, y } = radarPoint(0, 6, 1, 50, 60, 60) // axisIndex,count,value,radius,cx,cy
    expect(Math.round(x)).toBe(60)
    expect(Math.round(y)).toBe(10) // cy - radius
  })

  it('axis 0 at value 0 sits at the center', () => {
    const { x, y } = radarPoint(0, 6, 0, 50, 60, 60)
    expect(Math.round(x)).toBe(60)
    expect(Math.round(y)).toBe(60)
  })

  it('axes advance clockwise (axis at count/4 points right for a 4-axis chart)', () => {
    // 4 axes: index 1 is 90° clockwise from up → pointing right (+x), same y as center.
    const { x, y } = radarPoint(1, 4, 1, 50, 60, 60)
    expect(Math.round(x)).toBe(110) // cx + radius
    expect(Math.round(y)).toBe(60)
  })

  it('polygon returns one "x,y" pair per axis', () => {
    const pts = radarPolygon([1, 0.5, 0.5, 0.5, 0.5, 0.5], 50, 60, 60)
    expect(pts.split(' ')).toHaveLength(6)
  })

  it('each polygon entry is a "x,y" coordinate pair', () => {
    const pts = radarPolygon([1, 0.5, 0.5], 50, 60, 60)
    for (const pair of pts.split(' ')) {
      expect(pair).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    }
  })

  it('clamps values above 1 and below 0', () => {
    // value 2 clamps to 1 → same as the straight-up full-radius point.
    const clampedHigh = radarPolygon([2], 50, 60, 60)
    const exactlyOne = radarPolygon([1], 50, 60, 60)
    expect(clampedHigh).toBe(exactlyOne)
    // value -1 clamps to 0 → center point.
    const clampedLow = radarPolygon([-1], 50, 60, 60)
    const exactlyZero = radarPolygon([0], 50, 60, 60)
    expect(clampedLow).toBe(exactlyZero)
  })
})
