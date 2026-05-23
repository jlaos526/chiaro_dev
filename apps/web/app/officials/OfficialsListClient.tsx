'use client'

import { useRouter } from 'next/navigation'
import { OfficialsList } from '@chiaro/officials-ui'

/** Client-component wrapper that supplies router-bound callbacks to the
 * shared @chiaro/officials-ui OfficialsList. */
export function OfficialsListClient(): React.JSX.Element {
  const router = useRouter()
  return (
    <OfficialsList
      onSelect={({ officialId }) => router.push(`/officials/${officialId}`)}
      onCalibrate={() => router.push('/calibrate')}
    />
  )
}
