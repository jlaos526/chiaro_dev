// Federal-tier title classifier. CRITICAL: must NOT match "State Senator" /
// "State Rep." / "State Representative" — uses negative lookbehind to skip
// events with "State" prefix. Lookbehind is supported in Node 22+ / V8 9+.

export const FEDERAL_LEGISLATOR_RE =
  /\b(?<!State\s)(?<!State\s+)(Senator|Representative|Congressman|Congresswoman|Rep\.?)\b/i

export const FEDERAL_NAME_RE =
  /(?<!State\s)(?<!State\s+)(?:Senator|Representative|Congressman|Congresswoman|Rep\.?)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,1})/

export function isFederalLegislatorEvent(title: string, description: string): boolean {
  return FEDERAL_LEGISLATOR_RE.test(title) || FEDERAL_LEGISLATOR_RE.test(description)
}

export function extractFederalLegislatorName(title: string): string | null {
  const m = title.match(FEDERAL_NAME_RE)
  return m ? m[1]! : null
}

export type FederalChamber = 'federal_house' | 'federal_senate'

export function inferFederalChamber(title: string): FederalChamber | null {
  // Senate first (Senator matches first in regex order).
  if (/\b(?<!State\s)Senator\b/i.test(title)) return 'federal_senate'
  if (/\b(?<!State\s)(Representative|Congressman|Congresswoman|Rep\.?)\b/i.test(title)) {
    return 'federal_house'
  }
  return null
}
