# Chiaro

**Address → districts → your elected officials — federal and state — with their bills, votes, finances, and ethics records in one place.**

Chiaro is a civic-engagement app: calibrate your home address once, and it resolves your legislative districts (via Census TIGER geometries + PostGIS point-in-polygon) and shows every official who represents you — U.S. House and Senate plus your state legislators — each with a detail page covering their service record, campaign finance, issue positions, community presence, and ethics/accountability data aggregated from public sources. An issue-priorities quiz builds a personal radar and scores how each of your representatives aligns with you.

> **Live demo:** https://chiaro-dev-web.vercel.app — sign up, then use **"try a sample address"** on the calibrate screen (San Francisco City Hall) instead of a real residence. This is a personal portfolio project on demo infrastructure; data may reset at any time.

## What it does

- **Location calibration** — address (or GPS on mobile) → Geocodio geocode → PostGIS point-in-polygon against ~42,500 TIGER 2024 district geometries → your federal + state delegation, rendered on an interactive district map.
- **Federal officials** — House + Senate from Congress.gov: sponsored/cosponsored bills, roll-call votes, missed-vote counts, committee leadership, campaign finance (totals, top industries, PACs, individual donors), STOCK Act trades + annual financial disclosures, town halls, district offices, and 10 issue-org scorecards.
- **State legislators** — all 50 states from OpenStates (~6,260 legislators): state bills + votes with per-state enrichment (CA, NY, FL, TX, MI), campaign finance, committee hearings, financial disclosures, ethics complaints, recalls/resignations, and state scorecards — via ~40 per-source ingest adapters (HTML scrape, PDF parsing, bulk ZIPs, public APIs) with skip-reason telemetry.
- **Issue priorities** — pick topics, take a stance quiz, get a radar of your positions overlaid against each rep's scored record, plus donor watchlist flags (e.g. fossil-fuel industry money) computed from finance data.

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 15 (App Router, RSC) + React 19 |
| Mobile | Expo / React Native (expo-router), sharing ~95% of UI code with web via react-native-web |
| Backend | Supabase — Postgres 17 + PostGIS, Row-Level Security, Edge Functions (Deno) |
| Data layer | TanStack Query with SSR prefetch + hydration; PostgREST with heavy use of embedded resources |
| Monorepo | pnpm workspaces + Turborepo — 12 packages (domain packages per surface: officials, bills, state-bills, issues, location, profile…) |
| Quality | ~2,000 tests: pgTAP (498 SQL plans), Vitest (unit + live-PostgREST integration), Jest (mobile), Deno tests (edge), Biome lint/format, 3-job parallel CI |
| Ops | Vercel (web), hosted Supabase (staging), Sentry (error-only, PII-scrubbed, tunneled past ad-blockers) |

## Engineering highlights

- **One UI codebase, two platforms.** ~60 components in a shared `@chiaro/officials-ui` package render natively on iOS/Android and via react-native-web on Next.js — with platform escape hatches for real `<a href>` semantic anchors, ARIA heading hierarchy, and CSS-only affordances where RNW falls short.
- **Round-trip discipline.** Detail pages server-prefetch every card query into a dehydrated TanStack cache (0 client round-trips on first paint); N+1 patterns collapsed into single PostgREST requests with multi-embed queries proven against a live database in integration tests; the home card went from 2+2N requests to 2.
- **Ingest pipeline as a product.** 27+ idempotent seed CLIs with uniform skip-reason instrumentation, name-resolution ambiguity guards (no mis-attributed ethics records), delete-before-insert idempotency, and per-source rate-limit etiquette — documented failure taxonomy for scrape targets that drift.
- **Security posture.** RLS-scoped user data (with pgTAP tests asserting cross-user denial), SECURITY DEFINER functions with explicit PUBLIC-execute revokes, rate limiting before paid geocode spend, CSP/security headers, and a PII scrubber (addresses + political-opinion selections) duplicated across all three Sentry surfaces.
- **Tested at the seams.** Live-PostgREST integration suites per domain package (embed shapes, RLS, ordering), 498 pgTAP plans over migrations/policies/functions, render tests for every route, and CI grep guards for recurring bug classes (Windows CLI entry points, type-cast escapes).

## Repository tour

```
apps/web            Next.js 15 app (App Router, SSR prefetch, middleware auth)
apps/mobile         Expo app (drawer nav, GPS calibrate, dev-client builds)
packages/officials-ui   Shared cross-platform UI (~60 components)
packages/officials  Per-official data: queries, hooks, types (federal + state)
packages/bills      Federal bill/vote surfaces
packages/state-bills    State bill/vote surfaces
packages/issues     Issue-priorities quiz, radar, alignment scoring
packages/location   Districts, calibration, map data
packages/db         Migrations (65), seed/ingest pipelines, Edge Functions, pgTAP
docs/superpowers    Specs, plans, audits — the full engineering decision log
```

`CLAUDE.md` at the repo root is the living engineering log: 79 delivered slices with per-slice design notes, plus a "Gotchas" section documenting every non-obvious failure mode hit along the way — a deliberate artifact of the AI-pair-programmed workflow this project is built with.

## Running locally

```bash
pnpm install
pnpm db:start          # local Supabase (Docker)
pnpm db:reset          # apply migrations
pnpm seed:tiger        # district geometries (~5–15 min)
pnpm seed:officials    # federal officials (needs CONGRESS_GOV_API_KEY)
pnpm seed:state-officials  # state legislators (OpenStates clone; see CLAUDE.md)
pnpm --filter @chiaro/web dev   # http://localhost:3000
```

Full environment-variable table, seed order, and per-source API-key notes live in [`CLAUDE.md`](./CLAUDE.md); staging promotion is documented in [`docs/superpowers/staging-promotion-runbook.md`](./docs/superpowers/staging-promotion-runbook.md).

## Measured performance (live origin)

Lighthouse 12, mobile emulation, unauthenticated `/sign-in`, 2026-07-12: **accessibility 95 · best practices 96 · performance 63** (full capture + interpretation in [`docs/superpowers/audits/2026-07-12-lighthouse-baseline.md`](./docs/superpowers/audits/2026-07-12-lighthouse-baseline.md) — the CLS finding it surfaced is queued into the next UI slice). Recent optimization work — documented in the slice log — cut every route's First Load JS by 74–135 kB (Sentry tree-shaking + deep-import pruning), simplified multi-MB district geometry payloads ~10–50× server-side, and removed all client card round-trips on detail-page first paint.

## Status & roadmap

Active development. The optimization roadmap (25 slices across 3 waves — performance, security, testing, ops) and its dated revisions live at [`docs/superpowers/plans/2026-06-10-optimization-roadmap.md`](./docs/superpowers/plans/2026-06-10-optimization-roadmap.md). Screenshots and E2E coverage (Playwright) are queued next.

*Chiaro is a demonstration project. Civic data is aggregated from public sources and may be incomplete or out of date — verify anything that matters against official records.*
