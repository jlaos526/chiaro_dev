interface EventForFormat {
  is_virtual: boolean
  event_url: string | null
  location: { venue?: string } | null
}

const VIRTUAL_URL_RE = /zoom\.us|meet\.google|teams\.microsoft/i

/**
 * Maps a mobilize-style event payload to format enum. Tier-agnostic; used
 * by state-community/town-halls/mobilize-helpers.ts + federal-community/
 * town-halls/mobilize-helpers.ts.
 *
 * - is_virtual=true → 'virtual'
 * - zoom/meet/teams URL + venue → 'hybrid'
 * - zoom/meet/teams URL, no venue → 'virtual'
 * - else → 'in_person'
 *
 * Moved from state-community/town-halls/mobilize-helpers.ts in slice 8.
 */
export function deriveFormat(event: EventForFormat): 'in_person' | 'virtual' | 'phone' | 'hybrid' {
  if (event.is_virtual === true) return 'virtual'
  const eventUrl = event.event_url ?? ''
  const hasVirtualLink = VIRTUAL_URL_RE.test(eventUrl)
  const hasPhysicalLocation = !!event.location?.venue
  if (hasVirtualLink && hasPhysicalLocation) return 'hybrid'
  if (hasVirtualLink) return 'virtual'
  return 'in_person'
}
