'use client'

import { useRouter } from 'next/navigation'
import { RepAlignmentSection } from '@chiaro/officials-ui'

/** Client wrapper supplying a router-bound `/issues` nav callback to the shared
 *  RepAlignmentSection on the federal officials detail page. */
export function RepAlignmentSectionClient({
  officialId,
  repName,
}: {
  officialId: string
  repName?: string
}): React.JSX.Element {
  const router = useRouter()
  return (
    <RepAlignmentSection
      officialId={officialId}
      {...(repName ? { repName } : {})}
      onSetup={() => router.push('/issues')}
    />
  )
}
