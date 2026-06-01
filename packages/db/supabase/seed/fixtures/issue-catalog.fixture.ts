// Slice 52 — tiny fixture catalog for the CI fixture-ingest suite.
//
// Intentionally minimal (2 topics) so a catalog regression surfaces fast in CI
// without coupling the test to the real 13-topic catalog's exact contents.
// Reuses the production `TopicSeed` type so a shape drift in catalog-data.ts
// breaks this file at typecheck time. One stance topic (with a scorecard
// measurement source) + one watchlist topic exercise both lens kinds.

import type { TopicSeed } from '../issue-catalog/catalog-data.ts'

export const ISSUE_CATALOG_FIXTURE: TopicSeed[] = [
  {
    slug: 'fx-environment',
    display_name: 'FX Environment',
    description: 'Fixture topic: conservation and climate.',
    value_tags: ['progressive'],
    display_order: 1,
    lenses: [
      {
        slug: 'fx-conservation',
        label: 'FX Conservation',
        lens_type: 'stance',
        display_order: 0,
        measurement_sources: [
          { type: 'scorecard', weight: 1.0, config: { orgs: ['lcv'] } },
        ],
        evidence_sources: [],
        quiz_questions: [
          {
            slug: 'fx-public-lands',
            prompt: 'Public lands should be expanded and protected.',
            agree_direction: 1,
            display_order: 0,
          },
        ],
      },
    ],
  },
  {
    slug: 'fx-law-and-order',
    display_name: 'FX Law & Order',
    description: 'Fixture topic: a watchlist-only entry.',
    value_tags: [],
    display_order: 2,
    lenses: [
      {
        slug: 'fx-for-profit-prisons',
        label: 'FX For-Profit Prisons',
        lens_type: 'watchlist',
        display_order: 0,
        description: 'Reps receiving major private-prison-industry contributions.',
        measurement_sources: [],
        evidence_sources: [],
        quiz_questions: [],
      },
    ],
  },
]
