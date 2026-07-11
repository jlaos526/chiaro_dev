import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BrandPageScreen } from '@chiaro/officials-ui'
import { OfficialsListClient } from './OfficialsListClient'

export default async function OfficialsPage(): Promise<React.JSX.Element> {
  const { user } = await getAuthenticatedUser()
  if (!user) redirect('/sign-in')
  return (
    <BrandPageScreen title="Your officials">
      <OfficialsListClient />
    </BrandPageScreen>
  )
}
