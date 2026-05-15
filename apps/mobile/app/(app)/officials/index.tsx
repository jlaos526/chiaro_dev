import { ScrollView, Text } from 'react-native'
import { OfficialsList } from '@/components/OfficialsList'

export default function OfficialsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12 }}>Your officials</Text>
      <OfficialsList />
    </ScrollView>
  )
}
