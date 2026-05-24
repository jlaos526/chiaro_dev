import { createElement } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

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
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
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

  // Web smart-anchor case: real <a href> with intercepted plain left-click.
  if (Platform.OS === 'web' && href) {
    return createElement(
      'a',
      {
        href,
        onClick: (e: MouseEvent) => {
          // Honor modifier-key + middle-click → browser default (new tab etc.).
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          if (onPress) {
            e.preventDefault()
            onPress()
          }
          // If onPress is absent, default browser nav (full page load) handles it.
        },
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`View ${label} positions`}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
