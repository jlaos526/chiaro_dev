import { useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import { OfficialDetail } from '@/components/OfficialDetail'

export default function OfficialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <OfficialDetail id={id ?? ''} />
    </ScrollView>
  )
}
