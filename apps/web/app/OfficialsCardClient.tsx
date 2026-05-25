'use client'

import { useRouter } from 'next/navigation'
import { OfficialsCard } from '@chiaro/officials-ui'

/** Client-component wrapper that supplies router-bound callbacks to the
 * shared @chiaro/officials-ui OfficialsCard. Lives next to the home page
 * because that's the only consumer. Passes href builders so chips, official
 * names, and the See-all link render as real `<a href>` on web (smart-anchor
 * pattern from slice 14) while plain left-click stays SPA-client-side via
 * `router.push`. */
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
      chipHref={({ officialId, subCascadeSlug }) =>
        `/officials/${officialId}#issue-positions:${subCascadeSlug}`
      }
      rowHref={({ officialId }) => `/officials/${officialId}`}
      seeAllHref="/officials"
      calibrateHref="/calibrate"
      onSeeAll={() => router.push('/officials')}
      onCalibrate={() => router.push('/calibrate')}
    />
  )
}
