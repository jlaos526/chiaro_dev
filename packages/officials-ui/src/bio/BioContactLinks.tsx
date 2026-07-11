import { Linking, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SmartAnchor } from '../primitives/SmartAnchor.tsx'

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

function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {})
}

const LINK_ANCHOR_STYLE = { cursor: 'pointer', display: 'inline-block' } as const

export function BioContactLinks({
  officialUrl,
  twitterHandle,
  officialHref,
  twitterHref,
}: BioContactLinksProps): React.JSX.Element | null {
  const { semantic } = useBrandTokens()
  const linkStyle = { fontSize: 12, color: semantic.link.fg } as const
  if (!officialUrl && !twitterHandle) return null

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {officialUrl ? (
        <SmartAnchor
          href={officialHref ?? officialUrl}
          onPress={() => openUrl(officialUrl)}
          style={LINK_ANCHOR_STYLE}
        >
          <Text style={linkStyle}>
            {officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </Text>
        </SmartAnchor>
      ) : null}
      {officialUrl && twitterHandle ? (
        <Text style={{ color: semantic.border.default }}>·</Text>
      ) : null}
      {twitterHandle ? (
        <SmartAnchor
          href={twitterHref ?? `https://twitter.com/${twitterHandle}`}
          onPress={() => openUrl(`https://twitter.com/${twitterHandle}`)}
          style={LINK_ANCHOR_STYLE}
        >
          <Text style={linkStyle}>@{twitterHandle}</Text>
        </SmartAnchor>
      ) : null}
    </View>
  )
}
