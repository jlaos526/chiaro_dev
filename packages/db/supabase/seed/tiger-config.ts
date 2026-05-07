import { STATE_FIPS, NO_STATE_HOUSE, NO_STATE_LEGISLATURE } from './tiger-state-fips.ts'

export const TIGER_VERSION = 'TIGER 2024'

export type TigerSource = {
  tier: 'federal_house' | 'state_senate' | 'state_house' | 'county' | 'place'
  // either a single nationwide URL or one URL per state FIPS
  urls: () => Array<{ url: string; stateFips?: string }>
  // produce the canonical (tier, code, state, name) per shapefile feature
  extract: (props: Record<string, unknown>, stateFipsHint?: string) => {
    code: string
    state: string
    name: string
  } | null
}

const fipsToState = new Map(STATE_FIPS.map(s => [s.fips, s.state]))

export const TIGER_SOURCES: TigerSource[] = [
  {
    tier: 'federal_house',
    // TIGER 2024 ships cd119 as per-state files (one per state FIPS), not a
    // single nationwide file. The field name changed to CD119FP.
    urls: () => STATE_FIPS.map(s => ({
      url: `https://www2.census.gov/geo/tiger/TIGER2024/CD/tl_2024_${s.fips}_cd119.zip`,
      stateFips: s.fips,
    })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const cd = String(props.CD119FP)
      const state = fipsToState.get(stateFp)
      if (!state) return null  // territory, skip
      // Census uses '00' for at-large districts — render as 'AL'
      const codeNum = cd === '00' ? 'AL' : cd
      const code = `${state}-${codeNum}`
      const name = `${state} Congressional District ${codeNum}`
      return { code, state, name }
    },
  },
  {
    tier: 'state_senate',
    urls: () => STATE_FIPS
      .filter(s => !NO_STATE_LEGISLATURE.has(s.state))
      .map(s => ({
        url: `https://www2.census.gov/geo/tiger/TIGER2024/SLDU/tl_2024_${s.fips}_sldu.zip`,
        stateFips: s.fips,
      })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const sldu = String(props.SLDUST).replace(/^0+/, '') || '0'
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = `${state}-SS-${sldu}`
      const name = String(props.NAMELSAD ?? `${state} Senate District ${sldu}`)
      return { code, state, name }
    },
  },
  {
    tier: 'state_house',
    urls: () => STATE_FIPS
      .filter(s => !NO_STATE_LEGISLATURE.has(s.state) && !NO_STATE_HOUSE.has(s.state))
      .map(s => ({
        url: `https://www2.census.gov/geo/tiger/TIGER2024/SLDL/tl_2024_${s.fips}_sldl.zip`,
        stateFips: s.fips,
      })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const sldl = String(props.SLDLST).replace(/^0+/, '') || '0'
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = `${state}-SH-${sldl}`
      const name = String(props.NAMELSAD ?? `${state} House District ${sldl}`)
      return { code, state, name }
    },
  },
  {
    tier: 'county',
    urls: () => [
      { url: 'https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/tl_2024_us_county.zip' },
    ],
    extract: (props) => {
      const stateFp = String(props.STATEFP)
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = String(props.GEOID)              // 5-digit county FIPS
      const name = String(props.NAMELSAD)            // e.g. "Kings County"
      return { code, state, name }
    },
  },
  {
    tier: 'place',
    urls: () => STATE_FIPS.map(s => ({
      url: `https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_${s.fips}_place.zip`,
      stateFips: s.fips,
    })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = String(props.GEOID)              // 7-digit place FIPS
      const name = String(props.NAMELSAD)
      return { code, state, name }
    },
  },
]

// federal_senate is synthesized from the STATE shapefile (one S1 + one S2 per
// state, sharing the state's outer boundary).
export const FEDERAL_SENATE_SOURCE = {
  url: 'https://www2.census.gov/geo/tiger/TIGER2024/STATE/tl_2024_us_state.zip',
}
