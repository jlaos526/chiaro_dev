import { Image, Text, View } from 'react-native'
import { useBrandTokens } from './brand-hooks.ts'

export interface OfficialAvatarProps {
  fullName: string
  portraitUrl?: string | null
  size?: number
}

export function OfficialAvatar({
  fullName,
  portraitUrl,
  size = 64,
}: OfficialAvatarProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  if (portraitUrl) {
    return (
      <Image
        source={{ uri: portraitUrl }}
        accessibilityLabel={fullName}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={fullName}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: semantic.bg.app,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: semantic.text.primary, fontWeight: '600', fontSize: size * 0.32 }}>
        {initials}
      </Text>
    </View>
  )
}
