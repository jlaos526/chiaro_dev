import { Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BioServiceCardProps {
  role: string
  firstElectedYear: number | null
}

export function BioServiceCard({ role, firstElectedYear }: BioServiceCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: semantic.bg.subtle,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignSelf: 'center',
      }}
    >
      <Text style={{ fontSize: 11, textTransform: 'uppercase', color: semantic.text.muted, letterSpacing: 0.5 }}>
        CURRENT ROLE
      </Text>
      <View style={{ backgroundColor: semantic.text.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
        <Text style={{ color: semantic.bg.elevated, fontSize: 12, fontWeight: '600' }}>{role}</Text>
      </View>
      {firstElectedYear != null ? (
        <Text style={{ fontSize: 12, color: semantic.text.muted }}>· Since {firstElectedYear}</Text>
      ) : null}
    </View>
  )
}
