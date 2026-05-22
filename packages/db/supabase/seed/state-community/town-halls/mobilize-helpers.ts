export const STATE_LEGISLATOR_RE =
  /\b(State Senator|State Rep\.?|State Representative|Assemblymember|Assemblyman|Assemblywoman|Delegate)\b/i

// {1,1} (not plan's {0,3}) prevents greedy-grabbing follow-on capitalized
// words like "Virtual Town" in "Delegate Pat Smith Virtual Town Hall".
// All fixture/test names are 2 words (incl. hyphenated last names). If
// 3-word names emerge in production, widen to {1,2} or add a stop-word
// lookahead (e.g., (?!Virtual|Town|Community)).
export const NAME_RE =
  /(?:State Senator|State Rep\.?|State Representative|Assemblymember|Assemblyman|Assemblywoman|Delegate)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,1})/

export function isStateLegislatorEvent(title: string, description: string): boolean {
  return STATE_LEGISLATOR_RE.test(title) || STATE_LEGISLATOR_RE.test(description)
}

export function extractLegislatorName(title: string): string | null {
  const m = title.match(NAME_RE)
  return m ? m[1]! : null
}

export type StateChamber = 'state_house' | 'state_senate' | 'state_legislature'

export function inferChamberFromTitle(title: string): StateChamber | null {
  // Match priority: state_senate (must contain "State Senator") then state_house.
  if (/\bState Senator\b/i.test(title)) return 'state_senate'
  if (/\b(Assemblymember|Assemblyman|Assemblywoman|Delegate|State Rep\.?|State Representative)\b/i.test(title)) {
    return 'state_house'
  }
  return null
}

interface MobilizeEventForFormat {
  is_virtual: boolean
  event_url: string | null
  location: { venue?: string } | null
}

const VIRTUAL_URL_RE = /zoom\.us|meet\.google|teams\.microsoft/i

export function deriveFormat(event: MobilizeEventForFormat): 'in_person' | 'virtual' | 'phone' | 'hybrid' {
  if (event.is_virtual === true) return 'virtual'
  const eventUrl = event.event_url ?? ''
  const hasVirtualLink = VIRTUAL_URL_RE.test(eventUrl)
  const hasPhysicalLocation = !!event.location?.venue
  if (hasVirtualLink && hasPhysicalLocation) return 'hybrid'
  if (hasVirtualLink) return 'virtual'
  return 'in_person'
}
