'use client'

import { useRouter } from 'next/navigation'
import { StateOfficialDetailPage, type StateOfficialDetailPageProps } from '@chiaro/officials-ui'

/** Client wrapper injecting a router-bound `/issues` nav callback into the
 *  shared StateOfficialDetailPage (which renders the rep alignment strip). */
export function StateOfficialDetailClient(
  props: Omit<
    StateOfficialDetailPageProps,
    'onSetupIssues' | 'setupIssuesHref' | 'onSetupIssuesPrefetch'
  >,
): React.JSX.Element {
  const router = useRouter()
  return (
    <StateOfficialDetailPage
      {...props}
      onSetupIssues={() => router.push('/issues')}
      setupIssuesHref="/issues"
      onSetupIssuesPrefetch={() => router.prefetch('/issues')}
    />
  )
}
