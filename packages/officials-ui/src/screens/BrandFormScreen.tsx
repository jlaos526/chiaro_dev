'use client'

import { Platform, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandLink } from '../primitives/BrandLink.tsx'
import { WEB_VIEWPORT_FILL } from './_viewport-fill.ts'
import { NativeFormShell } from './_native-form-shell.tsx'

export interface BrandFormScreenProps {
  /** Required h1 page title. */
  title: string
  /** Optional muted subtitle rendered below the title. */
  subtitle?: string
  /** Optional back link href. When set, also requires backLabel. */
  backHref?: string
  /** Visible label for the back link (e.g. "← Settings"). */
  backLabel?: string
  /** Form content rendered inside the card. */
  children: ReactNode
}

const WEB_RAIL_AWARE_PADDING =
  Platform.OS === 'web'
    ? {
        paddingLeft: 'calc(16px + var(--chiaro-rail-width, 0px))' as unknown as number,
        paddingTop: 'calc(24px + var(--chiaro-rail-topbar, 0px))' as unknown as number,
      }
    : null

/**
 * Centered-card form shell. Consumed by `/profile/edit`, `/settings/address`.
 * Use BrandPageScreen for list / landing pages instead.
 *
 * - Outer: brand bg.app + WEB_VIEWPORT_FILL + rail-aware left padding + vertical center.
 * - Card: maxWidth 400, bg.elevated, borderRadius 16, padding 30/24, soft shadow.
 * - Composition: optional back link, h1 title, optional muted subtitle, form children.
 * - No wordmark/logo (those belong to AuthScreen, which is pre-auth).
 */
export function BrandFormScreen({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: BrandFormScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const card = (
    <View style={[styles.card, { backgroundColor: semantic.bg.elevated }]}>
      {backHref && backLabel ? (
        <View style={styles.backLinkWrap}>
          <BrandLink href={backHref}>{backLabel}</BrandLink>
        </View>
      ) : null}
      <BrandHeading level={1}>{title}</BrandHeading>
      {subtitle ? (
        <View style={styles.subtitleWrap}>
          <BrandBodyText size="sm" muted>
            {subtitle}
          </BrandBodyText>
        </View>
      ) : null}
      <View style={styles.formChildrenWrap}>{children}</View>
    </View>
  )

  // Native: scroll + keyboard avoidance for the centered form card
  // (audit U0/C8 + U5). Web keeps the plain-View path byte-identical below.
  if (Platform.OS !== 'web') {
    return <NativeFormShell backgroundColor={semantic.bg.app}>{card}</NativeFormShell>
  }

  return (
    <View
      style={[
        styles.outer,
        { backgroundColor: semantic.bg.app },
        WEB_VIEWPORT_FILL,
        WEB_RAIL_AWARE_PADDING,
      ]}
    >
      {card}
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    // paddingTop overridden on web via WEB_RAIL_AWARE_PADDING to consume
    // --chiaro-rail-topbar. Split from paddingVertical to avoid clobbering
    // paddingBottom.
    paddingTop: 24,
    paddingBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  backLinkWrap: { marginBottom: 12 },
  subtitleWrap: { marginTop: 4 },
  formChildrenWrap: { marginTop: 18, gap: 14 },
})
