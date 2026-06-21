import { Text, View } from 'react-native'
import { useBrandTokens } from './brand-hooks.ts'
import { useBrandImage } from './image-context.tsx'

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
  const Img = useBrandImage()
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  if (portraitUrl) {
    return (
      <Img
        uri={portraitUrl}
        size={size}
        borderRadius={size / 2}
        accessibilityLabel={fullName}
        recyclingKey={portraitUrl}
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
