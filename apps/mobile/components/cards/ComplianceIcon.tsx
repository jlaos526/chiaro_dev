import { View, Text } from 'react-native'

export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

export function ComplianceIcon({ state }: ComplianceIconProps) {
  const onTime = state === 'on-time'
  return (
    <View
      style={{
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: onTime ? '#c5e3c7' : '#f4d3c0',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: onTime ? '#1f4d24' : '#7a3e1c', fontSize: 11, fontWeight: '700' }}>
        {onTime ? '✓' : '✖'}
      </Text>
    </View>
  )
}
