import { Image, Text, View } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

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
        backgroundColor: COLORS.neutral.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: COLORS.brand.text, fontWeight: '600', fontSize: size * 0.32 }}>
        {initials}
      </Text>
    </View>
  )
}
