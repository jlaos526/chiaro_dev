'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * Town-hall `format` → display label, hoisted from the federal + state
 * town-halls lists (slice 80, audit C25). The two source maps were verified
 * byte-identical before hoisting.
 */
export const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  phone: 'Phone',
  hybrid: 'Hybrid',
}

export interface EventRowListProps<T> {
  rows: T[]
  keyOf: (row: T) => string
  /**
   * Slice-57 B6 null-guard built in ONCE: non-null url → the row is a link
   * Pressable opening the url; null → plain non-interactive View.
   */
  urlOf: (row: T) => string | null
  titleOf: (row: T) => string
  /** Muted meta lines rendered under the title; null/empty entries skipped. */
  metaOf: (row: T) => Array<string | null>
}

/**
 * Filter null/empty meta entries and assign row-unique content-based keys
 * (occurrence-suffixed on duplicates). Content keys avoid array-index keys
 * (Biome noArrayIndexKey) and stay stable across re-renders.
 */
function metaEntries(lines: Array<string | null>): Array<{ key: string; line: string }> {
  const seen = new Map<string, number>()
  const out: Array<{ key: string; line: string }> = []
  for (const line of lines) {
    if (line == null || line === '') continue
    const n = seen.get(line) ?? 0
    seen.set(line, n + 1)
    out.push({ key: n === 0 ? line : `${line}~${n}`, line })
  }
  return out
}

/**
 * Generic row-shaped event/office list (slice 80, audit C25) — generalizes
 * the near-identical federal/state town-halls + district-offices lists.
 *
 * Row bg = `semantic.bg.app` per the spec D1 locked scheme (shell elevated,
 * rows recessed to the page bg). Only row-shaped event/office lists adopt
 * this generic; structurally different sub-lists (votes, bills, donors,
 * holdings…) keep their bespoke row bodies.
 *
 * Renders null for empty `rows` — callers own their per-list empty copy
 * ("No town halls…" vs "No district offices…" differ per list).
 */
export function EventRowList<T>({
  rows,
  keyOf,
  urlOf,
  titleOf,
  metaOf,
}: EventRowListProps<T>): React.JSX.Element | null {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) return null
  return (
    <View style={styles.list}>
      {rows.map((row) => {
        const url = urlOf(row)
        const Row = url ? Pressable : View
        return (
          <Row
            key={keyOf(row)}
            {...(url
              ? {
                  onPress: () => Linking.openURL(url).catch(() => {}),
                  accessibilityRole: 'link' as const,
                }
              : {})}
            style={[styles.row, { backgroundColor: semantic.bg.app }]}
          >
            <Text style={[styles.title, { color: semantic.text.primary }]}>{titleOf(row)}</Text>
            {metaEntries(metaOf(row)).map((m) => (
              <Text key={m.key} style={[styles.meta, { color: semantic.text.muted }]}>
                {m.line}
              </Text>
            ))}
          </Row>
        )
      })}
    </View>
  )
}

// Row geometry copied from the pre-generic town-halls lists (the offices
// pair rendered bare rows — they gain the row bg/radius at migration).
// Title weight unified on '600' (the offices weight; town halls were '500').
const styles = StyleSheet.create({
  list: { gap: 6, padding: 8 },
  row: { borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
})
