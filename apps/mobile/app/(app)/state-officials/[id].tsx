import { Drawer } from 'expo-router/drawer'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from 'react-native'
import { useLocalSearchParams, Redirect } from 'expo-router'
import { useOfficial, useOfficialDistrictOffices, isStateLevel } from '@chiaro/officials'
import { StateOfficialDetailPage } from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'
import { supabase } from '@/lib/supabase'

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
    <>
      <Drawer.Screen
        options={{
          title: 'State official',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>
        <StateOfficialDetailPage official={officialQ.data} offices={officesQ.data ?? []} />
      </SafeAreaView>
    </>
  )
}
