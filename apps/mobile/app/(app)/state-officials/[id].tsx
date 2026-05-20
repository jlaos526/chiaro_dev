import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from 'react-native'
import { useLocalSearchParams, Redirect } from 'expo-router'
import { useOfficial, useOfficialDistrictOffices, isStateLevel } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'

export default function StateOfficialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const officialId = id ?? ''
  const officialQ = useOfficial(supabase, officialId)
  const officesQ = useOfficialDistrictOffices(supabase, officialId)

  if (officialQ.isLoading) return <Text>Loading…</Text>
  if (!officialQ.data) return <Text>Not found</Text>

  // Cross-route guard: federal IDs land on /officials/[id]
  if (!isStateLevel(officialQ.data.chamber)) {
    return <Redirect href={`/officials/${officialId}` as never} />
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <StateOfficialDetailPage official={officialQ.data} offices={officesQ.data ?? []} />
    </SafeAreaView>
  )
}
