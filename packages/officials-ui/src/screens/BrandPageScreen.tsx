'use client'

import { Platform, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { WEB_VIEWPORT_FILL } from './_viewport-fill.ts'

export interface BrandPageScreenProps {
  /** Optional h1 page title via BrandHeading level={1}. Omit when the page body
   * anchors itself (e.g. home page uses Logo + greeting). */
  title?: string
  children: ReactNode
}

// Web: consume --chiaro-rail-width and --chiaro-rail-topbar CSS vars set by
// BrandNavRailMount so body content shifts right of the persistent desktop rail
// and below the fixed mobile top bar. Both default to 0 when unset.
const WEB_RAIL_AWARE_PADDING = Platform.OS === 'web'
  ? ({
      paddingLeft: 'calc(16px + var(--chiaro-rail-width, 0px))' as unknown as number,
      paddingTop: 'calc(24px + var(--chiaro-rail-topbar, 0px))' as unknown as number,
    })
  : null

/**
 * Generic page shell for list / landing / error pages. Consumed by `/`,
 * `/officials`, `/not-found`. Forms use BrandFormScreen instead.
 *
 * - Outer: brand bg.app + WEB_VIEWPORT_FILL + rail-aware left padding.
 * - Inner column: maxWidth 560 centred, vertical gap 24.
 * - Optional title renders as BrandHeading level={1} at top of column.
 */
export function BrandPageScreen({ title, children }: BrandPageScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      style={[
        styles.outer,
        { backgroundColor: semantic.bg.app },
        WEB_VIEWPORT_FILL,
        WEB_RAIL_AWARE_PADDING,
      ]}
    >
      <View style={styles.column}>
        {title ? <BrandHeading level={1}>{title}</BrandHeading> : null}
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    // paddingTop is overridden on web via WEB_RAIL_AWARE_PADDING to consume
    // --chiaro-rail-topbar (shifts content below the fixed mobile top bar).
    // Split from paddingVertical so the web override wins without clobbering
    // paddingBottom.
    paddingTop: 24,
    paddingBottom: 24,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    gap: 24,
  },
})
