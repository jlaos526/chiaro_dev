'use client'

import { useRouter } from 'next/navigation'
import { MyIssuesCard, useChiaroClient } from '@chiaro/officials-ui'
import { useMySelections, useIssueCatalog } from '@chiaro/issues'

/** Home-page preview of the user's issue priorities. Fetches saved selections +
 *  the catalog via the context client and deep-links into the `/issues` flow. */
export function MyIssuesCardClient(): React.JSX.Element {
  const router = useRouter()
  const client = useChiaroClient()
  const { data: selections = [] } = useMySelections(client)
  const { data: catalog = [] } = useIssueCatalog(client)
  return (
    <MyIssuesCard
      selections={selections}
      catalog={catalog}
      onEdit={() => router.push('/issues')}
    />
  )
}
