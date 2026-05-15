import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyProfile } from '@chiaro/profile'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCard } from '@/components/OfficialsCard'

type Profile = Awaited<ReturnType<typeof getMyProfile>>

export default function Home() {
  const [profile, setProfile] = useState<Profile>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getMyProfile(supabase).then((p) => {
      if (mounted) {
        setProfile(p)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  if (loading) return <View style={{ padding: 24 }}><Text>Loading…</Text></View>

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24 }}>Chiaro</Text>
      {profile?.completed ? (
        <Text>Welcome, {profile.display_name} (@{profile.username})</Text>
      ) : (
        <Link href="/(app)/profile/edit">Complete your profile</Link>
      )}
      <DistrictPanel />
      <OfficialsCard />
      <Link href="/settings">Settings</Link>
    </View>
  )
}
