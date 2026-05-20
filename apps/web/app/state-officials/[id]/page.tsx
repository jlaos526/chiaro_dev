import { redirect } from 'next/navigation'
import { fetchOfficial, fetchOfficialDistrictOffices, isStateLevel } from '@chiaro/officials'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'

interface Params { id: string }

export default async function StateOfficialPage(
  { params }: { params: Promise<Params> },
): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const official = await fetchOfficial(supabase, id)
  // Cross-route guard: federal IDs land on /officials/[id]
  if (!isStateLevel(official.chamber)) {
    redirect(`/officials/${id}`)
  }

  const offices = await fetchOfficialDistrictOffices(supabase, id)
  return <StateOfficialDetailPage official={official} offices={offices} />
}
