import { Linking, Pressable, Text, View } from 'react-native'

export interface BioContactLinksProps {
  officialUrl: string | null
  twitterHandle: string | null
}

const linkStyle = { fontSize: 12, color: '#3b6ed1' as const }

function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {})
}

export function BioContactLinks({
  officialUrl,
  twitterHandle,
}: BioContactLinksProps): React.JSX.Element | null {
  if (!officialUrl && !twitterHandle) return null

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {officialUrl ? (
        <Pressable accessibilityRole="link" onPress={() => openUrl(officialUrl)}>
          <Text style={linkStyle}>{officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
        </Pressable>
      ) : null}
      {officialUrl && twitterHandle ? <Text style={{ color: '#d8d4c9' }}>·</Text> : null}
      {twitterHandle ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => openUrl(`https://twitter.com/${twitterHandle}`)}
        >
          <Text style={linkStyle}>@{twitterHandle}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
