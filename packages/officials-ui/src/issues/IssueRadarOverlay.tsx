'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { RepAlignment } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { IssueRadarChart } from './IssueRadarChart.tsx'

export interface IssueRadarOverlayProps {
  /** Per-issue alignment for this rep. */
  alignment: RepAlignment
  /** Rep's display name, for the caption. */
  repName?: string
  /**
   * Optional rep stance per axis (0–1) for a future TRUE you-vs-rep overlay.
   * The current RPC returns per-axis `alignmentPct` (a single derived ring),
   * NOT separate user/rep positions — so v1 callers leave this undefined and
   * the chart renders a single alignment ring. Wired through to keep the API
   * forward-compatible without fabricating rep data.
   */
  repValues?: (number | null)[]
}

/**
 * Expanded radar view for the rep alignment strip (Task 14).
 *
 * **v1 = a single alignment ring.** The `get_rep_issue_alignment` RPC returns a
 * per-axis `alignmentPct` (how well the rep matches the user on each issue),
 * not separate user-position vs rep-position vectors — so a true two-polygon
 * you-vs-rep overlay isn't supported yet. We map `alignmentPct → 0–1` and draw
 * the alignment shape: a fuller polygon means more aligned across issues. The
 * optional `repValues` prop is threaded to the chart for a future real overlay.
 *
 * Presentational only — the parent supplies `alignment` (and opens/closes this
 * via the strip's `onExpand`). Mode-aware via `useBrandTokens()`.
 */
export function IssueRadarOverlay({
  alignment,
  repName,
  repValues,
}: IssueRadarOverlayProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const axisLabels = alignment.axes.map((a) => a.label)
  // alignmentPct (0–100, nullable) → 0–1; null ("no data on this issue") → 0.
  const userValues = alignment.axes.map((a) => (a.alignmentPct ?? 0) / 100)

  const caption = repName
    ? `Your alignment with ${repName} per issue`
    : 'Your alignment per issue'

  return (
    <View
      accessibilityLabel="Issue alignment radar"
      style={[
        styles.overlay,
        { backgroundColor: semantic.bg.card, borderColor: semantic.border.default },
      ]}
    >
      <IssueRadarChart
        axes={axisLabels}
        userValues={userValues}
        // Only forward repValues when present — IssueRadarChart's prop is a
        // required `(number|null)[]` and the package enables
        // exactOptionalPropertyTypes, so passing `undefined` is a type error.
        {...(repValues ? { repValues } : {})}
      />
      <Text style={[styles.caption, { color: semantic.text.muted }]}>{caption}</Text>
      <Text style={[styles.legend, { color: semantic.text.muted }]}>
        Fuller shape = more aligned across your issues.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 11,
    gap: 4,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    fontSize: 9.5,
    textAlign: 'center',
  },
})
