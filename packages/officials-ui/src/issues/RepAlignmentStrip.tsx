'use client'

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { RepAlignment } from '@chiaro/issues'
import { useAlignmentDotColor, useBrandTokens } from '../brand-hooks.ts'
import { SmartAnchor } from '../primitives/SmartAnchor.tsx'

export interface RepAlignmentStripProps {
  /** Per-issue alignment for this rep, or `null` while loading / unselected. */
  alignment: RepAlignment | null
  /** Whether the user has any issue selections at all. */
  hasSelections: boolean
  /** Tapped the "set your issue priorities" CTA (route → the flow). */
  onSetup: () => void
  /**
   * Web: rendered as `href` on a real `<a>` for the setup CTA (state 1).
   * Preserves middle-click / Cmd-click → "open in new tab", status-bar URL
   * preview, browser history. Plain left-click still routes via `onSetup`.
   * Native (or web without it): the existing `<Pressable onPress={onSetup}>`.
   */
  setupHref?: string
  /**
   * Slice 79 (audit C7): hover/focus route prefetch for the setup CTA — web
   * wrappers pass `() => router.prefetch(setupHref)`. Web-only; native ignores.
   */
  onSetupPrefetch?: () => void
  /** Tapped the strip to open the radar overlay. */
  onExpand: () => void
  /** Whether the overlay is currently open (drives aria-expanded + chevron). */
  expanded?: boolean
}

/**
 * Slim, glanceable rep-page alignment strip (the Option C "hybrid" treatment).
 *
 * Three states:
 *  1. `!hasSelections` → a Pressable CTA inviting the user to set priorities.
 *  2. `hasSelections` but `overallPct == null` → a muted "no comparable record"
 *     row (the rep has no scored data on the user's chosen issues).
 *  3. otherwise → `<pct>% aligned` + one colored dot per axis + a "tap to
 *     compare ▾" affordance; pressing opens the radar overlay (`onExpand`).
 *
 * Presentational only — the parent route fetches via `useRepAlignment` /
 * `useMySelections` and passes data + nav callbacks down. Visual reference:
 * .superpowers/brainstorm/9127-1780266235/content/rep-tag-binding-v2.html (C).
 */
export function RepAlignmentStrip({
  alignment,
  hasSelections,
  onSetup,
  setupHref,
  onSetupPrefetch,
  onExpand,
  expanded = false,
}: RepAlignmentStripProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  // State 1 — no selections yet: invite the user into the flow.
  if (!hasSelections) {
    const stripStyle = [
      styles.strip,
      { backgroundColor: semantic.bg.subtle, borderColor: semantic.border.default },
    ]
    const ctaContent = (
      <Text style={[styles.ctaText, { color: semantic.link.fg }]} numberOfLines={2}>
        Set your issue priorities to see how they align →
      </Text>
    )
    // Web smart-anchor: real <a href> with modifier-key passthrough; plain
    // left-click still dispatches to onSetup (client-side router.push).
    if (Platform.OS === 'web' && setupHref) {
      return (
        <SmartAnchor
          href={setupHref}
          onPress={onSetup}
          {...(onSetupPrefetch ? { onPrefetch: onSetupPrefetch } : {})}
          accessibilityLabel="Set your issue priorities"
          style={StyleSheet.flatten([...stripStyle, { display: 'flex', cursor: 'pointer' }])}
        >
          {ctaContent}
        </SmartAnchor>
      )
    }
    return (
      <Pressable
        onPress={onSetup}
        accessibilityRole="button"
        accessibilityLabel="Set your issue priorities"
        style={stripStyle}
      >
        {ctaContent}
      </Pressable>
    )
  }

  // State 2 — selections exist but the rep has no scored data on them.
  if (alignment == null || alignment.overallPct == null) {
    return (
      <View
        style={[
          styles.strip,
          { backgroundColor: semantic.bg.subtle, borderColor: semantic.border.default },
        ]}
      >
        <Text style={[styles.mutedText, { color: semantic.text.muted }]} numberOfLines={2}>
          No comparable record yet on your issues
        </Text>
      </View>
    )
  }

  // State 3 — show the percent + per-axis dots, tap to open the radar.
  return (
    <Pressable
      onPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? 'Hide' : 'Compare'} your issue alignment, ${alignment.overallPct}% aligned`}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      style={[
        styles.strip,
        { backgroundColor: semantic.bg.subtle, borderColor: semantic.border.default },
      ]}
    >
      <View style={styles.pctBlock}>
        <Text style={[styles.pct, { color: semantic.signal.success }]}>
          {alignment.overallPct}%
        </Text>
        <Text style={[styles.pctLabel, { color: semantic.text.muted }]}>aligned</Text>
      </View>
      <View style={styles.dots}>
        {alignment.axes.map((axis) => (
          <AxisDot key={axis.topicSlug} dot={axis.dot} label={axis.label} />
        ))}
      </View>
      <Text style={[styles.expand, { color: semantic.link.fg }]} numberOfLines={2}>
        {expanded ? 'tap to hide ▴' : 'tap to compare ▾'}
      </Text>
    </Pressable>
  )
}

function AxisDot({
  dot,
  label,
}: {
  dot: RepAlignment['axes'][number]['dot']
  label: string
}): React.JSX.Element {
  const color = useAlignmentDotColor(dot)
  return (
    <View
      // `data-axis-dot` lets the parent/test count axis dots; RNW passes
      // unknown DOM attrs through `dataSet` only, but a literal `data-*` on a
      // View reaches the DOM via the augmented ViewProps (slice 39 dataSet
      // pattern). We use dataSet for the queryable hook + accessibilityLabel
      // for AT.
      dataSet={{ axisDot: '' }}
      accessibilityLabel={`${label}: ${dot}`}
      style={[styles.dot, { backgroundColor: color }]}
    />
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 9,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mutedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pctBlock: {
    alignItems: 'flex-start',
  },
  pct: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 16,
  },
  pctLabel: {
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expand: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
  },
})
