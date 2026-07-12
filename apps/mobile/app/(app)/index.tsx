import { Drawer } from 'expo-router/drawer'
import { useCallback, useState } from 'react'
import { RefreshControl } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useMyProfile } from '@chiaro/profile'
import {
  BrandPageScreen,
  BrandHeading,
  BrandAlert,
  BrandLink,
  Logo,
  OfficialsCard,
  MyIssuesCard,
} from '@chiaro/officials-ui'
import { useMySelections, useIssueCatalog } from '@chiaro/issues'
import { DistrictPanel } from '@/components/DistrictPanel'

export default function Home() {
  const router = useRouter()
  // C15: profile is now a TanStack query — no render gate. `profile` is
  // undefined until the first fetch resolves; the greeting falls back to
  // 'Welcome' and the completion alert is guarded on profile being defined so
  // it doesn't flash during the brief undefined window.
  const { data: profile } = useMyProfile(supabase)

  const { data: issueSelections = [] } = useMySelections(supabase)
  const { data: issueCatalog = [] } = useIssueCatalog(supabase)

  // Pull-to-refresh (audit U2-rider): broad invalidation is acceptable v1.
  // Profile is now a query, so invalidateQueries re-fetches it too.
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

  const greetingName = profile?.display_name ?? profile?.username ?? null
  const greeting = greetingName ? `Welcome, ${greetingName}` : 'Welcome'

  return (
    <>
      <Drawer.Screen options={{ title: 'Home' }} />
      <BrandPageScreen
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Logo variant="lockup" size={24} wordmarkSize={28} />
        <BrandHeading level={1}>{greeting}</BrandHeading>
        {profile && !profile.completed ? (
          <BrandAlert severity="info" title="Complete your profile">
            <BrandLink href="/profile/edit" onPress={() => router.push('/profile/edit')}>
              Add your display name and username →
            </BrandLink>
          </BrandAlert>
        ) : null}
        <DistrictPanel />
        <OfficialsCard
          onSelect={({ officialId, subCascadeSlug }) =>
            router.push(
              subCascadeSlug
                ? `/officials/${officialId}?cat=issue-positions&sub=${subCascadeSlug}`
                : `/officials/${officialId}`,
            )
          }
          onSeeAll={() => router.push('/officials')}
          onCalibrate={() => router.push('/calibrate')}
        />
        <MyIssuesCard
          selections={issueSelections}
          catalog={issueCatalog}
          onEdit={() => router.push('/issues')}
        />
      </BrandPageScreen>
    </>
  )
}
