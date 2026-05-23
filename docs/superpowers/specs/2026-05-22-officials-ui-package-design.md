# Slice 10 — `@chiaro/officials-ui` shared component package

**Date:** 2026-05-22
**Scope tier:** Full slice (architectural; ~57 components migrated; new workspace package; build config change in web)
**Predecessor slices:** 7, 8, 9 (parser-wiring trio). Slice 6 (federal redesign) flagged this extraction as outstanding.

## Goal

Eliminate duplicate web + mobile implementations of the officials/state-officials/federal detail-page component tree by introducing a React-Native-Web-backed shared component package. After this slice, every business UI component (~57 files) has exactly one source of truth; only platform-specific map renderers (`DistrictMap`, `DistrictPanel`) remain duplicated.

## Motivation

The federal redesign (slice 6) converged the web + mobile card hierarchies onto identical shapes — same component names, same prop signatures, same subsection ordering. Since slice 6, every parser-wiring slice (7, 8, 9) has paid the 2× edit cost on data-shaping/display logic. The current state:

- 57 component files × 2 platforms = 114 files
- Identical prop interfaces, identical composition trees, identical inline-style camelCase shapes
- The only delta is `<div>/<span>/<h1>/<button>` (web) vs `<View>/<Text>/<Pressable>` (mobile)
- ~30 cards each independently create their own Supabase client via `useMemo(createSupabaseBrowserClient)`

This is the most visible debt in the codebase and the prerequisite for any future cross-platform feature work (e.g., a `/compare/[a]/[b]` page that would otherwise require 2× the implementation).

## Key design decisions

1. **Approach: React Native Web full conversion** (chosen over shared-logic-only or hybrid). The codebase is already 80% of the way there — web uses inline style objects with camelCase keys (same shape as RN StyleSheet), and most card components already declare `'use client'`. The conversion is largely mechanical primitive substitution, not a from-scratch rewrite.

2. **Scope: single slice** (chosen over multi-sub-slice decomposition). All 57 components migrate in one push. Mechanical nature of the conversion + isolated blast radius (one new package, one Next config change, no schema work, no domain-logic changes) makes single-slice execution lower-cost than the coordination overhead of three sub-slices.

3. **Client access: React Context** (chosen over prop-drilling or module-level setter). Mirrors existing `QueryClientProvider` pattern. One wire-up per platform at boot; ~30 components stop creating their own client; clean testability via `<Provider value={mockClient}>` wrapper in vitest.

4. **Navigation: callback props** (chosen over `<UILink>` wrapper or route-enum). Only 5 components need nav; callback prop is decoupled, trivially testable, and avoids the package.json conditional-exports fragility that a `<UILink>` would introduce.

## Architecture

### Package structure

```
packages/officials-ui/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                 # barrel
    client-context.tsx       # ChiaroClientProvider + useChiaroClient
    PartyBadge.tsx
    OfficialAvatar.tsx
    OfficialMeta.tsx
    OfficialsCard.tsx        # accepts onPress: (id) => void
    OfficialsList.tsx        # accepts onPress: (id) => void
    bio/                     # 6 files
      BioHeader.tsx
      BioPortrait.tsx
      BioIdentityRow.tsx
      BioServiceCard.tsx
      BioContactLinks.tsx
      BioAlignmentChipRow.tsx
    cards/                   # 7 files
      AlignmentChip.tsx      # accepts onPress callback (was internal next/link)
      ComingSoonCard.tsx
      ComplianceIcon.tsx
      DistrictBadge.tsx
      EvidenceExpand.tsx
      MetricCardShell.tsx
      PillChevron.tsx
    finance/                 # 3 files
      FinanceSubSectionHeading.tsx
      FinanceSummaryStrip.tsx
      TopAmountBreakdown.tsx
    federal/                 # 17 files (cards + lists)
      FederalCommunityPresenceCard.tsx
      FederalCosponsoredBillsList.tsx
      FederalDistrictOfficesList.tsx
      FederalDonorsList.tsx
      FederalEthicsAccountabilityCard.tsx
      FederalFinanceCard.tsx
      FederalIssuePositionsCard.tsx
      FederalKPIList.tsx
      FederalLeadershipList.tsx
      FederalMissedVotesList.tsx
      FederalPACsList.tsx
      FederalScorecardRatingsList.tsx
      FederalServiceRecordCard.tsx
      FederalSponsoredBillsList.tsx
      FederalStockTransactionsList.tsx
      FederalTownHallsList.tsx
      FederalVotingBillsCard.tsx
    state/                   # 19 files (cards + lists + evidence panels)
      StateBillsEvidence.tsx
      StateCommitteeHearingsList.tsx
      StateCommunityPresenceCard.tsx
      StateConductCard.tsx
      StateDistrictOfficesList.tsx
      StateDonorsEvidence.tsx
      StateEthicsComplaintsList.tsx
      StateFinanceCard.tsx
      StateFinancialActivityCard.tsx
      StateFinancialDisclosuresList.tsx
      StateIssuePositionsCard.tsx
      StateIssueVotesEvidence.tsx
      StateOfficialDetailPage.tsx
      StateOfficialEventsList.tsx
      StateOfficialsCardSection.tsx  # accepts onPress
      StateServiceRecordCard.tsx
      StateStockTransactionsList.tsx
      StateTownHallsList.tsx
      StateVotesEvidence.tsx
  test/                      # vitest + jsdom + RNW alias
    bio/ cards/ finance/ federal/ state/
    PartyBadge.test.tsx
    ...
```

Net component count: 57 shared components in the package (5 top-level + 6 bio + 7 cards + 3 finance + 17 federal + 19 state) plus `client-context.tsx`. Mirrors the current `apps/web/components/` tree exactly.

### What stays in apps

- `apps/web/components/DistrictMap.tsx` + `DistrictPanel.tsx` (react-leaflet — web-only)
- `apps/mobile/components/DistrictMap.tsx` + `DistrictPanel.tsx` (react-native-maps — mobile-only)
- All `apps/*/app/**/page.tsx` route files (composition layer; pass `client` via Provider + nav callbacks via props)
- `apps/web/lib/supabase/client.ts` (factory function — only its invocation moves to layout)

### Package dependencies

```
@chiaro/officials-ui
  ├── react                            (peer)
  ├── react-native                     (peer)
  ├── react-native-web                 (peer — for web consumers)
  ├── @chiaro/supabase-client          (ChiaroClient type)
  ├── @chiaro/officials                (queries + hooks + types)
  ├── @chiaro/state-bills              (queries + hooks + types)
  ├── @chiaro/bills                    (queries + hooks + types)
  ├── @chiaro/location                 (queries + hooks + types)
  └── @chiaro/ui-tokens                (COLORS, PARTY_*, MAP_COLORS, ...)
```

Dependency direction stays one-way (Gotcha #4): `officials-ui` depends on domain packages; domain packages never import from `officials-ui`.

## Build & tooling

### Web (Next 15)

1. `apps/web/package.json`: add `"react-native-web": "^0.19"` to deps; add `@chiaro/officials-ui: "workspace:*"`.
2. `apps/web/next.config.mjs`:
   - Add `transpilePackages: ['@chiaro/officials-ui']` (alongside any existing entries).
   - In `webpack(config)` callback: `config.resolve.alias['react-native$'] = 'react-native-web'`.
   - Turbopack equivalent in `experimental.turbo.resolveAlias` if the dev server uses turbo.
3. Accept ~30KB gzipped bundle-size addition. Mitigated by Next route-level code-splitting.

### Mobile (Expo SDK 54)

1. `apps/mobile/package.json`: add `"@chiaro/officials-ui": "workspace:*"`.
2. Metro auto-resolves via existing pnpm workspace + Metro config.
3. `apps/mobile/jest.config.cjs` `transformIgnorePatterns` allowlist already covers `@chiaro/*` — no change.

### Package itself

- `packages/officials-ui/package.json`: `"main": "./src/index.ts"`, `"types": "./src/index.ts"`, `"exports": { ".": "./src/index.ts" }`. Source-import pattern matching `@chiaro/bills`, `@chiaro/state-bills`, `@chiaro/officials`.
- No dist build; consumers transpile source through their respective bundlers.
- Peer-only `react-native`: web resolves via RNW alias; mobile resolves via Expo's bundled react-native.

### Tests

- `packages/officials-ui/vitest.config.ts`: jsdom environment + `resolve.alias: { 'react-native': 'react-native-web' }`. Mirrors what Next runtime does.
- Single test source: `packages/officials-ui/test/**` exercises all 57 components via vitest+RNW.
- `apps/web/test/components/{bio,cards,federal,state,finance}/**` — **deleted** (replaced by package tests).
- `apps/mobile/test/components/{bio,cards,federal,state,finance}/**` — **deleted** (jest-expo dynamic-mock gotcha #11 stops biting since these tests no longer exist).
- `apps/web/test/components/DistrictPanel*.test.tsx` (if any) + `apps/mobile/test/components/DistrictPanel*.test.tsx` — **stay** (map components stay platform-specific).

## RSC/SSR boundary

### `ChiaroClientProvider` (`src/client-context.tsx`)

```tsx
'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const ChiaroClientContext = createContext<ChiaroClient | null>(null)

export function ChiaroClientProvider({
  client,
  children,
}: { client: ChiaroClient; children: ReactNode }): React.JSX.Element {
  return <ChiaroClientContext.Provider value={client}>{children}</ChiaroClientContext.Provider>
}

export function useChiaroClient(): ChiaroClient {
  const c = useContext(ChiaroClientContext)
  if (!c) throw new Error('useChiaroClient must be used inside <ChiaroClientProvider>')
  return c
}
```

The `'use client'` directive scopes only this file. Components in the same package that don't use `useChiaroClient()` (pure-presentational, e.g., `BioHeader`, `PartyBadge`) stay free of the directive and can be consumed as Server Components.

### Web wire-up (`apps/web/app/layout.tsx` or `apps/web/app/providers.tsx`)

Existing Providers wrapper adds `<ChiaroClientProvider client={createSupabaseBrowserClient()}>` around `<QueryClientProvider>`. Single mount; client is created once per browser session.

### Mobile wire-up (`apps/mobile/app/_layout.tsx`)

Existing root layout adds `<ChiaroClientProvider client={mobileChiaroClient}>` around `<QueryClientProvider>`. `mobileChiaroClient` already exists at boot.

### Per-card refactor

```diff
- import { createSupabaseBrowserClient } from '@/lib/supabase/client'
- const client = useMemo(() => createSupabaseBrowserClient(), [])
+ import { useChiaroClient } from '@chiaro/officials-ui'
+ const client = useChiaroClient()
```

Net: each card loses 2 lines, gains 1. Applied to all ~30 cards that previously held their own client.

### SSR safety

No server-side `<ChiaroClientProvider>` mount in v1 — today's cards fetch via TanStack on the client. RSC pages that pre-fetch via `createSupabaseServerClient()` continue to pass data as props. Multi-tenant request leakage is not a risk because the Provider is a `'use client'` boundary mounted in `layout.tsx`; Context never crosses request boundaries.

## Primitives translation rules

A mechanical playbook applied to every component (no per-file judgment):

### Element substitutions

| Web | Shared | Notes |
|---|---|---|
| `<div>` | `<View>` | container |
| `<section aria-label="X">` | `<View accessibilityRole="summary" accessibilityLabel="X">` | landmark lost; AT label preserved |
| `<h1>` / `<h2>` / `<h3>` | `<Text accessibilityRole="header" accessibilityLevel={1\|2\|3}>` | semantic heading preserved for AT |
| `<p>`, `<span>` | `<Text>` | RN requires text inside `<Text>` |
| `<button>` | `<Pressable>` | RNW maps to role=button |
| `<a href>` | `<Text accessibilityRole="link" onPress>` | nav callback prop |
| `<ul>` / `<li>` | `<View>` rows | list semantics lost — accept |
| `<img>` | `<Image source={{ uri }}>` | only in OfficialAvatar / BioPortrait |

### Style normalizations

| Web | Shared |
|---|---|
| `padding: '24px 16px'` | `paddingVertical: 24, paddingHorizontal: 16` |
| `padding: '6px 0'` | `paddingVertical: 6, paddingHorizontal: 0` |
| `margin: '0 auto'` | drop (centering via parent `alignItems: 'center'`) |
| `fontSize: '1.5rem'` | `fontSize: 24` (1rem = 16px convention) |
| `fontWeight: 700` (number) | `fontWeight: '700'` (string — RN-strict) |
| `cursor: 'pointer'` | drop (Pressable handles cursor on web) |
| `borderTop: '1px solid #ccc'` | `borderTopWidth: 1, borderTopColor: '#ccc'` |
| `display: 'flex'` | drop (RN defaults to flex) |
| `flexDirection: 'column'` | drop (RN default; keep `'row'` when explicit) |
| `textAlign: 'center'` on container | move to inner `<Text>` (RN: textAlign is Text-only) |
| `background: 'transparent'` | `backgroundColor: 'transparent'` |

### Attribute renames

| Web | Shared |
|---|---|
| `aria-label` | `accessibilityLabel` |
| `aria-hidden` | `accessibilityElementsHidden` + `importantForAccessibility="no"` |
| `onClick` | `onPress` |
| `tabIndex` | drop |
| `role` | `accessibilityRole` |
| `disabled` on `<button>` | `disabled` on `<Pressable>` |

### Verified non-issues

- No CSS `:hover` / `:focus` pseudo-states (current web uses inline style objects only — no CSS modules, no Tailwind).
- No `dangerouslySetInnerHTML` in any of the 57 components.
- No form inputs in any of the 57 components (forms live in `app/profile/edit/` etc. — out of scope).

## Migration sequence

Six internal phases on the single `slice-10-officials-ui` branch:

1. **Phase 1 — scaffold + provider:** create package skeleton (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/client-context.tsx`). Wire `ChiaroClientProvider` into both apps' root layouts. Add `react-native-web` to web. Verify both apps still boot. ~5 files.
2. **Phase 2 — leaf primitives:** port `PartyBadge`, `OfficialAvatar`, `OfficialMeta`, `cards/*` (7), `bio/*` atoms (5 — all but `BioHeader`, which composes them and lives in this phase too = 6), `finance/*` (3). No domain-data dependencies. Delete originals on both platforms. Update imports. ~19 files moved, ~38 deleted.
3. **Phase 3 — containers:** port `federal/*` (17) and `state/*` (19). Each card converts `useMemo(createClient)` → `useChiaroClient()`. Delete originals. ~36 files moved, ~72 deleted.
4. **Phase 4 — list/page-level + nav:** port `OfficialsList`, `OfficialsCard`, `state/StateOfficialsCardSection`. Add `onPress: (id: string) => void` callback prop. Web + mobile pages pass nav callback via expo-router/Next router. `cards/AlignmentChip` likewise. ~5 files.
5. **Phase 5 — test consolidation:** delete `apps/{web,mobile}/test/components/{bio,cards,federal,state,finance}/**`. Create `packages/officials-ui/test/**` with vitest+RNW. Port existing assertions. ~50 test files net.
6. **Phase 6 — verify:** typecheck, full test suite, web build, web dev-server visual smoke, mobile Metro visual smoke. CLAUDE.md update with slice 10 entry + new gotcha if any emerges during implementation.

## Tests & acceptance

### Test split

| Layer | Location | Runner |
|---|---|---|
| Shared component | `packages/officials-ui/test/**` | vitest + jsdom + RNW alias |
| Web page integration | `apps/web/test/**` (composition tests stay) | vitest |
| Mobile page integration | `apps/mobile/test/**` (trimmed) | jest-expo |
| pgTAP / db | `packages/db/test/**` | unchanged |

Net: ~50 fewer test files, same coverage surface, single source of truth per component.

### Acceptance criteria

1. `pnpm -r typecheck` green across 11 packages (10 → 11).
2. `pnpm test` green (full workspace turbo).
3. `pnpm --filter @chiaro/web build` succeeds.
4. Web visual parity at `/officials/[bioguide]`, `/state-officials/[id]`, `/` (calibrated home).
5. Mobile visual parity via `pnpm --filter @chiaro/mobile dev` Metro build.
6. Sentry source-map upload still succeeds in CI build job.
7. CLAUDE.md slice 10 entry added; new gotcha if any emerges; otherwise no Gotchas list growth.

### Non-goals

- DistrictMap / DistrictPanel migration to shared — documented asymmetry; out of scope.
- Server-side `<ChiaroClientProvider>` mount — deferred until a future slice needs RSC-fetched data inside cards.
- Tailwind or CSS-in-JS adoption — current inline-style pattern is preserved end-to-end by RNW.
- `transpilePackages` migration for other `@chiaro/*` packages — only `officials-ui` is added; others stay source-import.
- New features or visual changes — refactor only; visual parity is the bar.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Next 15 turbopack RNW alias drift | Medium | Pin `react-native-web` version. CI `build` job smoke-tests every PR. Web dev-server boot is the first verification gate in Phase 1. |
| jest-expo dynamic-mock gotcha (#11) infecting new tests | Low | Shared tests use vitest+RNW (sidesteps jest-expo entirely). |
| Source map paths break Sentry upload | Low | `@chiaro/officials-ui` is workspace-source-imported, so Next/Webpack treats it as in-tree TS. Existing Sentry upload globs already cover compiled output. |
| `'use client'` directive transitive taint | Low | Provider is the only `'use client'` file in `client-context.tsx`. Pure-presentational components (e.g., `BioHeader`) stay directive-free. Audited explicitly in Phase 2. |
| RNW heading semantics drift on web | Low | `accessibilityRole="header"` maps to `role="heading"` in RNW DOM. Existing vitest `getByRole('heading', { name: ... })` queries pass unchanged. Verified in Phase 5 test port. |
| Bundle size regression on web | Accepted | ~30KB gzipped is the documented cost of RNW; mitigated by route-level code splitting that already exists. |

## Estimated commit count & branch handoff

~10-15 commits on `slice-10-officials-ui`:
- 1 spec + 1 plan
- 6 implementation phases (each ~1-2 commits)
- 1 CLAUDE.md slice 10 entry
- 1 cleanup/closure

Squash-merge to master locally per established slice-handoff pattern.

## Cross-references

- Slice 6 closure noted `@chiaro/officials-ui` extraction as pending.
- Gotcha #4 (workspace dependency direction is one-way) — preserved.
- Gotcha #11 (jest-expo dynamic mock) — sidestepped by moving tests to vitest+RNW.
- Gotcha #15 (federal/state intentional UI asymmetries) — unchanged; same components, same compositions.

## Open questions

None. All 4 cross-cutting decisions resolved during brainstorming. Remaining detail-level decisions resolved in the implementation plan.
