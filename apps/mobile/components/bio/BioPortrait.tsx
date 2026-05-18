import { Text, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

export interface BioPortraitProps {
  fullName: string
  portraitUrl: string | null
  size: number
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0] ?? ''
  if (words.length === 1) return first.charAt(0).toUpperCase()
  const last = words[words.length - 1] ?? ''
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

export function BioPortrait({ fullName, portraitUrl, size }: BioPortraitProps) {
  if (portraitUrl) {
    return (
      <Image
        source={{ uri: portraitUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={`${fullName} portrait`}
      />
    )
  }
  return (
    <LinearGradient
      colors={['#3b6ed1', '#5b8de1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text
        accessibilityLabel={`${fullName} portrait (initials)`}
        style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.42 }}
      >
        {initials(fullName)}
      </Text>
    </LinearGradient>
  )
}
