import { createElement } from 'react'
import { Linking, Platform, Pressable, Text, View } from 'react-native'

export interface BioContactLinksProps {
  officialUrl: string | null
  twitterHandle: string | null
  /**
   * Web: rendered as `href` on a real `<a>` element for the official URL.
   * Preserves middle-click / Cmd-click / Ctrl-click → "open in new tab",
   * status-bar URL preview, browser history. Native: ignored.
   * Defaults to `officialUrl` when omitted.
   */
  officialHref?: string
  /**
   * Web: rendered as `href` on a real `<a>` element for the twitter handle.
   * Preserves middle-click / Cmd-click / etc. Native: ignored.
   * Defaults to `https://twitter.com/${twitterHandle}` when omitted.
   */
  twitterHref?: string
}

const linkStyle = { fontSize: 12, color: '#3b6ed1' as const }

function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {})
}

interface SmartLinkProps {
  href: string
  onPress: () => void
  children: React.ReactNode
}

function SmartLink({ href, onPress, children }: SmartLinkProps): React.JSX.Element {
  // Web smart-anchor case: real <a href> with intercepted plain left-click.
  if (Platform.OS === 'web') {
    return createElement(
      'a',
      {
        href,
        onClick: (e: MouseEvent) => {
          // Honor modifier-key + middle-click → browser default (new tab etc.).
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          onPress()
        },
        style: {
          textDecoration: 'none',
          cursor: 'pointer',
          display: 'inline-block',
        },
      },
      children,
    )
  }

  // Native fallback.
  return (
    <Pressable accessibilityRole="link" onPress={onPress}>
      {children}
    </Pressable>
  )
}

export function BioContactLinks({
  officialUrl,
  twitterHandle,
  officialHref,
  twitterHref,
}: BioContactLinksProps): React.JSX.Element | null {
  if (!officialUrl && !twitterHandle) return null

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {officialUrl ? (
        <SmartLink
          href={officialHref ?? officialUrl}
          onPress={() => openUrl(officialUrl)}
        >
          <Text style={linkStyle}>{officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
        </SmartLink>
      ) : null}
      {officialUrl && twitterHandle ? <Text style={{ color: '#d8d4c9' }}>·</Text> : null}
      {twitterHandle ? (
        <SmartLink
          href={twitterHref ?? `https://twitter.com/${twitterHandle}`}
          onPress={() => openUrl(`https://twitter.com/${twitterHandle}`)}
        >
          <Text style={linkStyle}>@{twitterHandle}</Text>
        </SmartLink>
      ) : null}
    </View>
  )
}
