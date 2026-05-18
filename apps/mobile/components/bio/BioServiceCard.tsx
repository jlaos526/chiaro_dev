import { View, Text } from 'react-native'

export interface BioServiceCardProps {
  role: string
  firstElectedYear: number | null
}

export function BioServiceCard({ role, firstElectedYear }: BioServiceCardProps) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#f0eee5', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6,
        alignSelf: 'center',
      }}
    >
      <Text style={{ fontSize: 11, textTransform: 'uppercase', color: '#807a72', letterSpacing: 0.5 }}>
        CURRENT ROLE
      </Text>
      <View style={{ backgroundColor: '#1a1714', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{role}</Text>
      </View>
      {firstElectedYear != null ? (
        <Text style={{ fontSize: 12, color: '#5a5751' }}>· Since {firstElectedYear}</Text>
      ) : null}
    </View>
  )
}
