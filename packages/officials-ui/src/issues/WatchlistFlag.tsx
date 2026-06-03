import { StyleSheet, Text, View } from 'react-native'
import type { RepWatchlistFlag } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'

export interface WatchlistFlagProps {
  flag: RepWatchlistFlag
}

/** Compact thousands formatter: 42000 → "$42k", 950 → "$950". */
function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
}

/**
 * An inline "⚑" watchlist flag for the Issue Positions card: shows the matched
 * watchlist label + an evidence line (the contributing industries + total).
 * Presentational; the card fetches via useRepWatchlistFlags and renders one per
 * match. Distinct from the ★ IssuePriorityTag (different glyph + tone).
 */
export function WatchlistFlag({ flag }: WatchlistFlagProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const industries = flag.evidence.map((e) => e.industry).join(', ')
  return (
    <View
      accessibilityLabel={`Watchlist flag: ${flag.label}`}
      style={[styles.row, { backgroundColor: semantic.bg.subtle, borderColor: semantic.border.default }]}
    >
      <Text style={[styles.label, { color: semantic.alert.warning.fg }]} numberOfLines={1}>
        ⚑ {flag.label}
      </Text>
      <Text style={[styles.evidence, { color: semantic.text.muted }]} numberOfLines={2}>
        {money(flag.totalAmount)} from {industries}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  evidence: { fontSize: 12, marginTop: 2 },
})
