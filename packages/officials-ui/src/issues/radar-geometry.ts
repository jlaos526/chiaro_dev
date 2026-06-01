// Pure radar-chart geometry. Kept side-effect-free + DOM-free so the math (the
// risky part) is unit-testable without rendering. Consumed by IssueRadarChart
// (Task 13) and reused by the rep-page overlay (Task 14) + home preview (Task
// 18). Axis 0 points straight up; axes advance clockwise.

/**
 * Point on axis `i` of `count` evenly spaced axes, at `value` (0–1) along the
 * axis, with full-scale radius `r` and center (`cx`, `cy`). Axis 0 points up
 * (screen coordinates: +y is down), subsequent axes go clockwise.
 */
export function radarPoint(
  i: number,
  count: number,
  value: number,
  r: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
  return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) }
}

/**
 * SVG `points` attribute (`"x,y x,y …"`) for a closed polygon over `values`,
 * one vertex per value. Each value is clamped to 0–1. Coordinates are fixed to
 * one decimal place for stable, dedupe-friendly output.
 */
export function radarPolygon(values: number[], r: number, cx: number, cy: number): string {
  return values
    .map((v, i) => {
      const p = radarPoint(i, values.length, Math.max(0, Math.min(1, v)), r, cx, cy)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
}
