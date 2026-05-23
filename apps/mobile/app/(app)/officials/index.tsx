import { ScrollView, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { OfficialsList } from '@chiaro/officials-ui'

export default function OfficialsScreen() {
  const router = useRouter()
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12 }}>Your officials</Text>
      <OfficialsList
        onSelect={({ officialId }) => router.push(`/officials/${officialId}`)}
        onCalibrate={() => router.push('/calibrate')}
      />
    </ScrollView>
  )
}
