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
  // Slice 79.5 (audit U4): state rows route to their own detail page.
  const pathFor = ({ officialId, level }: { officialId: string; level: 'federal' | 'state' }) =>
    level === 'state' ? `/state-officials/${officialId}` : `/officials/${officialId}`
  return (
    <OfficialsList
      onSelect={(target) => router.push(pathFor(target))}
      onCalibrate={() => router.push('/calibrate')}
      getHref={pathFor}
      calibrateHref="/calibrate"
    />
  )
}
