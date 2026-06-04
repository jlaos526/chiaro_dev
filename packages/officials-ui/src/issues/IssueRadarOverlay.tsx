'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { RepAlignment } from '@chiaro/issues'
import { useBrandTokens, useRadarColors } from '../brand-hooks.ts'
import { IssueRadarChart } from './IssueRadarChart.tsx'

export interface IssueRadarOverlayProps {
  /** Per-issue alignment for this rep (carries per-axis userPos + repPos). */
  alignment: RepAlignment
  /** Rep's display name, for the caption + legend. */
  repName?: string
}

/**
 * Expanded radar view for the rep alignment strip — a true two-polygon
 * you-vs-rep comparison. The filled polygon is the user's per-topic position
 * (`userPos`); the dashed polygon is the rep's (`repPos`). A null position
 * (no data on that topic) is drawn at center. The strip's overall % + dots
 * still come from `alignmentPct`; this overlay is the richer positional view.
 *
 * Presentational only — the parent supplies `alignment` (and opens/closes this
 * via the strip's `onExpand`). Mode-aware via `useBrandTokens()`/`useRadarColors()`.
 */
export function IssueRadarOverlay({
  alignment,
  repName,
}: IssueRadarOverlayProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const radar = useRadarColors()

  const axisLabels = alignment.axes.map((a) => a.label)
  const userValues = alignment.axes.map((a) => (a.userPos ?? 0) / 100)
  const repValues = alignment.axes.map((a) => (a.repPos == null ? null : a.repPos / 100))

  const repLabel = repName ?? 'Rep'
  const caption = repName ? `Your positions vs ${repName}` : 'Your positions vs this rep'

  return (
    <View
      accessibilityLabel="You versus rep issue radar"
      style={[
        styles.overlay,
        { backgroundColor: semantic.bg.card, borderColor: semantic.border.default },
      ]}
    >
      <IssueRadarChart axes={axisLabels} userValues={userValues} repValues={repValues} />
      <Text style={[styles.caption, { color: semantic.text.muted }]}>{caption}</Text>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: radar.userStroke }]} />
          <Text style={[styles.legendText, { color: semantic.text.muted }]}>You</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.swatchDashed, { borderColor: radar.repStroke }]} />
          <Text style={[styles.legendText, { color: semantic.text.muted }]} numberOfLines={1}>
            {repLabel}
          </Text>
        </View>
      </View>
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
    flexDirection: 'row',
    gap: 14,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatch: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  swatchDashed: {
    width: 14,
    height: 0,
    borderTopWidth: 1.6,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 9.5,
  },
})
