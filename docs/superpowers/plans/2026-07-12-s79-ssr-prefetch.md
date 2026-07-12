# S79 plan — SSR prefetch + round-trip collapse

Spec: `docs/superpowers/specs/2026-07-12-s79-ssr-prefetch-design.md`.
Stages are commit-sized; C4 before C18 per the roadmap critic ruling.

- **T1 (C4 + C18c)**: `lib/query-client.tsx` exports a server-side
  `makeQueryClient` path; both web detail pages build a QueryClient,
  `Promise.all` prefetchQuery over the D1 list (reusing domain fetchers + key
  factories with the server Supabase client), wrap the card cascade in
  `<HydrationBoundary state={dehydrate(qc)}>`; the pages' hand-rolled
  leadership/scorecards fetches collapse into the same prefetch (bio reads
  from the prefetched data). Web page render tests updated (island mocks
  unchanged; assert prefetch fan-out doesn't break redirects).
- **T2 (C18 embeds)**: finance 5→1; federal + state sponsored/cosponsored
  inversion; state donors 3→1; hearings 3→1; catalog 2→1. Unit mocks updated;
  new live-PostgREST integration cases per embed (officials + issues).
- **T3 (C22)**: fetchMyOfficials embed + OfficialsCard row de-hooking + tests.
- **T4 (C7)**: SmartAnchor `onPrefetch` + web wrapper wiring + tests.
- **T5**: full battery (typecheck, lint, all suites, build, bundle table),
  CLAUDE.md entry, PR with the request-count evidence.
