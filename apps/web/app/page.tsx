import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyProfile } from '@chiaro/profile'
import { redirect } from 'next/navigation'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCardClient } from './OfficialsCardClient'

export default async function Home(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const profile = await getMyProfile(supabase)

  return (
    <main>
      <h1>Chiaro</h1>
      {profile?.completed ? (
        <p>Welcome, {profile.display_name} (@{profile.username})</p>
      ) : (
        <p><a href="/profile/edit">Complete your profile</a></p>
      )}
      <form action="/sign-out" method="post">
        <button type="submit">Sign out</button>
      </form>
      <DistrictPanel />
      <OfficialsCardClient />
    </main>
  )
}
