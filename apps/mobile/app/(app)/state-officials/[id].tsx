import { Drawer } from 'expo-router/drawer'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RefreshControl, Text } from 'react-native'
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, Redirect, useRouter } from 'expo-router'
import { useOfficial, useOfficialDistrictOffices, isStateLevel } from '@chiaro/officials'
import { StateOfficialDetailPage, useBrandTokens } from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'
import { supabase } from '@/lib/supabase'

export default function StateOfficialDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const officialId = id ?? ''
  const officialQ = useOfficial(supabase, officialId)
  const officesQ = useOfficialDistrictOffices(supabase, officialId)
  const { semantic } = useBrandTokens()

  // Pull-to-refresh (audit U2-rider): broad invalidation is acceptable v1.
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries()
    } finally {
      setRefreshing(false)
    }
  }, [queryClient])

  // Audit U3: loading / not-found branches render inside the same SafeAreaView
  // + brand-bg + header shell as the loaded branch (were bare <Text> under the
  // notch, unreadable in dark mode, with no way to navigate back).
  const statusShell = (message: string) => (
    <>
      <Drawer.Screen
        options={{
          title: 'State official',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: semantic.bg.app }}>
        <Text style={{ padding: 16, color: semantic.text.muted }}>{message}</Text>
      </SafeAreaView>
    </>
  )

  if (officialQ.isLoading) return statusShell('Loading…')
  if (!officialQ.data) return statusShell('Not found')

  // Cross-route guard: federal IDs land on /officials/[id]
  if (!isStateLevel(officialQ.data.chamber)) {
    return <Redirect href={`/officials/${officialId}`} />
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
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: semantic.bg.app }}>
        <StateOfficialDetailPage
          official={officialQ.data}
          offices={officesQ.data ?? []}
          onSetupIssues={() => router.push('/issues')}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </SafeAreaView>
    </>
  )
}
