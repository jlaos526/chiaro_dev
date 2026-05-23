'use client'

import { useRouter } from 'next/navigation'
import { OfficialsCard } from '@chiaro/officials-ui'

/** Client-component wrapper that supplies router-bound callbacks to the
 * shared @chiaro/officials-ui OfficialsCard. Lives next to the home page
 * because that's the only consumer. */
export function OfficialsCardClient(): React.JSX.Element {
  const router = useRouter()
  return (
    <OfficialsCard
      onSelect={({ officialId, subCascadeSlug }) =>
        router.push(
          subCascadeSlug
            ? `/officials/${officialId}#issue-positions:${subCascadeSlug}`
            : `/officials/${officialId}`,
        )
      }
      onSeeAll={() => router.push('/officials')}
      onCalibrate={() => router.push('/calibrate')}
    />
  )
}
