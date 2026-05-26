import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { SkipReason } from '../../shared/instrumentation.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function peopleCacheDir(): string {
  return process.env.OPENSTATES_PEOPLE_CACHE_DIR
    ?? join(process.cwd(), 'packages', 'db', 'supabase', 'seed', '.cache', 'openstates', 'people')
}

const RESIGN_RE = /resign/i
const DEATH_RE  = /(death|died|deceased)/i

const JURISDICTION_RE = /state:([a-z]{2})\//i

function extractStateFromJurisdiction(jurisdiction: string | undefined): string | null {
  if (!jurisdiction) return null
  const m = jurisdiction.match(JURISDICTION_RE)
  if (m) return m[1]!.toUpperCase()
  if (/^[A-Z]{2}$/.test(jurisdiction)) return jurisdiction
  return null
}

interface OpenStatesPerson {
  id: string
  name: string
  roles?: Array<{
    type?: string
    jurisdiction?: string
    end_date?: string
    end_reason?: string
  }>
}

/**
 * Reads slice 5C cached OpenStates people files (`.json` / `.yml` / `.yaml`)
 * and emits resignation events for any role with end_reason matching
 * /resign/i or /(death|died|deceased)/i.
 *
 * Returns [] when cache dir absent (v1 stub fallback).
 *
 * State extraction handles both formats:
 *   - OCD-jurisdiction: `ocd-jurisdiction/country:us/state:ca/government`
 *     (slice 5C format) → extracts `CA` via JURISDICTION_RE
 *   - Plain 2-letter: `CA` → passes through unchanged
 */
export const openstatesEndReason: StateEthicsAdapter<NormalizedOfficialEvent> = {
  slug: 'openstates-end-reason',
  component: 'events',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()

    const dir = peopleCacheDir()
    if (!existsSync(dir)) {
      opts.onSkip?.({
        adapter: 'openstates-end-reason',
        stage: 'fetch',
        reason: `cache dir absent: ${dir}`,
      })
      return []
    }

    const out: NormalizedOfficialEvent[] = []
    let files: string[]
    try {
      files = await readdir(dir)
    } catch (e) {
      opts.onSkip?.({
        adapter: 'openstates-end-reason',
        stage: 'fetch',
        reason: `readdir failed for ${dir}`,
        detail: e instanceof Error ? e.message : String(e),
      })
      return []
    }

    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.yml') && !file.endsWith('.yaml')) continue
      let person: OpenStatesPerson
      try {
        const raw = await readFile(join(dir, file), 'utf8')
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          person = parseYaml(raw) as OpenStatesPerson
        } else {
          person = JSON.parse(raw) as OpenStatesPerson
        }
      } catch (e) {
        opts.onSkip?.({
          adapter: 'openstates-end-reason',
          stage: 'parse',
          legislator: file,
          reason: 'YAML/JSON parse failed',
          detail: e instanceof Error ? e.message : String(e),
        })
        continue
      }
      if (!person.roles) continue
      for (const role of person.roles) {
        if (!role.end_date || !role.end_reason) continue

        const roleState = extractStateFromJurisdiction(role.jurisdiction)
        if (opts.state && roleState !== opts.state) continue

        const isResign = RESIGN_RE.test(role.end_reason)
        const isDeath  = DEATH_RE.test(role.end_reason)
        // INTENTIONAL silent filter: most roles have end_reason like "term ended"
        // — not a resignation/death. We don't emit a skip here because this is
        // the normal case (the adapter's purpose is to extract ONLY resign/death
        // events from a much larger corpus of role end_reasons).
        if (!isResign && !isDeath) continue

        const state = roleState ?? opts.state ?? ''
        if (!state) {
          opts.onSkip?.({
            adapter: 'openstates-end-reason',
            stage: 'parse',
            legislator: person.name,
            reason: 'could not extract state from role.jurisdiction',
            detail: role.jurisdiction ?? '(jurisdiction empty)',
          })
          continue
        }

        out.push({
          official_openstates_person_id: person.id,
          event_date: role.end_date,
          event_type: 'resignation',
          outcome: isDeath
            ? `Death (per OpenStates end_reason='${role.end_reason}')`
            : `Resignation (per OpenStates end_reason='${role.end_reason}')`,
          summary: isDeath
            ? `Deceased per OpenStates roles[].end_reason`
            : `Resignation per OpenStates roles[].end_reason='${role.end_reason}'`,
          state,
          source_url: `https://openstates.org/person/${person.id}/`,
          source: 'openstates-end-reason',
          external_id: `openstates-end-reason:${person.id}:${role.end_date}`,
        })
      }
    }
    return out
  },
}
