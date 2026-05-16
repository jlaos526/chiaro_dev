import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OfficialDetail } from '@/components/OfficialDetail'
import { OfficialPerformance } from '@/components/OfficialPerformance'

interface Params { id: string }

export default async function OfficialPage(
  { params }: { params: Promise<Params> },
): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return (
    <main>
      <OfficialDetail id={id} />
      <OfficialPerformance officialId={id} />
    </main>
  )
}
