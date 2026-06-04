import { describe, it, expect } from 'vitest'
import { ingestIssueCatalog } from './ingest.ts'
import { ISSUE_CATALOG } from './catalog-data.ts'

describe('ingestIssueCatalog', () => {
  it('upserts every topic and its lenses', async () => {
    const upserts: Record<string, unknown[]> = {}
    const client = {
      from: (table: string) => ({
        upsert: async (rows: unknown[]) => {
          upserts[table] = [...(upserts[table] ?? []), ...rows]
          return { error: null }
        },
      }),
    } as never
    await ingestIssueCatalog(client)
    expect(upserts['issue_topics']).toHaveLength(ISSUE_CATALOG.length)
    expect(upserts['issue_lenses']!.length).toBeGreaterThanOrEqual(ISSUE_CATALOG.length)
  })

  it('every stance lens has measurement_sources weights summing to ~1.0', () => {
    for (const topic of ISSUE_CATALOG)
      for (const lens of topic.lenses.filter((l) => l.lens_type === 'stance')) {
        const sum = (lens.measurement_sources ?? []).reduce((a, s) => a + s.weight, 0)
        if (lens.measurement_sources.length > 0) expect(sum).toBeCloseTo(1.0, 2)
      }
  })

  it('ships all 13 locked topic slugs', () => {
    const slugs = ISSUE_CATALOG.map((t) => t.slug)
    for (const s of [
      'immigration', 'environment', 'law-and-order', 'civil-liberties', 'civil-rights', 'labor',
      'abortion-policy', 'gun-policy', 'economy', 'healthcare', 'education', 'housing', 'foreign-policy',
    ])
      expect(slugs).toContain(s)
  })

  it('wires evidence_sources on the 2 donor watchlists', () => {
    const findLens = (slug: string) =>
      ISSUE_CATALOG.flatMap((t) => t.lenses).find((l) => l.slug === slug)!
    for (const slug of ['industry-donor-recipients', 'for-profit-prisons']) {
      const lens = findLens(slug)
      expect(lens.evidence_sources.length).toBeGreaterThan(0)
      const src = lens.evidence_sources[0] as { type: string; config: { industries: string[] } }
      expect(src.type).toBe('finance-industry')
      expect(src.config.industries.length).toBeGreaterThan(0)
    }
  })

  it('deactivates the 3 non-data-backed watchlists', () => {
    const findLens = (slug: string) =>
      ISSUE_CATALOG.flatMap((t) => t.lenses).find((l) => l.slug === slug)!
    for (const slug of ['slapp-suit-participants', 'anti-fraud-self-interest', 'epstein-related-protectors'])
      expect(findLens(slug).active).toBe(false)
    expect(findLens('industry-donor-recipients').active).not.toBe(false)
  })

  it('ingest writes active:false for deactivated lenses', async () => {
    const upserts: Record<string, unknown[]> = {}
    const client = {
      from: (table: string) => ({
        upsert: async (rows: unknown[]) => { upserts[table] = [...(upserts[table] ?? []), ...rows]; return { error: null } },
      }),
    } as never
    await ingestIssueCatalog(client)
    const slapp = (upserts['issue_lenses'] as Array<{ slug: string; active: boolean }>).find((r) => r.slug === 'slapp-suit-participants')!
    expect(slapp.active).toBe(false)
  })
})
