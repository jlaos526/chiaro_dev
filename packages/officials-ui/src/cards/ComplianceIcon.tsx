import { Text, View } from 'react-native'

export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

const STYLES = {
  'on-time': { bg: '#c5e3c7', fg: '#1f4d24', glyph: '✓', label: 'Filed on time' },
  'late':    { bg: '#f4d3c0', fg: '#7a3e1c', glyph: '✖', label: 'Late filing' }, // ✖ = U+2716
} as const

export function ComplianceIcon({ state }: ComplianceIconProps): React.JSX.Element {
  const { bg, fg, glyph, label } = STYLES[state]
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{glyph}</Text>
    </View>
  )
}
