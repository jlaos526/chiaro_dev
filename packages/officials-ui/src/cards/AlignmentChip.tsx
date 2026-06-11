import { createElement } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { type AlignmentTier } from '@chiaro/ui-tokens'
import { useAlignmentChipColors } from '../brand-hooks.ts'
import { SmartAnchor } from '../primitives/SmartAnchor.tsx'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  /**
   * Web: rendered as `href` on a real `<a>` element. Preserves
   * middle-click / Cmd-click / Ctrl-click → "open in new tab",
   * status-bar URL preview, link prefetch, and browser history.
   * Native: ignored.
   */
  href?: string
  /**
   * Click handler. On web with `href` present, called via the
   * smart-anchor pattern: plain left-clicks `e.preventDefault()` +
   * dispatch to `onPress` (for client-side router.push); modifier-key
   * clicks (Cmd / Ctrl / Shift / middle-click) fall through to the
   * browser default.
   *
   * On native or web-without-href, called directly via `Pressable.onPress`.
   *
   * When both `href` and `onPress` are omitted, chip renders inert.
   */
  onPress?: () => void
}

export function AlignmentChip({
  label, tier, href, onPress,
}: AlignmentChipProps): React.JSX.Element {
  const { bg, fg } = useAlignmentChipColors(tier)
  const chipStyle = {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: bg,
    alignSelf: 'flex-start' as const,
  }
  const textStyle = {
    fontSize: 12,
    fontWeight: '500' as const,
    color: fg,
    lineHeight: 17,
  }

  // Inert case: no nav target, no callback.
  if (!href && !onPress) {
    return (
      <View style={chipStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    )
  }

  // Web smart-anchor case (href + onPress): real <a href> with intercepted
  // plain left-click + modifier-key passthrough, via the shared primitive.
  if (Platform.OS === 'web' && href && onPress) {
    return (
      <SmartAnchor
        href={href}
        onPress={onPress}
        accessibilityLabel={`View ${label} positions`}
        style={{ ...chipStyle, display: 'inline-block', cursor: 'pointer' }}
      >
        {createElement('span', { style: textStyle }, label)}
      </SmartAnchor>
    )
  }

  // Web href WITHOUT onPress: a plain anchor so default browser nav (full page
  // load) handles the click — SmartAnchor always intercepts, so it isn't used
  // here.
  if (Platform.OS === 'web' && href) {
    return createElement(
      'a',
      {
        href,
        'aria-label': `View ${label} positions`,
        style: {
          ...chipStyle,
          display: 'inline-block',
          textDecoration: 'none',
          cursor: 'pointer',
        },
      },
      createElement('span', { style: textStyle }, label),
    )
  }

  // Native fallback (and web fallback when href is absent).
  // hitSlop bumps the ~23px-tall chip to a ≥44px effective touch target
  // (audit U5) with no visual change. The web smart-anchor branches above
  // are real <a> elements and don't take hitSlop.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`View ${label} positions`}
      hitSlop={{ top: 11, bottom: 11, left: 4, right: 4 }}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
