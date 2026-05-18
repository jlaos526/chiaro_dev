import { View, Text, Pressable, Linking } from 'react-native'

export interface BioContactLinksProps {
  officialUrl: string | null
  twitterHandle: string | null
}

export function BioContactLinks({ officialUrl, twitterHandle }: BioContactLinksProps) {
  if (!officialUrl && !twitterHandle) return null

  const linkStyle = { fontSize: 12, color: '#3b6ed1' }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {officialUrl ? (
        <Pressable onPress={() => Linking.openURL(officialUrl).catch(() => {})}>
          <Text style={linkStyle}>{officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
        </Pressable>
      ) : null}
      {officialUrl && twitterHandle ? <Text style={{ color: '#d8d4c9' }}>·</Text> : null}
      {twitterHandle ? (
        <Pressable onPress={() => Linking.openURL(`https://twitter.com/${twitterHandle}`).catch(() => {})}>
          <Text style={linkStyle}>@{twitterHandle}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
