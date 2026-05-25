'use client'

import { useRouter } from 'next/navigation'
import { OfficialsList } from '@chiaro/officials-ui'

/** Client-component wrapper that supplies router-bound callbacks to the
 * shared @chiaro/officials-ui OfficialsList. Passes href builders so each
 * link renders as a real `<a href>` on web (smart-anchor pattern from
 * slice 14: middle-click → new tab, prefetch, status-bar URL, etc.) while
 * plain left-click stays SPA-client-side via `router.push`. */
export function OfficialsListClient(): React.JSX.Element {
  const router = useRouter()
  return (
    <OfficialsList
      onSelect={({ officialId }) => router.push(`/officials/${officialId}`)}
      onCalibrate={() => router.push('/calibrate')}
      getHref={({ officialId }) => `/officials/${officialId}`}
      calibrateHref="/calibrate"
    />
  )
}
