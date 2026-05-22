import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function peopleCacheDir(): string {
  return process.env.OPENSTATES_PEOPLE_CACHE_DIR
    ?? join(process.cwd(), 'packages', 'db', 'supabase', 'seed', '.cache', 'openstates', 'people')
}

const RESIGN_RE = /resign/i
const DEATH_RE  = /(death|died|deceased)/i

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
 * Reads slice 5C cached OpenStates people files and emits resignation
 * events for any role with end_reason matching /resign/i or
 * /(death|died|deceased)/i.
 *
 * Returns [] when cache dir absent (v1 stub fallback).
 *
 * NOTE: slice 5C caches OpenStates people as YAML, not JSON. The v1
 * production path here uses JSON.parse, which fails silently per the
 * try/catch. Operator wires a YAML parser when this adapter goes live;
 * fixture-injected tests work fine today.
 */
export const openstatesEndReason: StateEthicsAdapter = {
  slug: 'openstates-end-reason',
  component: 'events',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()

    const dir = peopleCacheDir()
    if (!existsSync(dir)) return []

    const out: NormalizedOfficialEvent[] = []
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return []
    }

    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.yml')) continue
      let person: OpenStatesPerson
      try {
        const raw = await readFile(join(dir, file), 'utf8')
        // For v1 we assume JSON. Slice 5C may cache YAML; production
        // operator wires a YAML parser if needed.
        person = JSON.parse(raw) as OpenStatesPerson
      } catch {
        continue
      }
      if (!person.roles) continue
      for (const role of person.roles) {
        if (!role.end_date || !role.end_reason) continue
        if (opts.state && role.jurisdiction !== opts.state) continue

        const isResign = RESIGN_RE.test(role.end_reason)
        const isDeath  = DEATH_RE.test(role.end_reason)
        if (!isResign && !isDeath) continue

        const stateMatch = role.jurisdiction?.match(/^[A-Z]{2}$/)
        const state = stateMatch ? role.jurisdiction! : opts.state ?? ''
        if (!state) continue

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
