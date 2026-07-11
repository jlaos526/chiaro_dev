import { describe, it, expect, vi } from 'vitest'
import { fetchRepAlignment, fetchCatalog, fetchRepWatchlistFlags } from '../src/queries.ts'
import { saveSelections } from '../src/mutations.ts'

const clientWith = (impl: Record<string, unknown>) => impl as never

describe('queries', () => {
  it('fetchRepAlignment calls the RPC and returns its payload', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { overallPct: 72, axes: [] }, error: null })
    const out = await fetchRepAlignment(clientWith({ rpc }), 'off-1')
    expect(rpc).toHaveBeenCalledWith('get_rep_issue_alignment', { p_official_id: 'off-1' })
    expect(out?.overallPct).toBe(72)
  })
  it('saveSelections calls save_user_issue_selections', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    await saveSelections(clientWith({ rpc }), [
      { topic_slug: 't', lens_slug: 'l', display_order: 0, position: 50, importance: 1 },
    ])
    expect(rpc).toHaveBeenCalledWith('save_user_issue_selections', {
      p_selections: expect.any(Array),
    })
  })
  it('fetchCatalog groups lenses under topics', async () => {
    const from = vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data:
                table === 'issue_topics'
                  ? [{ slug: 'environment', display_name: 'Environment', lenses: undefined }]
                  : [
                      {
                        topic_slug: 'environment',
                        slug: 'conservation',
                        lens_type: 'stance',
                        measurement_sources: [],
                        quiz_questions: [],
                      },
                    ],
              error: null,
            }),
        }),
      }),
    }))
    const out = await fetchCatalog(clientWith({ from }))
    expect(out[0]?.lenses).toHaveLength(1)
  })
  it('fetchRepWatchlistFlags calls the RPC and returns its payload', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: [
          {
            topicSlug: 'environment',
            lensSlug: 'industry-donor-recipients',
            label: 'X',
            category: 'fossil-fuel',
            totalAmount: 42000,
            evidence: [{ industry: 'Oil & Gas', amount: 42000 }],
          },
        ],
        error: null,
      })
    const out = await fetchRepWatchlistFlags(clientWith({ rpc }), 'off-1')
    expect(rpc).toHaveBeenCalledWith('get_rep_watchlist_flags', { p_official_id: 'off-1' })
    expect(out).toHaveLength(1)
    expect(out[0]?.evidence[0]?.industry).toBe('Oil & Gas')
  })
})
