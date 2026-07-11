import { Platform } from 'react-native'
import { BRAND_TYPE_FAMILY, BRAND_TYPE_FAMILY_WEB } from '@chiaro/ui-tokens'

/**
 * Font stack for the brand primitives (slice 70, audit C6-partial). On web
 * this resolves through the `--font-inter` CSS variable so the next/font
 * self-hosted Inter actually renders (a plain 'Inter' string only matches a
 * locally-installed font). Native keeps the plain family list — var() is not
 * parseable there. Threading Inter into general RNW <Text> (cards, lists) is
 * the S80 remainder; only the 3 Inter-first primitives consume this today.
 */
export const PRIMITIVE_FONT_FAMILY: string =
  Platform.OS === 'web' ? BRAND_TYPE_FAMILY_WEB : BRAND_TYPE_FAMILY
