import type { GeocodioResponse, CalibrateInput, ResolvedDistrict, GeocodioCandidate } from './types.ts'

export interface GeocodioClient {
  lookup(input: CalibrateInput): Promise<GeocodioResponse>
}

export class GeocodioHttpClient implements GeocodioClient {
  constructor(private readonly apiKey: string) {}

  async lookup(input: CalibrateInput): Promise<GeocodioResponse> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      fields: 'cd,stateleg,census2020',     // pinned field flags
    })
    if ('address' in input) {
      params.set('q', input.address)
    } else {
      params.set('q', `${input.lat},${input.lng}`)
    }

    const url = `https://api.geocod.io/v1.7/geocode?${params.toString()}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10_000)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) {
        throw new GeocodioError(res.status, await res.text())
      }
      return await res.json() as GeocodioResponse
    } finally {
      clearTimeout(t)
    }
  }
}

export class GeocodioError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`GeocodIO ${status}: ${body.slice(0, 200)}`)
  }
}

// Map a GeocodIO candidate → array of resolved districts. Missing fields
// produce no row for that tier (logged as warning at the call site).
export function extractDistricts(c: GeocodioCandidate): ResolvedDistrict[] {
  const out: ResolvedDistrict[] = []
  const state = c.address_components.state

  // federal_house — TIGER stores zero-padded ("01"); GeocodIO returns numeric.
  // Pad to match TIGER's (tier, code) unique-key form. At-large is "AL".
  for (const cd of c.fields?.congressional_districts ?? []) {
    const num = cd.district_number === 0 ? 'AL' : String(cd.district_number).padStart(2, '0')
    out.push({
      tier: 'federal_house',
      code: `${state}-${num}`,
      state,
      name: cd.name,
    })
  }

  // federal_senate — both seats
  out.push(
    { tier: 'federal_senate', state, code: `${state}-S1`, name: `${state} U.S. Senate (Class 1)` },
    { tier: 'federal_senate', state, code: `${state}-S2`, name: `${state} U.S. Senate (Class 2)` },
  )

  // state_senate — TIGER strips leading zeros from SLDUST. Match here so the
  // (tier, code) lookup against canonical rows succeeds.
  for (const ss of c.fields?.state_legislative_districts?.senate ?? []) {
    const num = String(ss.district_number).replace(/^0+/, '') || '0'
    out.push({
      tier: 'state_senate',
      state,
      code: `${state}-SS-${num}`,
      name: ss.name,
    })
  }

  // state_house — same leading-zero strip as state_senate.
  for (const sh of c.fields?.state_legislative_districts?.house ?? []) {
    const num = String(sh.district_number).replace(/^0+/, '') || '0'
    out.push({
      tier: 'state_house',
      state,
      code: `${state}-SH-${num}`,
      name: sh.name,
    })
  }

  // county + place from census2020. GeocodIO returns `census` as an object
  // keyed by year ("2020"), where each value is a *single* census record
  // (not an array). The county code in TIGER is the 5-char state+county FIPS
  // (e.g. "36061"), which GeocodIO exposes as `county_fips`. Place data is
  // nested under `place.fips` / `place.name`.
  const census = c.fields?.census?.['2020'] ?? c.fields?.census?.['Census 2020']
  if (census) {
    if (census.county_fips) {
      out.push({
        tier: 'county',
        state,
        code: census.county_fips,
        name: `County ${census.county_fips}`,        // refined from districts table on lookup
      })
    }
    if (census.place?.fips) {
      out.push({
        tier: 'place',
        state,
        code: census.place.fips,
        name: census.place.name ?? `Place ${census.place.fips}`,
      })
    }
  }

  return out
}
