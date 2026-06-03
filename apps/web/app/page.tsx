import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyProfile } from '@chiaro/profile'
import { redirect } from 'next/navigation'
import {
  BrandPageScreen,
  BrandHeading,
  BrandAlert,
  BrandLink,
  Logo,
} from '@chiaro/officials-ui'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCardClient } from './OfficialsCardClient'
import { MyIssuesCardClient } from './MyIssuesCardClient'

export default async function Home(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const profile = await getMyProfile(supabase)

  const greetingName = profile?.display_name ?? profile?.username ?? null
  const greeting = greetingName ? `Welcome, ${greetingName}` : 'Welcome'

  return (
    <BrandPageScreen>
      <Logo variant="lockup" size={24} wordmarkSize={28} />
      <BrandHeading level={1}>{greeting}</BrandHeading>
      {!profile?.completed ? (
        <BrandAlert severity="info" title="Complete your profile">
          <BrandLink href="/profile/edit">Add your display name and username →</BrandLink>
        </BrandAlert>
      ) : null}
      <DistrictPanel />
      <OfficialsCardClient />
      <MyIssuesCardClient />
    </BrandPageScreen>
  )
}
