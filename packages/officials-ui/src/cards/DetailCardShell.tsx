'use client'

import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface DetailCardShellProps {
  /** Card title — the shell emits the card's ONLY h2-equivalent heading. */
  title: string
  /** True while any of the card's unconditional queries is still loading. */
  isLoading: boolean
  /**
   * U2: true when any card query errored — DISTINCT from empty. Error wins
   * over loading so a refetch spinner never masks a real failure.
   */
  isError?: boolean
  /** U2: called by the error branch's Retry pressable (a refetch-all closure). */
  onRetry?: () => void
  /** All queries loaded and there is nothing to show. */
  isEmpty: boolean
  /** Per-card copy for the empty branch (e.g. "No community-presence data…"). */
  emptyText: string
  /** Data branch — rendered when not error / loading / empty. */
  children: ReactNode
  testID?: string
}

/**
 * Shared shell for the 12 federal/state officials-detail cards (slice 80,
 * audit C25 + U2-structural). Owns what every card hand-rolled before: the
 * card container, the h2 title, and the loading / error / empty branches,
 * with precedence **error > loading > empty > data**.
 *
 * Bg scheme locked per spec D1: shell = `semantic.bg.elevated`, rows =
 * `semantic.bg.app` (the federal scheme — cards as elevated surfaces above
 * the page, rows recessed to the page bg). The 5 state cards that used
 * `bg.app` shells change subtly in dark mode when they migrate — that IS
 * the drift fix (migration drift, not a Gotcha #15 intentional asymmetry).
 *
 * The error branch (audit U2) renders "Couldn't load this section." plus a
 * Retry affordance when `onRetry` is provided. Before this shell, cards
 * rendered their EMPTY state on query failure — which read as "this
 * official has no data" when the truth was "the request failed."
 *
 * S79 hydration constraint: callers must pass the hooks' `isLoading` (false
 * on first web render when the page dehydrated the query), never
 * `isFetching` — no loading-first flash may appear on hydrated pages.
 *
 * Slice-57 heading contract: the shell's title is the ONLY h2 per card;
 * in-card sub-headings stay h3 inside `children`; CardSubsection toggles
 * stay buttons.
 */
export function DetailCardShell({
  title,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyText,
  children,
  testID,
}: DetailCardShellProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const mutedStyle = [styles.muted, { color: semantic.text.muted }]

  let body: ReactNode
  if (isError) {
    body = (
      <View style={styles.errorWrap}>
        <Text style={mutedStyle}>Couldn&apos;t load this section.</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={[styles.retry, { color: semantic.accent.primary }]}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    )
  } else if (isLoading) {
    body = <Text style={mutedStyle}>Loading…</Text>
  } else if (isEmpty) {
    body = <Text style={[styles.empty, { color: semantic.text.muted }]}>{emptyText}</Text>
  } else {
    body = children
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
      ]}
      testID={testID}
    >
      <Text
        style={[styles.title, { color: semantic.text.primary }]}
        accessibilityRole="header"
        accessibilityLevel={2}
      >
        {title}
      </Text>
      {body}
    </View>
  )
}

// Container + title + muted/empty values copied from the pre-shell
// hand-rolled cards (e.g. FederalCommunityPresenceCard) so migrated cards
// render pixel-identical; Retry mirrors the OfficialsList error affordance.
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  muted: { fontSize: 13 },
  empty: { fontSize: 13, fontStyle: 'italic' },
  errorWrap: { gap: 8 },
  retry: { fontWeight: '600' },
})
