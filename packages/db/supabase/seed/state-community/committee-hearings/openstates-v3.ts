import type { StateCommunityAdapter, NormalizedCommitteeHearing } from '../shared.ts'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ALL_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

function cacheDir(): string {
  return (
    process.env.OPENSTATES_COMMITTEES_CACHE_DIR ??
    join(process.cwd(), 'packages', 'db', 'supabase', 'seed', '.cache', 'openstates', 'committees')
  )
}

/**
 * Reads committee envelopes from the slice 5F cache (
 * .cache/openstates/committees/<state>.json) and extracts hearings
 * from each committee's meetings[] array. v1 stub returns [] if cache
 * dir is empty.
 */
export const openstatesV3Hearings: StateCommunityAdapter<NormalizedCommitteeHearing> = {
  slug: 'openstates-v3',
  component: 'hearings',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()

    const dir = cacheDir()
    const targetStates = opts.state ? [opts.state] : ALL_STATES
    const out: NormalizedCommitteeHearing[] = []
    for (const state of targetStates) {
      const cachePath = join(dir, `${state}.json`)
      if (!existsSync(cachePath)) continue
      try {
        const committees = JSON.parse(await readFile(cachePath, 'utf8')) as Array<{
          id: string
          jurisdiction?: { name?: string }
          current_session?: { identifier?: string }
          meetings?: Array<{
            date: string
            location?: string
            agenda_topic?: string
            attendance?: Array<{ person?: { id?: string } }>
          }>
        }>
        for (const c of committees) {
          if (!c.meetings) continue
          for (const m of c.meetings) {
            out.push({
              openstates_committee_id: c.id,
              state,
              session: opts.session ?? c.current_session?.identifier ?? '',
              hearing_date: m.date,
              ...(m.location !== undefined ? { location: m.location } : {}),
              ...(m.agenda_topic !== undefined ? { agenda_topic: m.agenda_topic } : {}),
              source_url: `https://v3.openstates.org/committees/${c.id}`,
              attendees_openstates_person_ids: (m.attendance ?? [])
                .map((a) => a.person?.id)
                .filter((id): id is string => !!id),
            })
          }
        }
      } catch {
        // Skip malformed cache file silently — operator inspects via stats.errors
      }
    }
    return out
  },
}
