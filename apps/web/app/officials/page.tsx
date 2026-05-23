import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OfficialsListClient } from './OfficialsListClient'

export default async function OfficialsPage(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return (
    <main>
      <h1>Your officials</h1>
      <OfficialsListClient />
    </main>
  )
}
