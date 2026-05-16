import { useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import { OfficialDetail } from '@/components/OfficialDetail'
import { OfficialPerformance } from '@/components/OfficialPerformance'

export default function OfficialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const officialId = id ?? ''
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <OfficialDetail id={officialId} />
      {officialId ? <OfficialPerformance officialId={officialId} /> : null}
    </ScrollView>
  )
}
