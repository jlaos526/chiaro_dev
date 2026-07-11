import { redirect } from 'next/navigation'
import { fetchOfficial, fetchOfficialDistrictOffices, isStateLevel } from '@chiaro/officials'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { StateOfficialDetailClient } from './StateOfficialDetailClient'

interface Params {
  id: string
}

export default async function StateOfficialPage({
  params,
}: {
  params: Promise<Params>
}): Promise<React.JSX.Element> {
  const { id } = await params
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) redirect('/sign-in')

  let official
  try {
    official = await fetchOfficial(supabase, id)
  } catch {
    redirect('/')
  }
  // Cross-route guard: federal IDs land on /officials/[id]
  if (!isStateLevel(official.chamber)) {
    redirect(`/officials/${id}`)
  }

  const offices = await fetchOfficialDistrictOffices(supabase, id)
  return <StateOfficialDetailClient official={official} offices={offices} />
}
