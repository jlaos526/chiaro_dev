'use client'

import { useRouter } from 'next/navigation'
import { BioHeader, type BioHeaderProps } from '@chiaro/officials-ui'

/** Client-component wrapper that supplies a router-bound chip-press handler
 * to the shared @chiaro/officials-ui BioHeader. Chip taps deep-link into the
 * Issue Positions sub-cascade for the federal officials detail page. */
export function BioHeaderClient(
  props: Omit<BioHeaderProps, 'onChipPress' | 'chipHref'>,
): React.JSX.Element {
  const router = useRouter()
  return (
    <BioHeader
      {...props}
      onChipPress={(chip) =>
        router.push(`/officials/${props.officialId}#issue-positions:${chip.subCascadeSlug}`)
      }
      chipHref={(chip) => `/officials/${props.officialId}#issue-positions:${chip.subCascadeSlug}`}
    />
  )
}
