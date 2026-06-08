'use client'

import { Text, View } from 'react-native'
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg'
import { useRadarColors } from '../brand-hooks.ts'
import { radarPoint, radarPolygon } from './radar-geometry.ts'

export interface IssueRadarChartProps {
  /** Axis labels — drives the axis count (one spoke per entry). */
  axes: string[]
  /** Your stance per axis, 0–1. */
  userValues: number[]
  /** Optional rep stance per axis, 0–1; `null` entries mean "no data" → drawn as 0. */
  repValues?: (number | null)[]
  /** Overall square size in px. */
  size?: number
}

/**
 * N-axis radar (spider) chart. Renders a grid polygon + radial spokes, an
 * optional dashed rep polygon, and the filled user polygon on top. Axis 0
 * points straight up; axes advance clockwise. Mode-aware colors via
 * `useRadarColors()`.
 *
 * Reused by the step-5 result screen (user's own radar), the rep-page overlay
 * (you-vs-rep, Task 14), and the home preview (Task 18).
 */
export function IssueRadarChart({
  axes,
  userValues,
  repValues,
  size = 220,
}: IssueRadarChartProps): React.JSX.Element {
  const c = useRadarColors()
  const r = size / 2 - 28
  const cx = size / 2
  const cy = size / 2
  const n = axes.length

  if (n === 0) {
    return (
      <View accessibilityLabel="Issue priorities radar: no data">
        <Text style={{ color: c.grid, fontSize: 12 }}>No issue data yet.</Text>
      </View>
    )
  }

  const axisSummary = axes
    .map((a, i) => `${a} ${Math.round((userValues[i] ?? 0) * 100)}%`)
    .join(', ')

  const grid = radarPolygon(
    axes.map(() => 1),
    r,
    cx,
    cy,
  )
  const userPoly = radarPolygon(userValues, r, cx, cy)
  const repPoly = repValues ? radarPolygon(repValues.map((v) => v ?? 0), r, cx, cy) : null

  return (
    <View accessibilityLabel={`Issue priorities radar: ${axisSummary}`}>
      <Svg width={size} height={size}>
        <Polygon points={grid} fill="none" stroke={c.grid} strokeWidth={1} />
        {axes.map((_, i) => {
          const p = radarPoint(i, n, 1, r, cx, cy)
          return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={c.grid} strokeWidth={1} />
        })}
        {axes.map((label, i) => {
          const p = radarPoint(i, n, 1.18, r, cx, cy)
          const anchor = p.x < cx - 1 ? 'end' : p.x > cx + 1 ? 'start' : 'middle'
          return (
            <SvgText key={`label-${i}`} x={p.x} y={p.y} fontSize={10} fill={c.grid} textAnchor={anchor}>
              {label}
            </SvgText>
          )
        })}
        {repPoly && (
          <Polygon points={repPoly} fill="none" stroke={c.repStroke} strokeWidth={1.6} strokeDasharray="4 2" />
        )}
        <Polygon points={userPoly} fill={c.userFill} stroke={c.userStroke} strokeWidth={1.8} />
      </Svg>
    </View>
  )
}
