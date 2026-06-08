'use client'

import { useState } from 'react'
import { View } from 'react-native'
import { useRepAlignment, useMySelections } from '@chiaro/issues'
import { useChiaroClient } from '../client-context.tsx'
import { RepAlignmentStrip } from './RepAlignmentStrip.tsx'
import { IssueRadarOverlay } from './IssueRadarOverlay.tsx'

export interface RepAlignmentSectionProps {
  /** The rep whose per-issue alignment to show. */
  officialId: string
  /** Rep display name, for the expanded overlay caption. */
  repName?: string
  /** Navigate into the `/issues` flow (the strip's CTA + empty-state). */
  onSetup: () => void
  /**
   * Web: `href` for the strip's setup CTA so it renders a real `<a>` (preserves
   * middle-click → new tab etc.). Plain left-click still routes via `onSetup`.
   * Omitted on native → the strip's `<Pressable>` CTA.
   */
  setupHref?: string
}

/**
 * Container that wires the rep-page alignment strip to data + navigation.
 *
 * Fetches the caller's per-rep alignment (`useRepAlignment`) + whether they
 * have any selections at all (`useMySelections`) via the context client, owns
 * the overlay open/closed state, and renders {@link RepAlignmentStrip} plus the
 * expandable {@link IssueRadarOverlay}. Navigation stays app-side via the
 * `onSetup` callback (slice-10 callback-prop convention) so the shared package
 * imports no router. Web wraps it with a router-bound `onSetup`; mobile passes
 * `router.push`. While loading or for logged-out users the hooks resolve to
 * empty/undefined → the strip renders its "set your issue priorities" CTA.
 */
export function RepAlignmentSection({
  officialId,
  repName,
  onSetup,
  setupHref,
}: RepAlignmentSectionProps): React.JSX.Element {
  const client = useChiaroClient()
  const { data: alignment = null } = useRepAlignment(client, officialId)
  const { data: selections } = useMySelections(client)
  const hasSelections = (selections?.length ?? 0) > 0
  const [expanded, setExpanded] = useState(false)

  return (
    <View>
      <RepAlignmentStrip
        alignment={alignment}
        hasSelections={hasSelections}
        onSetup={onSetup}
        {...(setupHref ? { setupHref } : {})}
        onExpand={() => setExpanded((e) => !e)}
        expanded={expanded}
      />
      {expanded && alignment != null && alignment.overallPct != null && (
        <IssueRadarOverlay alignment={alignment} {...(repName ? { repName } : {})} />
      )}
    </View>
  )
}
