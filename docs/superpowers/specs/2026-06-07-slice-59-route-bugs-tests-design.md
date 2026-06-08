# Slice 59 — Route bug-fixes + test coverage Design Spec

**Date:** 2026-06-07
**Branch:** `slice-59-route-bugs-tests`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Mega Slice (~20 files)
**Source:** Audit track **T5** from `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`

## 1. Goal / problem

Fix the three route-level bugs the audit found and back-fill the missing render/guard test coverage that let them hide. Spans `apps/web` + `apps/mobile` + `@chiaro/officials-ui`. No schema. All findings verified against current code 2026-06-07 (post slices 56/57/58).

## 2. Bugs

### B1 — web `state-officials/[id]` 500 on a bad ID
`apps/web/app/state-officials/[id]/page.tsx:16` does `const official = await fetchOfficial(supabase, id)` with no guard. `fetchOfficial` throws on a PostgREST `.single()` miss (`packages/officials/src/queries.ts`), so a stale/garbage `id` surfaces a 500 / error boundary. The federal page handles a missing official gracefully (`apps/web/app/officials/[id]/page.tsx:84` `if (!official) redirect('/')`). **Fix:** wrap the `fetchOfficial` call in try/catch and `redirect('/')` on throw (and the downstream `fetchOfficialDistrictOffices` if it can also throw on the same bad id). Keep the existing `isStateLevel` cross-route redirect (`:18-19`).
*Plan reconciliation:* confirm `fetchOfficial`'s throw-vs-null behavior + whether the federal page uses a maybe-single variant; mirror whichever yields a clean redirect. Note: `redirect()` itself throws a Next control-flow signal — the try/catch must not swallow it (catch the fetch only, or re-throw `isRedirectError`).

### B2 — mobile detail screens hard-paint `#fff`
`apps/mobile/app/(app)/officials/[id].tsx:67` and `apps/mobile/app/(app)/state-officials/[id].tsx:34` both render `<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>`. In dark mode the shared cards repaint via `useBrandTokens()` but sit on a permanently-white page. **Fix:** call `useBrandTokens()` in each screen and use `semantic.bg.app` for the SafeAreaView background. These are the only 2 inline-hex sites in the mobile tree.
*Plan reconciliation:* confirm each screen already (or can) call `useBrandTokens()` at the top level (Rules-of-Hooks — before any early return/loading branch).

### B13 — middleware allowList missing `/issues` + `/legal`
`apps/web/middleware.ts:35` `allowList = ['/calibrate','/sign-out','/profile/edit','/settings','/settings/address']`; the gate (`:37`) redirects any non-allowlisted path to `/calibrate` for authenticated-but-uncalibrated users. Settings links to `/issues` and the home `MyIssuesCard` deep-links there; `/legal/*` are static pages. **Fix:** add `'/issues'` and `'/legal'` to the allowList (the existing `path === p || path.startsWith(p + '/')` check covers `/legal/privacy` etc.).

## 3. Tests

### Web (vitest + jsdom; mock islands/hooks per `apps/web/test/app/home-page.test.tsx`)

- **F1 — 5 route render/redirect smoke tests** (new files under `apps/web/test/app/`): `officials/[id]`, `state-officials/[id]`, `issues`, `calibrate`, `settings`. Each mocks the `@chiaro/officials-ui` islands + the domain hooks/server fns the route imports, renders the (server) page component, and asserts it mounts without throwing + its redirect/auth branches behave (e.g. `!user → redirect('/sign-in')`). For the `[id]` detail pages, also assert the happy path renders the bio/cards mock and the bad-id path redirects (B1). *(sign-in/sign-up deferred — thin AuthForm/AuthScreen wrappers, already tested in officials-ui.)*
- **F2 — page-level cross-route guard** (`apps/web/test/app/officials-route-guards.test.tsx`, upgrade): assert the actual page redirect — a state-chamber official requested on `/officials/[id]` → `redirect('/state-officials/[id]')`, and a federal official on `/state-officials/[id]` → `redirect('/officials/[id]')`, plus B1's not-found redirect. Currently the file only asserts the `isStateLevel` predicate.

### Mobile (jest-expo; top-level `jest.mock`, NEVER `resetModules` — Gotcha #11)

- **F3 — calibrate route** (`apps/mobile/test/calibrate.test.tsx`, new): mock `expo-router`, `@chiaro/supabase-client` (or the `supabase` import) `functions.invoke`, and the location-permissions helper. Assert: each error-status→message branch (400 / 422 / 502), the address-submit success → `router.replace('/')`, and the GPS path (`onGpsSubmit` → `getCurrentLocation()` → invoke with `{lat,lng}`).
- **F4 — nav guards** (`apps/mobile/test/nav-guards.test.tsx`, new): root `app/_layout.tsx` auth redirect (`!session → Redirect href="/(auth)/sign-in"`) and app `app/(app)/_layout.tsx` calibration gate (uncalibrated → `Redirect href="/calibrate"`, with the `/settings` + `/calibrate` exemptions). Mock the session/calibration sources.
- **F6 — home `subCascadeSlug` nav builder** (`apps/mobile/test/home-nav.test.tsx` or fold into an existing home test): assert the route string the home screen's `OfficialsCard` `onSelect` builds for the slug branch (`?cat=issue-positions&sub=…`) and the no-slug branch.

### officials-ui (vitest + RNW)

- **F5 — `RepAlignmentSection`** (`packages/officials-ui/test/issues/RepAlignmentSection.test.tsx`, new): mock `useRepAlignment` + `useMySelections` (from `@chiaro/issues`). Assert: (a) selections empty → renders the "set up issue priorities" CTA (calls `onSetup` on press); (b) selections present + alignment present → renders `RepAlignmentStrip`, and expand toggles the `IssueRadarOverlay`; (c) `alignment.overallPct == null` → overlay/strip suppressed (matches the `RepAlignmentStrip` State-3 guard).

## 4. Scope

**In:** B1, B2, B13 + F1 (5 routes) + F2 + F3 + F4 + F5 + F6. **Out:** sign-in/sign-up web render tests (deferred — low value); the other audit tracks (T4 dark-mode residue, T6 polish). No refactor beyond the bug fixes + the test additions. F7 (thin issues-component tests) stays in T6.

## 5. Method

The bugs are TDD where a test can express them (B1: a bad-id test that 500s/throws before the fix, redirects after — this doubles as F2's not-found case; B13: a middleware test asserting `/issues` is allow-listed). B2 is a render-style assertion (the SafeAreaView bg resolves to `semantic.bg.app`, not `#fff` — assert via the mobile screen test or a snapshot of the style). The pure test-coverage items (F1/F3/F4/F5/F6) are added against current behavior (they pass once written, locking the behavior + closing the gap) — but each is written to genuinely exercise the route's logic (mount + redirect branches), not a hollow render.

Group commits by area/finding (web bugs, web tests, mobile bug+tests, officials-ui test).

## 6. Verification (Gotcha #30)

`pnpm -r typecheck` · `pnpm --filter @chiaro/officials-ui test` · `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test` (the new route tests run here) · `pnpm --filter @chiaro/mobile test` (the new jest-expo tests). Ship via PR with all 4 CI jobs green.

## 7. Open items for the plan to reconcile against live code

1. `fetchOfficial` throw-vs-null semantics + whether the federal page uses a maybe-single variant (B1) + the `isRedirectError` re-throw nuance so the try/catch doesn't swallow `redirect()`'s control-flow throw.
2. The exact island/hook mock surface each of the 5 web routes needs (read each `page.tsx` + its `*Client.tsx` imports) — mirror `home-page.test.tsx`'s `vi.mock` set.
3. Mobile calibrate route shape (`apps/mobile/app/(app)/calibrate.tsx`): the status→message mapping + the `onGpsSubmit`/`getCurrentLocation` wiring + which modules to mock.
4. Mobile `_layout` files: how session + calibration state are sourced (hooks? context? a loading gate) so F4 can mock them without `resetModules`.
5. `RepAlignmentSection.tsx`: its exact prop/hook surface + the State-1/2/3 conditions (CTA vs strip vs suppressed) to mirror in F5.
6. The home screen's `subCascadeSlug`/`onSelect` URL-builder location + signature (F6).
7. Whether `officials-route-guards.test.tsx` can render the server page component directly (async server component) in vitest, or needs the logic extracted/mocked — pick the approach `home-page.test.tsx` uses for server pages.
