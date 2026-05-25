/**
 * Best-effort regex parser for a raw US legislator-office address string.
 *
 * Input: "123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234"
 * Output: { street_1: "123 Main Street", city: "Buffalo", state: "NY",
 *           postal_code: "14201", phone: "(716) 555-1234" }
 *
 * Returns null if street_1 + city + state can't be extracted (required
 * NormalizedDistrictOffice fields).
 *
 * Hoisted from slice 15 ny-senate/assembly.ts in slice 16 — needed by
 * 5 callers (NY assembly + senate, CA senate + assembly, MI senate +
 * house = 6 total). Slice 15 callers (ny-senate/{assembly,senate}.ts)
 * re-import from this canonical location.
 *
 * Underscore prefix on filename signals package-internal helper.
 */
export function parseAddressText(raw: string): {
  street_1: string
  city: string
  state: string
  postal_code?: string
  phone?: string
} | null {
  // Extract phone (anything after "Phone:" or matching standard phone format)
  let phone: string | undefined
  const phoneMatch = raw.match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/)
  if (phoneMatch) {
    phone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`
  }

  // Remove phone segment from address (split on "·" or "Phone:" markers)
  const addrPart = raw.split(/·|Phone:/i)[0]!.trim()

  // Split on commas; expect "Street, City, State Zip" format
  const segments = addrPart.split(',').map(s => s.trim()).filter(Boolean)
  if (segments.length < 3) return null

  const street_1 = segments[0]!
  const city = segments[segments.length - 2]!
  const stateZip = segments[segments.length - 1]!

  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)?\s*$/)
  if (!stateZipMatch) return null
  const state = stateZipMatch[1]!
  const postal_code = stateZipMatch[2]

  const result: { street_1: string; city: string; state: string; postal_code?: string; phone?: string } = {
    street_1, city, state,
  }
  if (postal_code) result.postal_code = postal_code
  if (phone) result.phone = phone
  return result
}
