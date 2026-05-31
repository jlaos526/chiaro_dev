import { Drawer } from 'expo-router/drawer'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyProfile } from '@chiaro/profile'
import {
  BrandPageScreen,
  BrandHeading,
  BrandAlert,
  BrandLink,
  Logo,
  OfficialsCard,
} from '@chiaro/officials-ui'
import { DistrictPanel } from '@/components/DistrictPanel'

type Profile = Awaited<ReturnType<typeof getMyProfile>>

export default function Home() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    getMyProfile(supabase).then((p) => {
      if (mounted) {
        setProfile(p)
        setLoaded(true)
      }
    })
    return () => { mounted = false }
  }, [])

  const greetingName = profile?.display_name ?? profile?.username ?? null
  const greeting = greetingName ? `Welcome, ${greetingName}` : 'Welcome'

  return (
    <>
      <Drawer.Screen options={{ title: 'Home' }} />
      {loaded ? (
        <BrandPageScreen>
          <Logo variant="lockup" size={24} wordmarkSize={28} />
          <BrandHeading level={1}>{greeting}</BrandHeading>
          {!profile?.completed ? (
            <BrandAlert severity="info" title="Complete your profile">
              <BrandLink
                href="/profile/edit"
                onPress={() => router.push('/profile/edit' as never)}
              >
                Add your display name and username →
              </BrandLink>
            </BrandAlert>
          ) : null}
          <DistrictPanel />
          <OfficialsCard
            onSelect={({ officialId, subCascadeSlug }) =>
              router.push(
                (subCascadeSlug
                  ? `/officials/${officialId}?cat=issue-positions&sub=${subCascadeSlug}`
                  : `/officials/${officialId}`) as never,
              )
            }
            onSeeAll={() => router.push('/officials' as never)}
            onCalibrate={() => router.push('/calibrate' as never)}
          />
        </BrandPageScreen>
      ) : null}
    </>
  )
}
