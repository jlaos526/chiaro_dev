# `@chiaro/officials-ui` Shared Component Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 57 web + mobile officials UI components into a single React-Native-Web-backed workspace package (`@chiaro/officials-ui`), eliminating ~114 → ~57 duplicate component files. Map components stay platform-specific.

**Architecture:** New workspace package at `packages/officials-ui/` consumed by both `apps/web` (via `react-native-web` alias + Next 15 `transpilePackages`) and `apps/mobile` (Expo Metro auto-resolves workspace deps). Components are written once using React Native primitives (`<View>`, `<Text>`, `<Pressable>`, `<Image>`). Supabase client is provided via React Context (`ChiaroClientProvider`), eliminating ~30 per-card `useMemo(createSupabaseBrowserClient)` calls. Page-level navigation is callback-driven (`onPress: (id: string) => void`).

**Tech Stack:** React 19, React Native (mobile), `react-native-web@^0.19` (web), Next 15 App Router, Expo SDK 54, TanStack Query (existing), Supabase JS, vitest + jsdom (shared component tests), TypeScript strict mode.

**Prerequisite reading:** `docs/superpowers/specs/2026-05-22-officials-ui-package-design.md`.

---

## File Structure

### Created files

```
packages/officials-ui/
  package.json                          # NEW — workspace package manifest
  tsconfig.json                         # NEW — extends ../../tsconfig.base.json
  vitest.config.ts                      # NEW — jsdom + RNW alias
  src/
    index.ts                            # NEW — barrel re-exports
    client-context.tsx                  # NEW — Provider + hook ('use client')
    PartyBadge.tsx                      # NEW — moved from apps/{web,mobile}
    OfficialAvatar.tsx                  # NEW
    OfficialMeta.tsx                    # NEW
    OfficialsCard.tsx                   # NEW — gains onSelect prop
    OfficialsList.tsx                   # NEW — gains onSelect prop
    bio/
      BioHeader.tsx                     # NEW
      BioPortrait.tsx                   # NEW
      BioIdentityRow.tsx                # NEW
      BioServiceCard.tsx                # NEW
      BioContactLinks.tsx               # NEW
      BioAlignmentChipRow.tsx           # NEW
    cards/
      AlignmentChip.tsx                 # NEW — gains onPress prop
      ComingSoonCard.tsx                # NEW
      ComplianceIcon.tsx                # NEW
      DistrictBadge.tsx                 # NEW
      EvidenceExpand.tsx                # NEW
      MetricCardShell.tsx               # NEW
      PillChevron.tsx                   # NEW
    finance/
      FinanceSubSectionHeading.tsx      # NEW
      FinanceSummaryStrip.tsx           # NEW
      TopAmountBreakdown.tsx            # NEW
    federal/
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
    state/
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
      StateOfficialsCardSection.tsx     # gains onSelect prop
      StateServiceRecordCard.tsx
      StateStockTransactionsList.tsx
      StateTownHallsList.tsx
      StateVotesEvidence.tsx
  test/
    setup.ts                            # NEW — afterEach cleanup
    PartyBadge.test.tsx                 # NEW — ported from web
    OfficialAvatar.test.tsx
    ... (1 test file per component)
```

### Modified files

```
apps/web/package.json                   # add react-native-web + @chiaro/officials-ui deps
apps/web/next.config.mjs                # add officials-ui to transpilePackages + webpack alias
apps/web/app/layout.tsx                 # mount ChiaroClientProvider
apps/web/lib/query-client.tsx           # extend to also wrap ChiaroClientProvider (one mount point)
apps/web/app/page.tsx                   # pass onSelect callback to OfficialsCard
apps/web/app/officials/page.tsx         # pass onSelect callback to OfficialsList
apps/web/app/officials/[id]/page.tsx    # import from @chiaro/officials-ui instead of local
apps/web/app/state-officials/[id]/page.tsx  # same
apps/mobile/package.json                # add @chiaro/officials-ui dep
apps/mobile/app/_layout.tsx             # mount ChiaroClientProvider
apps/mobile/app/(app)/index.tsx         # pass onSelect callback
apps/mobile/app/(app)/officials/[id].tsx    # import from @chiaro/officials-ui
apps/mobile/app/(app)/state-officials/[id].tsx  # same
pnpm-workspace.yaml                     # (auto-updates via `pnpm install` — no manual edit)
CLAUDE.md                               # slice 10 entry + any new gotchas
```

### Deleted files

All component files under (preserved files: `DistrictMap.tsx`, `DistrictPanel.tsx`):

```
apps/web/components/{PartyBadge,OfficialAvatar,OfficialMeta,OfficialsCard,OfficialsList}.tsx
apps/web/components/{bio,cards,finance,federal,state}/**.tsx (except DistrictMap, DistrictPanel)
apps/web/test/components/**.test.tsx
apps/mobile/components/{PartyBadge,OfficialAvatar,OfficialMeta,OfficialsCard,OfficialsList}.tsx
apps/mobile/components/{bio,cards,finance,federal,state}/**.tsx (except DistrictMap, DistrictPanel)
apps/mobile/test/components/{bio,cards,finance,federal,state}/**.test.tsx (preserved: DistrictPanel + DistrictMap tests if any)
```

---

## Universal translation reference

This rule set applies to every component port. Implementers should refer back here on each file.

### Element substitutions

| Web JSX | Shared (RN) | Notes |
|---|---|---|
| `<div>` | `<View>` | |
| `<section aria-label="X">` | `<View accessibilityLabel="X">` | |
| `<h1>` / `<h2>` / `<h3>` | `<Text accessibilityRole="header" accessibilityLevel={N}>` | |
| `<p>` / `<span>` / `<strong>` / `<small>` | `<Text>` | text must be in `<Text>` |
| `<button>` | `<Pressable>` | |
| `<a href>` | `<Pressable>` with `accessibilityRole="link"` + caller-provided `onPress` | |
| `<ul>` / `<li>` | `<View>` rows | list semantics dropped |
| `<img src>` | `<Image source={{ uri: src }}>` | only OfficialAvatar / BioPortrait |
| `aria-label` | `accessibilityLabel` | |
| `onClick` | `onPress` | |
| `role` | `accessibilityRole` | |

### Style normalizations

| Web inline style | Shared (RN StyleSheet) |
|---|---|
| `padding: '24px 16px'` | `paddingVertical: 24, paddingHorizontal: 16` |
| `margin: '0 auto'` | drop (use parent `alignItems: 'center'`) |
| `fontSize: '1.5rem'` (string) | `fontSize: 24` (number, 1rem=16px) |
| `fontWeight: 700` (number) | `fontWeight: '700'` (string) |
| `cursor: 'pointer'` | drop |
| `borderTop: '1px solid #ccc'` | `borderTopWidth: 1, borderTopColor: '#ccc'` |
| `display: 'flex'` / `flexDirection: 'column'` | drop (RN defaults) |
| `textAlign` on container | move to inner `<Text>` |
| `background: '#...'` | `backgroundColor: '#...'` |
| `lineHeight: 1.4` (unitless) | `lineHeight: 16` (numeric, in px) |

### Per-card refactor pattern

```diff
- import { useMemo } from 'react'
- import { createSupabaseBrowserClient } from '@/lib/supabase/client'
- const client = useMemo(() => createSupabaseBrowserClient(), [])
+ import { useChiaroClient } from '@chiaro/officials-ui'
+ const client = useChiaroClient()
```

Or for module-top-level pattern (e.g., `OfficialsCard`, `OfficialsList`):

```diff
- import { createSupabaseBrowserClient } from '@/lib/supabase/client'
- const client = createSupabaseBrowserClient()
+ import { useChiaroClient } from '@chiaro/officials-ui'
+ // inside component body:
+ const client = useChiaroClient()
```

Mobile equivalent:

```diff
- import { supabase } from '@/lib/supabase'
- // ... useXxx(supabase, ...)
+ import { useChiaroClient } from '@chiaro/officials-ui'
+ const client = useChiaroClient()
+ // ... useXxx(client, ...)
```

---

## Task 1: Scaffold `@chiaro/officials-ui` package

**Files:**
- Create: `packages/officials-ui/package.json`
- Create: `packages/officials-ui/tsconfig.json`
- Create: `packages/officials-ui/vitest.config.ts`
- Create: `packages/officials-ui/src/index.ts`
- Create: `packages/officials-ui/test/setup.ts`

- [ ] **Step 1: Create `packages/officials-ui/package.json`**

```json
{
  "name": "@chiaro/officials-ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chiaro/bills": "workspace:*",
    "@chiaro/db": "workspace:*",
    "@chiaro/location": "workspace:*",
    "@chiaro/officials": "workspace:*",
    "@chiaro/state-bills": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "@chiaro/ui-tokens": "workspace:*"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^19.0.0",
    "react-native": "*"
  },
  "devDependencies": {
    "@tanstack/react-query": "^5.59.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/dom": "^10.4.0",
    "@types/react": "^19.0.0",
    "jsdom": "^25.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-native": "0.76.3",
    "react-native-web": "^0.19.13",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/officials-ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "react-jsx",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `packages/officials-ui/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15_000,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
})
```

- [ ] **Step 4: Create `packages/officials-ui/src/index.ts` (initial — will be populated component-by-component)**

```ts
// Public surface of @chiaro/officials-ui. Re-exported component-by-component
// in subsequent tasks. See barrel additions in each Task.

export { ChiaroClientProvider, useChiaroClient } from './client-context.tsx'
```

- [ ] **Step 5: Create `packages/officials-ui/test/setup.ts`**

```ts
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 6: Install deps and verify package resolves**

Run: `pnpm install`
Expected: `+ @chiaro/officials-ui ...` in install output (resolved as workspace member). No errors.

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS (no source yet, but config is valid). May fail if `client-context.tsx` doesn't exist yet — acceptable; will be created in Task 2.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui pnpm-lock.yaml
git commit -m "feat(officials-ui): scaffold @chiaro/officials-ui workspace package

Empty package with vitest+RNW config, tsconfig extending repo base,
and barrel index.ts that will be populated component-by-component.

Workspace count 10 → 11."
```

---

## Task 2: Implement `ChiaroClientProvider` + `useChiaroClient`

**Files:**
- Create: `packages/officials-ui/src/client-context.tsx`
- Create: `packages/officials-ui/test/client-context.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/client-context.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Text, View } from 'react-native'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { ChiaroClientProvider, useChiaroClient } from '../src/client-context.tsx'

function Probe() {
  const c = useChiaroClient()
  return <Text testID="probe">{c ? 'client' : 'null'}</Text>
}

describe('ChiaroClientProvider', () => {
  it('exposes client to descendants via useChiaroClient', () => {
    const fakeClient = { from: () => {} } as unknown as ChiaroClient
    const { getByTestId } = render(
      <ChiaroClientProvider client={fakeClient}>
        <Probe />
      </ChiaroClientProvider>,
    )
    expect(getByTestId('probe').textContent).toBe('client')
  })

  it('throws when used without a Provider', () => {
    const orig = console.error
    console.error = () => {}
    try {
      expect(() => render(<View><Probe /></View>)).toThrow(
        /useChiaroClient must be used inside <ChiaroClientProvider>/,
      )
    } finally {
      console.error = orig
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: FAIL — `Cannot find module '../src/client-context.tsx'`.

- [ ] **Step 3: Implement the Provider + hook**

Create `packages/officials-ui/src/client-context.tsx`:

```tsx
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const ChiaroClientContext = createContext<ChiaroClient | null>(null)

export interface ChiaroClientProviderProps {
  client: ChiaroClient
  children: ReactNode
}

export function ChiaroClientProvider({
  client,
  children,
}: ChiaroClientProviderProps): React.JSX.Element {
  return (
    <ChiaroClientContext.Provider value={client}>
      {children}
    </ChiaroClientContext.Provider>
  )
}

export function useChiaroClient(): ChiaroClient {
  const c = useContext(ChiaroClientContext)
  if (!c) {
    throw new Error('useChiaroClient must be used inside <ChiaroClientProvider>')
  }
  return c
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS (2 tests in client-context.test.tsx).

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/client-context.tsx packages/officials-ui/test/client-context.test.tsx
git commit -m "feat(officials-ui): add ChiaroClientProvider + useChiaroClient hook

React Context provider + hook for the shared Supabase client. Each
platform mounts the provider once at app boot; shared components
call useChiaroClient() instead of creating their own client per-card."
```

---

## Task 3: Wire web — RNW + `transpilePackages` + Provider mount

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/web/lib/query-client.tsx`
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1: Add deps to `apps/web/package.json`**

In `dependencies`, add (sorted alphabetically with existing):

```json
    "@chiaro/officials-ui": "workspace:*",
    "react-native-web": "^0.19.13",
```

In `devDependencies`, add:

```json
    "react-native": "0.76.3",
    "@types/react-native": "^0.73.0",
```

- [ ] **Step 2: Update `apps/web/next.config.mjs` — add transpile + alias**

Replace the entire file with:

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@chiaro/db',
    '@chiaro/profile',
    '@chiaro/supabase-client',
    '@chiaro/officials-ui',
    'react-native',
    'react-native-web',
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'react-native$': 'react-native-web',
    }
    config.resolve.extensions = [
      '.web.tsx', '.web.ts', '.web.jsx', '.web.js',
      ...config.resolve.extensions,
    ]
    return config
  },
}

export default withSentryConfig(nextConfig, {
  org: 'chiaro',
  project: 'chiaro-web',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

- [ ] **Step 3: Update `apps/web/lib/query-client.tsx` — mount ChiaroClientProvider alongside QueryClient**

Replace the entire file with:

```tsx
'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChiaroClientProvider } from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from './supabase/client'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime:    5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

const chiaroClient = createSupabaseBrowserClient()

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [qc] = React.useState(getQueryClient)
  return (
    <ChiaroClientProvider client={chiaroClient}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ChiaroClientProvider>
  )
}
```

- [ ] **Step 4: Update `apps/web/vitest.config.ts` — alias `react-native` to `react-native-web` so component tests work**

Replace the entire file with:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15_000,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'react-native': 'react-native-web',
    },
  },
})
```

- [ ] **Step 5: Install + typecheck + build smoke**

Run: `pnpm install`
Expected: `react-native-web` + `@chiaro/officials-ui` resolved. No errors.

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS (component files still local; only config changed).

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Build output includes the new package. If error mentions `Cannot find module 'react-native'`, the webpack alias didn't apply — re-check Step 2.

Run: `pnpm --filter @chiaro/web dev` then open `http://localhost:3000` in a browser.
Expected: home page renders without console errors. Kill dev server after smoke.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/next.config.mjs apps/web/lib/query-client.tsx apps/web/vitest.config.ts pnpm-lock.yaml
git commit -m "build(web): wire react-native-web + ChiaroClientProvider

- Add react-native-web@0.19 + react-native peer.
- transpilePackages: @chiaro/officials-ui + react-native + react-native-web.
- Webpack alias react-native\$ → react-native-web (server + client).
- vitest aliases match so component tests work post-port.
- ChiaroClientProvider mounted inside QueryProvider singleton (single
  use-client boundary for both contexts).

Bundle-size impact ~30KB gzipped (RNW); mitigated by Next route-level
code splitting."
```

---

## Task 4: Wire mobile — Provider mount in `_layout.tsx`

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Add dep to `apps/mobile/package.json`**

In `dependencies`, add (sorted alphabetically with existing):

```json
    "@chiaro/officials-ui": "workspace:*",
```

- [ ] **Step 2: Update `apps/mobile/app/_layout.tsx`**

Replace the entire file with:

```tsx
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { QueryProvider } from '@/lib/query-client'
import { ErrorBoundary, initSentry } from '@/lib/sentry'
import { supabase } from '@/lib/supabase'
import { ChiaroClientProvider } from '@chiaro/officials-ui'
import type { Session } from '@supabase/supabase-js'

initSentry()

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!loaded) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) router.replace('/(auth)/sign-in')
    else if (session && inAuthGroup) router.replace('/(app)')
  }, [session, loaded, segments])

  if (!loaded) {
    return (
      <ErrorBoundary>
        <ChiaroClientProvider client={supabase}>
          <QueryProvider>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
            </View>
          </QueryProvider>
        </ChiaroClientProvider>
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <ChiaroClientProvider client={supabase}>
        <QueryProvider>
          <Slot />
        </QueryProvider>
      </ChiaroClientProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: Install + typecheck**

Run: `pnpm install`
Expected: `@chiaro/officials-ui` resolved as mobile dep.

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app/_layout.tsx pnpm-lock.yaml
git commit -m "build(mobile): wire ChiaroClientProvider into root layout

Mounts ChiaroClientProvider once at boot using existing supabase
singleton. No bundler changes — Metro auto-resolves workspace dep."
```

---

## Task 5: Port leaf primitives — top-level + cards/* (10 files)

**Files:**
- Create: `packages/officials-ui/src/PartyBadge.tsx`
- Create: `packages/officials-ui/src/OfficialAvatar.tsx`
- Create: `packages/officials-ui/src/OfficialMeta.tsx`
- Create: `packages/officials-ui/src/cards/AlignmentChip.tsx` (deferred to Task 11 — depends on nav callback)
- Create: `packages/officials-ui/src/cards/ComingSoonCard.tsx`
- Create: `packages/officials-ui/src/cards/ComplianceIcon.tsx`
- Create: `packages/officials-ui/src/cards/DistrictBadge.tsx`
- Create: `packages/officials-ui/src/cards/EvidenceExpand.tsx`
- Create: `packages/officials-ui/src/cards/MetricCardShell.tsx`
- Create: `packages/officials-ui/src/cards/PillChevron.tsx`
- Create: `packages/officials-ui/test/PartyBadge.test.tsx`
- Create: `packages/officials-ui/test/cards/ComingSoonCard.test.tsx`
- Create: `packages/officials-ui/test/cards/{ComplianceIcon,DistrictBadge,EvidenceExpand,MetricCardShell,PillChevron}.test.tsx`
- Delete: `apps/web/components/{PartyBadge,OfficialAvatar,OfficialMeta}.tsx`
- Delete: `apps/web/components/cards/{ComingSoonCard,ComplianceIcon,DistrictBadge,EvidenceExpand,MetricCardShell,PillChevron}.tsx`
- Delete: `apps/mobile/components/{PartyBadge,OfficialAvatar,OfficialMeta}.tsx`
- Delete: `apps/mobile/components/cards/{ComingSoonCard,ComplianceIcon,DistrictBadge,EvidenceExpand,MetricCardShell,PillChevron}.tsx`
- Delete: `apps/web/test/components/cards/{ComingSoonCard,ComplianceIcon,DistrictBadge,EvidenceExpand,MetricCardShell,PillChevron}.test.tsx`
- Delete: `apps/mobile/test/components/cards/{...}.test.tsx` (if any)
- Modify: `packages/officials-ui/src/index.ts` — add re-exports
- Modify: import sites in `apps/web/components/` + `apps/mobile/components/` that referenced these — switch to `@chiaro/officials-ui`

### Canonical example — PartyBadge

This task ports 9 components (the 10th, `cards/AlignmentChip`, has navigation and is deferred to Task 11). Below is the full port of `PartyBadge` as the reference example. Apply the same pattern (RN primitives, style normalizations from the Universal translation reference, accessibility attributes, barrel re-export) to the remaining 8 components.

- [ ] **Step 1: Write the failing test for PartyBadge**

Create `packages/officials-ui/test/PartyBadge.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartyBadge } from '../src/PartyBadge.tsx'

describe('PartyBadge', () => {
  it('renders short party code for Democratic', () => {
    const { getByText } = render(<PartyBadge party="Democratic" />)
    expect(getByText('D')).toBeTruthy()
  })

  it('renders short party code for Republican', () => {
    const { getByText } = render(<PartyBadge party="Republican" />)
    expect(getByText('R')).toBeTruthy()
  })

  it('renders accessibility label with full party name', () => {
    const { container } = render(<PartyBadge party="Democratic" />)
    expect(container.querySelector('[aria-label="Democratic"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: FAIL — `Cannot find module '../src/PartyBadge.tsx'`.

- [ ] **Step 3: Implement `packages/officials-ui/src/PartyBadge.tsx`**

```tsx
import { Text, View } from 'react-native'
import { PARTY_COLOR, PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'

export interface PartyBadgeProps {
  party: PartyCode
}

export function PartyBadge({ party }: PartyBadgeProps): React.JSX.Element {
  return (
    <View
      accessibilityLabel={PARTY_LABEL[party]}
      style={{
        backgroundColor: PARTY_COLOR[party],
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, lineHeight: 17 }}>
        {PARTY_SHORT[party]}
      </Text>
    </View>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS for PartyBadge tests.

- [ ] **Step 5: Add to barrel + delete the 2 platform-specific copies**

Edit `packages/officials-ui/src/index.ts` — append:

```ts
export { PartyBadge, type PartyBadgeProps } from './PartyBadge.tsx'
```

Delete:
- `apps/web/components/PartyBadge.tsx`
- `apps/mobile/components/PartyBadge.tsx`

- [ ] **Step 6: Update import sites for PartyBadge**

Run: `grep -rn "from './PartyBadge'\|from '\\./PartyBadge'\|from '@/components/PartyBadge'" apps/`
Note: Use the Grep tool (not raw grep). For each file found, replace import line with:

```ts
import { PartyBadge } from '@chiaro/officials-ui'
```

Same for relative `./PartyBadge` from sibling components — they may still need to find PartyBadge; update those imports too. Sites known from spec audit: `apps/web/components/OfficialsList.tsx`, `apps/mobile/components/OfficialsList.tsx`. These files are themselves being moved in Task 11; for now just leave them with stale imports — Task 11 ports them and fixes the import.

Wait — leaving stale imports breaks the app between tasks. Instead, update both `OfficialsList.tsx` files in-place now (without porting them yet), changing only the import line.

- [ ] **Step 7: Verify web + mobile still compile**

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Repeat Steps 1–7 for each remaining component in this task**

Apply the same flow (test → fail → implement → pass → barrel + delete originals → update imports → verify) to each component below. Reference file lists & specifics:

#### `OfficialAvatar` (apps/web/components/OfficialAvatar.tsx + apps/mobile/components/OfficialAvatar.tsx)

Mobile version uses `<Image>`; web version uses `<img>`. Shared version uses `<Image source={{ uri }}>`. Props: `fullName`, `portraitUrl: string | null`, `size: number`. Fallback (no portraitUrl): render `<View>` with initial letter inside `<Text>`. Test asserts both branches.

#### `OfficialMeta`

Pure-text. Props: `official: OfficialWithDistrict` (type from `@chiaro/officials`). Renders party + state + district as `<Text>` with no nav. Test asserts party shorthand + state appear.

#### `cards/ComingSoonCard`

Read the canonical implementation above (already RN-shaped). Move verbatim — keep `accessibilityRole="header"` style hint on the title `<Text>` if web version used `<h?>`. Test asserts both lines render for `category="Service Record"`.

#### `cards/ComplianceIcon`

Renders a colored badge/icon for a STOCK-Act compliance state. Props per existing web file. Test asserts icon + label for `compliant` / `non-compliant` / `unknown`.

#### `cards/DistrictBadge`

Renders chamber + district label. Props per existing web file (`chamber`, `stateName`, `stateAbbrev`, `districtNumber`, `atLarge`). Test asserts `WY at-large`, `CA-12`, `Senate` for chamber=federal_senate.

#### `cards/EvidenceExpand`

Disclosure-triangle wrapper that toggles visibility. Props: `label`, `children`. Uses `<Pressable>` + `useState`. Test asserts toggle open/close.

#### `cards/MetricCardShell`

Card chrome: rounded border, title row, body slot. Props per existing web file. Test asserts title + children render.

#### `cards/PillChevron`

Right-chevron `▸` / down-chevron `▾`. Pure-display. Test asserts the correct character for `open=true|false`.

- [ ] **Step 9: Run all tests + typecheck after the batch**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: ~30 tests PASS (3+ per component × 9 components).

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile
git commit -m "feat(officials-ui): port leaf primitives — top-level + cards/

9 components moved into the shared package using RN primitives.
Web/mobile copies deleted. Apps updated to import from
@chiaro/officials-ui.

- PartyBadge, OfficialAvatar, OfficialMeta (top-level)
- ComingSoonCard, ComplianceIcon, DistrictBadge, EvidenceExpand,
  MetricCardShell, PillChevron (cards/)

(cards/AlignmentChip deferred to nav-callback task)"
```

---

## Task 6: Port bio/* + finance/* (9 files)

**Files:**
- Create: `packages/officials-ui/src/bio/{BioHeader,BioPortrait,BioIdentityRow,BioServiceCard,BioContactLinks,BioAlignmentChipRow}.tsx` (6 files)
- Create: `packages/officials-ui/src/finance/{FinanceSubSectionHeading,FinanceSummaryStrip,TopAmountBreakdown}.tsx` (3 files)
- Create: corresponding tests under `packages/officials-ui/test/{bio,finance}/`
- Delete: web + mobile originals at the matching paths
- Delete: `apps/web/test/components/bio/{BioHeader,BioPortrait,BioAlignmentChipRow}.test.tsx`
- Delete: `apps/web/test/components/finance/{FinanceSummaryStrip,TopAmountBreakdown}.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` — add re-exports
- Modify: import sites — switch to `@chiaro/officials-ui`

### Canonical example — BioHeader

`BioHeader` is the largest of this batch and composes 5 children (all also in this batch). Web version is currently NOT a Client Component (no `'use client'`); the port can also stay free of the directive (pure-display, no hooks).

- [ ] **Step 1: Write the failing test for BioHeader**

Create `packages/officials-ui/test/bio/BioHeader.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BioHeader } from '../../src/bio/BioHeader.tsx'

describe('BioHeader', () => {
  it('renders the full name as a heading', () => {
    const { getByRole } = render(
      <BioHeader
        officialId="oid"
        fullName="Jane Doe"
        portraitUrl={null}
        party="Democratic"
        chamber="federal_senate"
        state="CA"
        stateName="California"
        districtNumber={null}
        senateClass={3}
        atLarge={false}
        role="Senator"
        firstElectedYear={2017}
        officialUrl={null}
        twitterHandle={null}
        chips={[]}
      />,
    )
    expect(getByRole('heading', { name: 'Jane Doe' })).toBeTruthy()
  })

  it('passes chips through to BioAlignmentChipRow', () => {
    const { getByText } = render(
      <BioHeader
        officialId="oid"
        fullName="Jane Doe"
        portraitUrl={null}
        party="Democratic"
        chamber="federal_senate"
        state="CA"
        stateName="California"
        districtNumber={null}
        senateClass={3}
        atLarge={false}
        role="Senator"
        firstElectedYear={2017}
        officialUrl={null}
        twitterHandle={null}
        chips={[{ issueArea: 'civil-rights', tier: 'strong-progressive', displayLabel: 'Civil Rights', subCascadeSlug: 'civil-rights' }]}
      />,
    )
    expect(getByText('Civil Rights')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @chiaro/officials-ui test bio/BioHeader`
Expected: FAIL — `Cannot find module '../../src/bio/BioHeader.tsx'`.

- [ ] **Step 3: Implement `packages/officials-ui/src/bio/BioHeader.tsx`**

```tsx
import { View, Text } from 'react-native'
import type { AlignmentChipRow } from '@chiaro/officials'
import { BioPortrait } from './BioPortrait.tsx'
import { BioIdentityRow } from './BioIdentityRow.tsx'
import { BioServiceCard } from './BioServiceCard.tsx'
import { BioContactLinks } from './BioContactLinks.tsx'
import { BioAlignmentChipRow } from './BioAlignmentChipRow.tsx'

export interface BioHeaderProps {
  officialId: string
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'federal_house' | 'federal_senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
  chips: AlignmentChipRow[]
}

export function BioHeader(p: BioHeaderProps): React.JSX.Element {
  return (
    <View
      accessibilityLabel={`${p.fullName} bio`}
      style={{
        maxWidth: 600,
        alignSelf: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 12,
      }}
    >
      <BioPortrait fullName={p.fullName} portraitUrl={p.portraitUrl} size={72} />
      <Text
        accessibilityRole="header"
        accessibilityLevel={1}
        style={{ fontSize: 24, fontWeight: '700', color: '#1a1714' }}
      >
        {p.fullName}
      </Text>
      <BioIdentityRow
        party={p.party}
        chamber={p.chamber}
        stateName={p.stateName}
        stateAbbrev={p.state}
        districtNumber={p.districtNumber}
        atLarge={p.atLarge}
      />
      <BioAlignmentChipRow chips={p.chips} officialId={p.officialId} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </View>
  )
}
```

Note: The `AlignmentChipRow` type lives in `@chiaro/officials` (not in `@/lib/derivations/alignment` as it does in the web app). Verify it's exported from `@chiaro/officials/src/index.ts`; if not, move the type from `apps/web/lib/derivations/alignment.ts` to `@chiaro/officials` as part of this step.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test bio/BioHeader`
Expected: PASS.

- [ ] **Step 5: Add to barrel + delete platform copies + update imports**

Append to `packages/officials-ui/src/index.ts`:

```ts
export { BioHeader, type BioHeaderProps } from './bio/BioHeader.tsx'
export { BioPortrait } from './bio/BioPortrait.tsx'
export { BioIdentityRow } from './bio/BioIdentityRow.tsx'
export { BioServiceCard } from './bio/BioServiceCard.tsx'
export { BioContactLinks } from './bio/BioContactLinks.tsx'
export { BioAlignmentChipRow } from './bio/BioAlignmentChipRow.tsx'
```

Delete the 6 web copies and 6 mobile copies of bio components, then `grep -rn` for stale imports and rewrite each to `import { BioHeader } from '@chiaro/officials-ui'`.

- [ ] **Step 6: Repeat the test→fail→implement→pass cycle for the 8 remaining components**

Apply universal translation rules. Per-component specifics:

#### `BioPortrait`
Renders portrait image with rounded circle. Props: `fullName`, `portraitUrl: string | null`, `size: number`. Uses `<Image source={{ uri }}>` when portraitUrl is set; falls back to initials in a colored circle. Test asserts both branches.

#### `BioIdentityRow`
Renders `Party · State · District` inline row. Props per existing web file. Test asserts each segment.

#### `BioServiceCard`
Renders `role · since YEAR` block. Test asserts text appears.

#### `BioContactLinks`
Renders 0–2 link buttons (officialUrl + twitterHandle). Props with both null → renders nothing. **Has nav** — uses `<Pressable>` with `accessibilityRole="link"` and `onPress` that calls `Linking.openURL(...)` (RN built-in, not router). No callback prop needed since these are external URLs.

#### `BioAlignmentChipRow`
Wraps a row of `AlignmentChip`s with overflow handling. Test asserts chips appear or empty state copy.

#### `finance/FinanceSubSectionHeading`
Pure-text subsection title. Props: `title`, `subtitle?`. Test asserts text.

#### `finance/FinanceSummaryStrip`
4-tile strip: Total raised, Total disbursed, Small-donor %, In-state %. Props per existing web file. Uses `<View flexDirection='row'>`. Test asserts all 4 tiles.

#### `finance/TopAmountBreakdown`
List of top-N entries with bar visualization. Props: `entries: { label, amount, pct? }[]`. Test asserts entries render in order.

- [ ] **Step 7: Run all tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: ~50 tests PASS (combined with Task 5).

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile
git commit -m "feat(officials-ui): port bio/ + finance/ leaf primitives

9 pure-display components moved to shared package:
- bio/{BioHeader,BioPortrait,BioIdentityRow,BioServiceCard,
       BioContactLinks,BioAlignmentChipRow}
- finance/{FinanceSubSectionHeading,FinanceSummaryStrip,
            TopAmountBreakdown}

BioHeader stays directive-free (pure-display); BioContactLinks
uses Linking.openURL for external links (no platform router needed)."
```

---

## Task 7: Port federal cards (6 files)

**Files:**
- Create: `packages/officials-ui/src/federal/FederalServiceRecordCard.tsx`
- Create: `packages/officials-ui/src/federal/FederalVotingBillsCard.tsx`
- Create: `packages/officials-ui/src/federal/FederalFinanceCard.tsx`
- Create: `packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx`
- Create: `packages/officials-ui/src/federal/FederalCommunityPresenceCard.tsx`
- Create: `packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx`
- Create: corresponding tests under `packages/officials-ui/test/federal/`
- Delete: web + mobile copies at `apps/{web,mobile}/components/federal/Federal{ServiceRecord,VotingBills,Finance,IssuePositions,CommunityPresence,EthicsAccountability}Card.tsx`
- Delete: matching `apps/web/test/components/federal/*.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` — add re-exports

### Canonical example — FederalServiceRecordCard

This is the canonical pattern for **all** Federal/State cards in Tasks 7–10. The shape is: `useChiaroClient()` + 2–3 `useXxx(client, officialId)` query hooks + collapsible subsections + KPI list + list components.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/federal/FederalServiceRecordCard.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { ChiaroClientProvider } from '../../src/client-context.tsx'

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: {
        official_id: 'oid',
        bills_sponsored_count: 12,
        bills_cosponsored_count: 33,
        attendance_pct: 96,
        salary_role: 'Senator',
        tenure_years: 6,
      },
      isLoading: false, isSuccess: true,
    }),
    useOfficialLeadershipHistory: () => ({
      data: [{ role: 'Senate Majority Whip', start_year: 2021, end_year: null }],
      isLoading: false, isSuccess: true,
    }),
  }
})

import { FederalServiceRecordCard } from '../../src/federal/FederalServiceRecordCard.tsx'

const mockClient = { from: () => {} } as unknown as ChiaroClient

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ChiaroClientProvider>
  )
}

describe('FederalServiceRecordCard', () => {
  it('renders Service Record header + sponsored summary line', () => {
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/Service Record/i)).toBeTruthy()
    expect(getByText(/12 bills sponsored/)).toBeTruthy()
    expect(getByText(/33 cosponsored/)).toBeTruthy()
    expect(getByText(/96% attendance/)).toBeTruthy()
  })

  it('shows leadership subsection count label', () => {
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/Leadership history \(1\)/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @chiaro/officials-ui test federal/FederalServiceRecordCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/officials-ui/src/federal/FederalServiceRecordCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import {
  useOfficialMetrics,
  useOfficialLeadershipHistory,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
import { FederalKPIList } from './FederalKPIList.tsx'
import { FederalLeadershipList } from './FederalLeadershipList.tsx'

export interface FederalServiceRecordCardProps {
  officialId: string
  hideLivesInDistrict?: boolean
}

export function FederalServiceRecordCard({
  officialId,
  hideLivesInDistrict,
}: FederalServiceRecordCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const metrics = useOfficialMetrics(client, officialId)
  const leadership = useOfficialLeadershipHistory(client, officialId)
  const [openLeadership, setOpenLeadership] = useState(false)

  if (metrics.isLoading || leadership.isLoading) {
    return (
      <View style={cardStyle}>
        <Text accessibilityRole="header" accessibilityLevel={2} style={titleStyle}>Service Record</Text>
        <Text style={mutedStyle}>Loading service record…</Text>
      </View>
    )
  }

  const m = metrics.data ?? null
  const leadCount = leadership.data?.length ?? null
  const allEmpty = !m && (leadCount === 0 || leadCount === null)

  if (allEmpty) {
    return (
      <View style={cardStyle}>
        <Text accessibilityRole="header" accessibilityLevel={2} style={titleStyle}>Service Record</Text>
        <Text style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No service record data on file for this legislator.
        </Text>
      </View>
    )
  }

  const sponsored = m?.bills_sponsored_count ?? null
  const cosponsored = m?.bills_cosponsored_count ?? null
  const attendance = m?.attendance_pct ?? null

  return (
    <View style={cardStyle}>
      <Text accessibilityRole="header" accessibilityLevel={2} style={titleStyle}>Service Record</Text>
      <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {sponsored != null ? `${sponsored} bill${sponsored === 1 ? '' : 's'} sponsored` : '—'} ·{' '}
        {cosponsored != null ? `${cosponsored} cosponsored` : '—'} ·{' '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </Text>

      <FederalKPIList metrics={m} {...(hideLivesInDistrict ? { hideLivesInDistrict: true } : {})} />

      <Subsection
        label={`Leadership history (${leadCount ?? '—'})`}
        open={openLeadership}
        onToggle={() => setOpenLeadership(v => !v)}
      >
        <FederalLeadershipList rows={leadership.data ?? []} />
      </Subsection>
    </View>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: COLORS.neutral.border, paddingTop: 8, marginTop: 8 }}>
      <Pressable onPress={onToggle} style={{ paddingVertical: 6 }}>
        <Text style={{ color: COLORS.brand.text, fontSize: 14, fontWeight: '500' }}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open && <View>{children}</View>}
    </View>
  )
}

const cardStyle = {
  backgroundColor: COLORS.neutral.background,
  borderWidth: 1,
  borderColor: COLORS.neutral.border,
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
} as const

const titleStyle = {
  fontSize: 18,
  fontWeight: '600' as const,
  marginBottom: 12,
  color: COLORS.brand.text,
} as const

const mutedStyle = {
  color: COLORS.neutral.textMuted,
  fontSize: 13,
} as const
```

Note: This card depends on `FederalKPIList` + `FederalLeadershipList` which are in Task 8 (federal lists). In Task 7 these imports will fail until Task 8 lands. Two options:
  (a) Implement minimal stub versions of `FederalKPIList` + `FederalLeadershipList` in Task 7 that render `<Text>stub</Text>` and pass tests, then Task 8 replaces with real implementations.
  (b) Reorder: do Task 8 (lists, no dependencies) BEFORE Task 7 (cards that consume them).

**Choose option (b).** Renumber: Task 7 = federal lists, Task 8 = federal cards. (This plan reflects the swap below.)

- [ ] **Step 4: Run test to verify it passes (after Task 8 / federal lists exist)**

Run: `pnpm --filter @chiaro/officials-ui test federal/FederalServiceRecordCard`
Expected: PASS.

- [ ] **Step 5: Add to barrel + delete + update imports**

Append to `packages/officials-ui/src/index.ts`:

```ts
export {
  FederalServiceRecordCard,
  type FederalServiceRecordCardProps,
} from './federal/FederalServiceRecordCard.tsx'
```

Delete:
- `apps/web/components/federal/FederalServiceRecordCard.tsx`
- `apps/mobile/components/federal/FederalServiceRecordCard.tsx`
- `apps/web/test/components/federal/FederalServiceRecordCard.test.tsx`
- `apps/mobile/test/components/federal/FederalServiceRecordCard.test.tsx`

Update import sites: `apps/web/app/officials/[id]/page.tsx` + `apps/mobile/app/(app)/officials/[id].tsx` → switch:

```diff
- import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'
+ import { FederalServiceRecordCard } from '@chiaro/officials-ui'
```

- [ ] **Step 6: Repeat for the 5 remaining federal cards**

For each card below, follow the test→fail→implement→pass→barrel-update→delete-originals→update-imports cycle. Each card has its own data dependencies (listed) and consumes its own list components from `federal/`.

#### `FederalVotingBillsCard`
- Hooks: `useOfficialSponsoredBills`, `useOfficialCosponsoredBills`, `useOfficialVotePositions` (from `@chiaro/bills`).
- Lists consumed: `FederalSponsoredBillsList`, `FederalCosponsoredBillsList`, `FederalMissedVotesList`.
- Subsections: 3 collapsibles (Sponsored / Cosponsored / Missed votes).
- Test pattern: mock 3 hooks, assert section labels + counts.

#### `FederalFinanceCard`
- Hooks: `useOfficialFinanceSummary`, `useOfficialFinanceIndividualDonors`, `useOfficialFinancePACs` (from `@chiaro/officials`).
- Lists: `FederalDonorsList`, `FederalPACsList`.
- Shape: top strip + 2 collapsible subsections.

#### `FederalIssuePositionsCard`
- Hooks: `useOfficialScorecardRatings` (from `@chiaro/officials`).
- Lists: `FederalScorecardRatingsList`.
- Shape: 1 collapsible.

#### `FederalCommunityPresenceCard`
- Hooks: `useOfficialTownHalls`, `useOfficialDistrictOffices` (from `@chiaro/officials`).
- Lists: `FederalTownHallsList`, `FederalDistrictOfficesList`.
- Shape: 2 collapsibles.

#### `FederalEthicsAccountabilityCard`
- Hooks: `useOfficialStockTransactions`, `useOfficialMetrics` (for `stock_act_compliance_score`).
- Lists: `FederalStockTransactionsList`.
- Includes a `ComplianceIcon` for the compliance state.

- [ ] **Step 7: Run all federal-card tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test federal`
Expected: PASS (6 cards × ~3 tests = ~18 tests, plus list tests from Task 8).

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile
git commit -m "feat(officials-ui): port federal cards (6 files)

FederalServiceRecordCard, FederalVotingBillsCard, FederalFinanceCard,
FederalIssuePositionsCard, FederalCommunityPresenceCard,
FederalEthicsAccountabilityCard.

Each card calls useChiaroClient() instead of useMemo(createClient).
6 useMemo+factory pairs eliminated."
```

---

## Task 8: Port federal lists (11 files) — **executed BEFORE Task 7**

> **Execution note:** Despite numbering, run Task 8 before Task 7. Federal lists have no internal dependencies; cards depend on them.

**Files:**
- Create: `packages/officials-ui/src/federal/{FederalKPIList,FederalLeadershipList,FederalSponsoredBillsList,FederalCosponsoredBillsList,FederalMissedVotesList,FederalDonorsList,FederalPACsList,FederalScorecardRatingsList,FederalDistrictOfficesList,FederalTownHallsList,FederalStockTransactionsList}.tsx` (11 files)
- Create: corresponding tests
- Delete: web + mobile copies + their tests
- Modify: `packages/officials-ui/src/index.ts` — add re-exports

### Canonical example — `FederalKPIList`

KPI lists are pure-display row renderers. Props: `metrics: OfficialMetricsRow | null` (+ optional flags like `hideLivesInDistrict`). Render N rows of label + value. Hide a row when the corresponding metric is `null`.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/federal/FederalKPIList.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalKPIList } from '../../src/federal/FederalKPIList.tsx'

describe('FederalKPIList', () => {
  it('renders rows for non-null metric fields', () => {
    const { getByText } = render(
      <FederalKPIList
        metrics={{
          official_id: 'oid',
          tenure_years: 6,
          attendance_pct: 96,
          lives_in_district_pct: 82,
          salary_role: 'Senator',
          bills_sponsored_count: 12,
          bills_cosponsored_count: 33,
          committee_chair_count: 1,
        } as any}
      />,
    )
    expect(getByText(/Tenure/i)).toBeTruthy()
    expect(getByText(/6 years/i)).toBeTruthy()
    expect(getByText(/Attendance/i)).toBeTruthy()
    expect(getByText(/96%/)).toBeTruthy()
  })

  it('hides rows where metrics is null', () => {
    const { queryByText } = render(<FederalKPIList metrics={null} />)
    expect(queryByText(/Tenure/i)).toBeNull()
  })

  it('hides Lives-in-district row when hideLivesInDistrict is set', () => {
    const { queryByText } = render(
      <FederalKPIList
        metrics={{ official_id: 'oid', lives_in_district_pct: 82 } as any}
        hideLivesInDistrict
      />,
    )
    expect(queryByText(/Lives in district/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @chiaro/officials-ui test federal/FederalKPIList`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (port the current web/mobile shape to RN primitives)**

Port the existing `apps/web/components/federal/FederalKPIList.tsx` shape to RN primitives following the Universal translation reference. Render `<View>` rows with `<Text>` label + value, applying universal style normalizations.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test federal/FederalKPIList`
Expected: PASS.

- [ ] **Step 5: Repeat for the 10 remaining federal lists**

Apply the same pattern. Pure-display lists — none of these call `useChiaroClient()` (data passes in as `rows: T[]` prop). Test pattern is identical: render with fixture rows, assert text appears; render with empty array, assert empty-state copy.

Component-by-component cheatsheet (props derived from current web file shape):

| Component | Props | Empty state |
|---|---|---|
| `FederalLeadershipList` | `rows: LeadershipRow[]` | "No leadership history" |
| `FederalSponsoredBillsList` | `rows: BillRow[]` | "No bills sponsored" |
| `FederalCosponsoredBillsList` | `rows: BillRow[]` | "No bills cosponsored" |
| `FederalMissedVotesList` | `rows: VoteRow[]` | "No missed votes" |
| `FederalDonorsList` | `rows: IndividualDonorRow[]` | "No individual donors" |
| `FederalPACsList` | `rows: PACContributionRow[]` | "No PAC contributions" |
| `FederalScorecardRatingsList` | `rows: ScorecardRatingRow[]` | "No scorecard ratings" |
| `FederalDistrictOfficesList` | `rows: DistrictOfficeRow[]` | "No district offices on file" |
| `FederalTownHallsList` | `rows: TownHallRow[]` | "No upcoming town halls" |
| `FederalStockTransactionsList` | `rows: StockTransactionRow[]` | "No stock transactions reported" |

All row types are imported from `@chiaro/officials` (officials/finance/scorecard/community/ethics) or `@chiaro/bills` (bills/votes).

- [ ] **Step 6: Add 11 barrel exports + delete + update imports**

Append to `packages/officials-ui/src/index.ts`:

```ts
export { FederalKPIList } from './federal/FederalKPIList.tsx'
export { FederalLeadershipList } from './federal/FederalLeadershipList.tsx'
export { FederalSponsoredBillsList } from './federal/FederalSponsoredBillsList.tsx'
export { FederalCosponsoredBillsList } from './federal/FederalCosponsoredBillsList.tsx'
export { FederalMissedVotesList } from './federal/FederalMissedVotesList.tsx'
export { FederalDonorsList } from './federal/FederalDonorsList.tsx'
export { FederalPACsList } from './federal/FederalPACsList.tsx'
export { FederalScorecardRatingsList } from './federal/FederalScorecardRatingsList.tsx'
export { FederalDistrictOfficesList } from './federal/FederalDistrictOfficesList.tsx'
export { FederalTownHallsList } from './federal/FederalTownHallsList.tsx'
export { FederalStockTransactionsList } from './federal/FederalStockTransactionsList.tsx'
```

Delete 11 web + 11 mobile files at `apps/{web,mobile}/components/federal/Federal*List.tsx` and matching `apps/{web,mobile}/test/components/federal/Federal*List.test.tsx`.

Update any import sites — but federal list components are only consumed BY federal card components (Task 7). After Task 7 those imports will already use the shared package. So no app-side import updates here.

- [ ] **Step 7: Run all tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test federal`
Expected: PASS (11 list tests).

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck`
Expected: PASS — federal cards in apps still exist and import from `@chiaro/officials-ui` (via barrel) which now exports lists they need.

Wait — federal cards in apps still import their lists locally. Until Task 7 ports the cards, the local card files reference local list files that we just deleted. Two fixes:

(a) **In this task**, update the 6 federal card files in `apps/{web,mobile}/components/federal/` to switch only their list imports to `@chiaro/officials-ui` (cards themselves stay platform-specific until Task 7).
(b) Combine Tasks 7+8 into one big task ordered correctly.

**Use (a).** For each of the 6 federal card files in both apps:

```diff
- import { FederalKPIList } from './FederalKPIList'
- import { FederalLeadershipList } from './FederalLeadershipList'
+ import { FederalKPIList, FederalLeadershipList } from '@chiaro/officials-ui'
```

(Apply per-card according to its actual list imports.)

Re-run typecheck: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile
git commit -m "feat(officials-ui): port federal lists (11 files)

Pure-display list components — props in, RN primitives out.
Federal cards in apps temporarily switch their list imports to
@chiaro/officials-ui; cards themselves are ported in the next commit.

Components: FederalKPIList, FederalLeadershipList,
Federal{Sponsored,Cosponsored}BillsList, FederalMissedVotesList,
Federal{Donors,PACs,ScorecardRatings}List,
Federal{DistrictOffices,TownHalls,StockTransactions}List."
```

---

## Task 9: Port state lists/evidence (11 files) — execute BEFORE Task 10

**Files:**
- Create: `packages/officials-ui/src/state/{StateBillsEvidence,StateVotesEvidence,StateDonorsEvidence,StateIssueVotesEvidence,StateCommitteeHearingsList,StateDistrictOfficesList,StateTownHallsList,StateEthicsComplaintsList,StateFinancialDisclosuresList,StateOfficialEventsList,StateStockTransactionsList}.tsx` (11 files)
- Create: corresponding tests
- Delete: web + mobile copies + tests
- Modify: `packages/officials-ui/src/index.ts` — add re-exports

Note: `*Evidence` components are slightly different from `*List` — they encapsulate an `EvidenceExpand` wrapper + their own internal `useXxx()` query. **Some Evidence panels call `useChiaroClient()`** — verify per-file. Example: `StateDonorsEvidence` calls `useOfficialStateDonors(client, finance_summary_id)`.

- [ ] **Step 1: Implement and test each component in the table below**

Follow test→fail→implement→pass for each:

| Component | Calls useChiaroClient? | Hook(s) | Empty state |
|---|---|---|---|
| `StateBillsEvidence` | yes | `useOfficialSponsoredStateBills` | "No state bills" |
| `StateVotesEvidence` | yes | `useOfficialStateVotes` | "No state votes" |
| `StateDonorsEvidence` | yes | `useOfficialStateDonors` | "No donors" |
| `StateIssueVotesEvidence` | yes | `useOfficialStateVotesOnSubject` | "No votes on this issue" |
| `StateCommitteeHearingsList` | no | n/a (rows prop) | "No committee hearings" |
| `StateDistrictOfficesList` | no | n/a (rows prop) | "No district offices" |
| `StateTownHallsList` | no | n/a (rows prop) | "No town halls" |
| `StateEthicsComplaintsList` | no | n/a (rows prop) | "No ethics complaints" |
| `StateFinancialDisclosuresList` | no | n/a (rows prop) | "No financial disclosures" |
| `StateOfficialEventsList` | no | n/a (rows prop) | "No events on file" |
| `StateStockTransactionsList` | no | n/a (rows prop) | "No stock transactions" |

For each, port the existing web file shape (RN primitives, universal translations) and write a 2–4-test vitest file with hook mocks where applicable.

- [ ] **Step 2: Add barrel exports**

Append to `packages/officials-ui/src/index.ts`:

```ts
export { StateBillsEvidence } from './state/StateBillsEvidence.tsx'
export { StateVotesEvidence } from './state/StateVotesEvidence.tsx'
export { StateDonorsEvidence } from './state/StateDonorsEvidence.tsx'
export { StateIssueVotesEvidence } from './state/StateIssueVotesEvidence.tsx'
export { StateCommitteeHearingsList } from './state/StateCommitteeHearingsList.tsx'
export { StateDistrictOfficesList } from './state/StateDistrictOfficesList.tsx'
export { StateTownHallsList } from './state/StateTownHallsList.tsx'
export { StateEthicsComplaintsList } from './state/StateEthicsComplaintsList.tsx'
export { StateFinancialDisclosuresList } from './state/StateFinancialDisclosuresList.tsx'
export { StateOfficialEventsList } from './state/StateOfficialEventsList.tsx'
export { StateStockTransactionsList } from './state/StateStockTransactionsList.tsx'
```

- [ ] **Step 3: Delete + update state-card imports in apps**

Delete 11 web + 11 mobile state list/evidence files and matching tests. Update each remaining state-card file in `apps/{web,mobile}/components/state/` to import its list/evidence dependencies from `@chiaro/officials-ui`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test state` — PASS.
Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck` — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile
git commit -m "feat(officials-ui): port state lists + evidence panels (11 files)

State*List components are pure-display (rows: prop).
State*Evidence components call useChiaroClient() and own their hook.
State cards in apps temporarily switch list/evidence imports to
@chiaro/officials-ui; cards themselves ported in next commit."
```

---

## Task 10: Port state cards (7 files)

**Files:**
- Create: `packages/officials-ui/src/state/{StateServiceRecordCard,StateFinanceCard,StateIssuePositionsCard,StateCommunityPresenceCard,StateConductCard,StateFinancialActivityCard,StateOfficialDetailPage}.tsx` (7 files)
- Create: corresponding tests
- Delete: web + mobile copies + tests
- Modify: `packages/officials-ui/src/index.ts`

- [ ] **Step 1: Implement each state card in the order below**

Each card follows the Federal canonical pattern from Task 7. Order matters: `StateOfficialDetailPage` composes the other 6 + the `BioHeader` and is implemented LAST.

For each card: test → fail → implement → pass cycle, mocking hooks via `vi.mock('@chiaro/officials', ...)` or `vi.mock('@chiaro/state-bills', ...)`. The shared `useChiaroClient` is supplied by `<ChiaroClientProvider client={mockClient}>` in the test wrapper.

| Card | Hooks | Lists consumed |
|---|---|---|
| `StateServiceRecordCard` | `useOfficialMetrics`, `useOfficialSponsoredStateBills`, `useOfficialStateVotes`, `useOfficialStateCommitteeMemberships` | `StateBillsEvidence`, `StateVotesEvidence` |
| `StateFinanceCard` | `useOfficialStateFinanceSummary`, `useOfficialStateDonors` | `StateDonorsEvidence` |
| `StateIssuePositionsCard` | `useOfficialStateScorecardRatings`, `useOfficialStateVotesOnSubject` | `StateIssueVotesEvidence` |
| `StateCommunityPresenceCard` | `useOfficialStateTownHalls`, `useOfficialStateDistrictOffices`, `useOfficialStateCommitteeHearings` | `StateTownHallsList`, `StateDistrictOfficesList`, `StateCommitteeHearingsList` |
| `StateConductCard` | `useOfficialStateEthicsComplaints`, `useOfficialStateOfficialEvents` | `StateEthicsComplaintsList`, `StateOfficialEventsList` |
| `StateFinancialActivityCard` | `useOfficialStateStockTransactions`, `useOfficialStateFinancialDisclosures` | `StateStockTransactionsList`, `StateFinancialDisclosuresList` |
| `StateOfficialDetailPage` | composes all 6 cards above + BioHeader (state variant) | n/a |

- [ ] **Step 2: Add barrel exports**

Append to `packages/officials-ui/src/index.ts`:

```ts
export { StateServiceRecordCard } from './state/StateServiceRecordCard.tsx'
export { StateFinanceCard } from './state/StateFinanceCard.tsx'
export { StateIssuePositionsCard } from './state/StateIssuePositionsCard.tsx'
export { StateCommunityPresenceCard } from './state/StateCommunityPresenceCard.tsx'
export { StateConductCard } from './state/StateConductCard.tsx'
export { StateFinancialActivityCard } from './state/StateFinancialActivityCard.tsx'
export { StateOfficialDetailPage } from './state/StateOfficialDetailPage.tsx'
```

- [ ] **Step 3: Delete 7 web + 7 mobile copies + their tests**

Delete:
- `apps/{web,mobile}/components/state/{StateServiceRecord,StateFinance,StateIssuePositions,StateCommunityPresence,StateConduct,StateFinancialActivity,StateOfficialDetailPage}.tsx`
- `apps/{web,mobile}/test/components/state/{...}.test.tsx`

- [ ] **Step 4: Update consumer pages**

Edit `apps/web/app/state-officials/[id]/page.tsx` + `apps/mobile/app/(app)/state-officials/[id].tsx` — switch to:

```diff
- import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'
+ import { StateOfficialDetailPage } from '@chiaro/officials-ui'
```

- [ ] **Step 5: Run all tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test` — should now total ~150–200 tests, all PASS.
Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck` — PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile
git commit -m "feat(officials-ui): port state cards (7 files)

Closes /state-officials/[id] page redesign — the entire state
detail page now renders from @chiaro/officials-ui."
```

---

## Task 11: Port nav components — OfficialsCard, OfficialsList, StateOfficialsCardSection, cards/AlignmentChip + consumers

**Files:**
- Create: `packages/officials-ui/src/cards/AlignmentChip.tsx`
- Create: `packages/officials-ui/src/OfficialsCard.tsx`
- Create: `packages/officials-ui/src/OfficialsList.tsx`
- Create: `packages/officials-ui/src/state/StateOfficialsCardSection.tsx`
- Create: tests for all 4
- Delete: web + mobile copies + tests
- Modify: `apps/web/app/page.tsx`, `apps/web/app/officials/page.tsx`, `apps/web/app/officials/[id]/page.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx`, `apps/mobile/app/(app)/officials/[id].tsx`
- Modify: `packages/officials-ui/src/index.ts`

### Canonical example — `cards/AlignmentChip` with `onPress` callback

This component is the smallest of the 4 and the only one needed by Task 6's `BioAlignmentChipRow` (which still has a stale relative import to it — fix that in Task 6 retro-comment, or simply ship a stub of `AlignmentChip` in Task 5 and replace it here).

Decision: Task 5 deferred `AlignmentChip` knowing nav-callback design lands here. Ship the full `AlignmentChip` now and rerun `BioAlignmentChipRow` imports.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/cards/AlignmentChip.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AlignmentChip } from '../../src/cards/AlignmentChip.tsx'

describe('AlignmentChip', () => {
  it('renders the label', () => {
    const { getByText } = render(<AlignmentChip label="Civil Rights" tier="strong-progressive" />)
    expect(getByText('Civil Rights')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = vi.fn()
    const { getByRole } = render(
      <AlignmentChip label="Civil Rights" tier="strong-progressive" onPress={onPress} />,
    )
    fireEvent.click(getByRole('link'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders as static (no link role) when onPress is omitted', () => {
    const { queryByRole } = render(
      <AlignmentChip label="Civil Rights" tier="strong-progressive" />,
    )
    expect(queryByRole('link')).toBeNull()
  })
})
```

- [ ] **Step 2: Implement `packages/officials-ui/src/cards/AlignmentChip.tsx`**

```tsx
import { Pressable, Text, View } from 'react-native'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  /** Caller-provided press handler; usually wraps router.push(href). When omitted, the chip is non-interactive. */
  onPress?: () => void
}

export function AlignmentChip({ label, tier, onPress }: AlignmentChipProps): React.JSX.Element {
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chipStyle = {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: bg,
    alignSelf: 'flex-start' as const,
  }
  const textStyle = {
    fontSize: 12,
    fontWeight: '500' as const,
    color: fg,
    lineHeight: 17,
  }
  if (!onPress) {
    return (
      <View style={chipStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`View ${label} positions`}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test cards/AlignmentChip`
Expected: PASS (3 tests).

- [ ] **Step 4: Implement `OfficialsCard`, `OfficialsList`, `StateOfficialsCardSection`**

All three accept `onSelect: (id: string) => void` callback prop. Internal sub-row components forward the callback as `onPress` for the `<Pressable>` row + as the `AlignmentChip` `onPress` (curried per chip target).

#### `packages/officials-ui/src/OfficialsCard.tsx` (abbreviated — extends current web shape)

```tsx
'use client'

import { View, Text, Pressable } from 'react-native'
import {
  useMyOfficials,
  useOfficialScorecardRatings,
  useOfficialMetrics,
  selectTopAlignmentChips,
  groupOfficialsByLevel,
  type OfficialWithDistrict,
  type AlignmentChipRow,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from './client-context.tsx'
import { OfficialAvatar } from './OfficialAvatar.tsx'
import { DistrictBadge } from './cards/DistrictBadge.tsx'
import { AlignmentChip } from './cards/AlignmentChip.tsx'
import { StateOfficialsCardSection } from './state/StateOfficialsCardSection.tsx'

const STATE_NAMES: Record<string, string> = { /* … same map as today … */ }

export interface OfficialsCardProps {
  /** Called when the user taps an official row or a chip. */
  onSelect: (target: { officialId: string; subCascadeSlug?: string }) => void
  /** Called when the user taps "See all officials". */
  onSeeAll: () => void
  /** Called when the user taps the calibrate hint. */
  onCalibrate: () => void
}

function parseDistrict(code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (!code) return { districtNumber: null, atLarge: false }
  const parts = code.split('-')
  const tail = parts[1]
  if (!tail) return { districtNumber: null, atLarge: false }
  if (tail === 'AL') return { districtNumber: null, atLarge: true }
  const n = parseInt(tail, 10)
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

function OfficialRow({
  o, onSelect,
}: { o: OfficialWithDistrict; onSelect: OfficialsCardProps['onSelect'] }) {
  const client = useChiaroClient()
  const scorecards = useOfficialScorecardRatings(client, o.id)
  const metrics = useOfficialMetrics(client, o.id)
  const stateName = STATE_NAMES[o.state] ?? o.state
  const chips: AlignmentChipRow[] = selectTopAlignmentChips(scorecards.data ?? [])
  const salaryRole = metrics.data?.salary_role
  const currentRole = salaryRole && salaryRole !== 'Member'
    ? salaryRole
    : o.chamber === 'federal_house' ? 'Representative' : 'Senator'
  const { districtNumber, atLarge } = parseDistrict(o.district?.code)

  return (
    <View style={{ padding: 12, borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6, backgroundColor: '#fff', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          onPress={() => onSelect({ officialId: o.id })}
          accessibilityRole="link"
          accessibilityLabel={`View ${o.full_name}`}
        >
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => onSelect({ officialId: o.id })} accessibilityRole="link">
            <Text style={{ fontWeight: '600', fontSize: 15, color: '#1a1714' }}>{o.full_name}</Text>
          </Pressable>
          <DistrictBadge
            chamber={o.chamber as 'federal_house' | 'federal_senate'}
            stateName={stateName}
            stateAbbrev={o.state}
            districtNumber={o.chamber === 'federal_house' ? districtNumber : null}
            atLarge={o.chamber === 'federal_house' && atLarge}
          />
          <Text style={{ fontSize: 11, color: '#3a352b', marginTop: 2 }}>
            {currentRole} · {o.chamber === 'federal_house' ? 'House' : 'Senate'}
          </Text>
          {chips.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {chips.map((c) => (
                <AlignmentChip
                  key={c.issueArea}
                  label={c.displayLabel}
                  tier={c.tier}
                  onPress={() => onSelect({ officialId: o.id, subCascadeSlug: c.subCascadeSlug })}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

export function OfficialsCard({ onSelect, onSeeAll, onCalibrate }: OfficialsCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <View accessibilityLabel="Your officials"><Text>Loading your officials…</Text></View>
  if (error)     return <View accessibilityLabel="Your officials"><Text>Couldn&apos;t load officials.</Text></View>
  if (!data || data.length === 0) {
    return (
      <View accessibilityLabel="Your officials">
        <Text accessibilityRole="header" accessibilityLevel={2}>Your officials</Text>
        <Pressable onPress={onCalibrate} accessibilityRole="link">
          <Text>Calibrate your address</Text>
        </Pressable>
        <Text> to see your delegation.</Text>
      </View>
    )
  }

  const { federal, state } = groupOfficialsByLevel(data)

  return (
    <View accessibilityLabel="Your officials" style={{ padding: 16, backgroundColor: '#f7f5ef', borderRadius: 8 }}>
      <Text accessibilityRole="header" accessibilityLevel={2} style={{ fontSize: 16, color: '#1a1714', marginBottom: 10 }}>Your officials</Text>
      {federal.length > 0 && (
        <View testID="federal-section">
          <Text style={{ fontSize: 14, fontWeight: '700', textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>Federal</Text>
          {federal.map((o) => <OfficialRow key={o.id} o={o} onSelect={onSelect} />)}
        </View>
      )}
      <StateOfficialsCardSection officials={state} onSelect={onSelect} />
      <Pressable onPress={onSeeAll} accessibilityRole="link">
        <Text style={{ fontSize: 14, color: '#3b6ed1', marginTop: 10 }}>See all officials →</Text>
      </Pressable>
    </View>
  )
}
```

Note: `selectTopAlignmentChips` + `groupOfficialsByLevel` currently live in `apps/web/lib/derivations/` and `apps/mobile/lib/derivations/` (duplicated). Move them to `packages/officials/src/derivations.ts` as part of this task and update both apps + the shared package to import from `@chiaro/officials`.

#### `packages/officials-ui/src/OfficialsList.tsx` and `StateOfficialsCardSection.tsx`

Same shape; both accept `onSelect: (target: { officialId: string }) => void`. Port verbatim with universal translations.

- [ ] **Step 5: Update consumer pages — web**

Edit `apps/web/app/page.tsx`:

```diff
- import { OfficialsCard } from '@/components/OfficialsCard'
+ import { OfficialsCard } from '@chiaro/officials-ui'
+ import { useRouter } from 'next/navigation'

  // inside the page component body (must be 'use client' or convert to client component):
+ const router = useRouter()
  // …
- <OfficialsCard />
+ <OfficialsCard
+   onSelect={({ officialId, subCascadeSlug }) =>
+     router.push(subCascadeSlug
+       ? `/officials/${officialId}#issue-positions:${subCascadeSlug}`
+       : `/officials/${officialId}`)}
+   onSeeAll={() => router.push('/officials')}
+   onCalibrate={() => router.push('/calibrate')}
+ />
```

If `apps/web/app/page.tsx` is currently a Server Component, wrap `<OfficialsCard>` in a thin `'use client'` shim component or convert the page. Inspect current file before editing.

Edit `apps/web/app/officials/page.tsx`:

```diff
- import { OfficialsList } from '@/components/OfficialsList'
+ import { OfficialsList } from '@chiaro/officials-ui'
+ // pass onSelect similarly to above
```

- [ ] **Step 6: Update consumer pages — mobile**

Edit `apps/mobile/app/(app)/index.tsx`:

```diff
- import { OfficialsCard } from '@/components/OfficialsCard'
+ import { OfficialsCard } from '@chiaro/officials-ui'
  import { useRouter } from 'expo-router'

  const router = useRouter()
- <OfficialsCard />
+ <OfficialsCard
+   onSelect={({ officialId, subCascadeSlug }) =>
+     router.push(subCascadeSlug
+       ? `/officials/${officialId}?cat=issue-positions&sub=${subCascadeSlug}`
+       : `/officials/${officialId}`)}
+   onSeeAll={() => router.push('/officials')}
+   onCalibrate={() => router.push('/calibrate')}
+ />
```

Edit `apps/mobile/app/(app)/officials/index.tsx` (or wherever `OfficialsList` is consumed) similarly.

- [ ] **Step 7: Delete originals**

```bash
rm apps/web/components/OfficialsCard.tsx
rm apps/web/components/OfficialsList.tsx
rm apps/web/components/state/StateOfficialsCardSection.tsx
rm apps/web/components/cards/AlignmentChip.tsx
rm apps/mobile/components/OfficialsCard.tsx
rm apps/mobile/components/OfficialsList.tsx
rm apps/mobile/components/state/StateOfficialsCardSection.tsx
rm apps/mobile/components/cards/AlignmentChip.tsx
rm apps/web/test/components/cards/AlignmentChip.test.tsx
rm apps/web/test/components/state/StateOfficialsCardSection.test.tsx
# (no existing web tests for OfficialsCard / OfficialsList — verify with grep)
```

- [ ] **Step 8: Add barrel exports + run all tests + typecheck**

Append:

```ts
export { AlignmentChip, type AlignmentChipProps } from './cards/AlignmentChip.tsx'
export { OfficialsCard, type OfficialsCardProps } from './OfficialsCard.tsx'
export { OfficialsList } from './OfficialsList.tsx'
export { StateOfficialsCardSection } from './state/StateOfficialsCardSection.tsx'
```

Run: `pnpm --filter @chiaro/officials-ui test` — PASS.
Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck` — PASS.
Run: `pnpm --filter @chiaro/web build` — PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/officials-ui apps/web apps/mobile packages/officials
git commit -m "feat(officials-ui): port nav-bearing components + wire consumer pages

OfficialsCard, OfficialsList, StateOfficialsCardSection, AlignmentChip
moved into shared package. All 4 accept onSelect callback (and
sibling callbacks for OfficialsCard) instead of importing
platform routers internally. Consumer pages on web + mobile pass
the appropriate router.push wrapper.

selectTopAlignmentChips + groupOfficialsByLevel hoisted from
apps/web/lib/derivations + apps/mobile/lib/derivations into
@chiaro/officials/src/derivations.ts."
```

---

## Task 12: Port detail-page consumer wires

**Files:**
- Modify: `apps/web/app/officials/[id]/page.tsx`
- Modify: `apps/web/app/state-officials/[id]/page.tsx`
- Modify: `apps/mobile/app/(app)/officials/[id].tsx`
- Modify: `apps/mobile/app/(app)/state-officials/[id].tsx`

- [ ] **Step 1: Update `apps/web/app/officials/[id]/page.tsx`**

The detail page currently composes Federal*Card components from `@/components/federal/...`. Switch all imports to `@chiaro/officials-ui`:

```diff
- import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'
- import { FederalVotingBillsCard } from '@/components/federal/FederalVotingBillsCard'
- import { FederalFinanceCard } from '@/components/federal/FederalFinanceCard'
- import { FederalIssuePositionsCard } from '@/components/federal/FederalIssuePositionsCard'
- import { FederalCommunityPresenceCard } from '@/components/federal/FederalCommunityPresenceCard'
- import { FederalEthicsAccountabilityCard } from '@/components/federal/FederalEthicsAccountabilityCard'
- import { BioHeader } from '@/components/bio/BioHeader'
+ import {
+   FederalServiceRecordCard,
+   FederalVotingBillsCard,
+   FederalFinanceCard,
+   FederalIssuePositionsCard,
+   FederalCommunityPresenceCard,
+   FederalEthicsAccountabilityCard,
+   BioHeader,
+ } from '@chiaro/officials-ui'
```

- [ ] **Step 2: Update the other 3 detail-page files similarly**

For each of `apps/web/app/state-officials/[id]/page.tsx`, `apps/mobile/app/(app)/officials/[id].tsx`, `apps/mobile/app/(app)/state-officials/[id].tsx` — rewrite component imports to come from `@chiaro/officials-ui`. Use the actual current import list per file (verify via Read tool before editing).

- [ ] **Step 3: Run typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/web build`
Expected: PASS.

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web apps/mobile
git commit -m "refactor: detail-page consumers import from @chiaro/officials-ui

apps/web/app/{officials,state-officials}/[id]/page.tsx +
apps/mobile/app/(app)/{officials,state-officials}/[id].tsx all
now import card components from the shared package."
```

---

## Task 13: Port component tests to `packages/officials-ui/test/**`

By this point most tests have already been created alongside their components in Tasks 5–11. This task is a sweep to find any web/mobile component tests that haven't been replaced yet.

- [ ] **Step 1: Inventory remaining app-side component tests**

Run: `find apps/web/test/components apps/mobile/test/components -name '*.test.tsx' -type f 2>/dev/null | sort`
Note: use the Glob tool, not raw find.

Expected: tests only for components that stayed in apps (DistrictPanel, DistrictMap) — everything else should be already deleted from previous tasks.

- [ ] **Step 2: For each remaining app-side test that maps to a shared component, port it**

If a shared component lacks a test file in `packages/officials-ui/test/**`, port the corresponding `apps/web/test/components/**` test file:

Rewrite the test:
1. Replace `vi.mock('@/lib/supabase/client', ...)` with a `<ChiaroClientProvider client={mockClient}>` wrapper inside the `wrap` helper.
2. Keep `vi.mock('@chiaro/officials', ...)` etc. unchanged.
3. Replace `import { X } from '@/components/.../X'` with `import { X } from '../../src/.../X.tsx'` (relative inside the package).
4. Add `import { ChiaroClientProvider } from '../../src/client-context.tsx'` and `import type { ChiaroClient } from '@chiaro/supabase-client'`.

- [ ] **Step 3: Run full package test suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: ~150–200 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/officials-ui/test apps/web/test apps/mobile/test
git commit -m "test(officials-ui): consolidate component tests into shared package

All component-level vitest tests now live in packages/officials-ui/test.
App-side test directories retain only page integration + map tests."
```

---

## Task 14: Delete duplicate app-side component tests

- [ ] **Step 1: Delete app-side component test directories**

```bash
rm -rf apps/web/test/components/bio
rm -rf apps/web/test/components/cards
rm -rf apps/web/test/components/finance
rm -rf apps/web/test/components/federal
rm -rf apps/web/test/components/state
rm -rf apps/mobile/test/components/bio
rm -rf apps/mobile/test/components/cards
rm -rf apps/mobile/test/components/finance
rm -rf apps/mobile/test/components/federal
rm -rf apps/mobile/test/components/state
```

Note: PowerShell equivalent is `Remove-Item -Recurse -Force apps/web/test/components/bio`. Use whatever shell is at hand.

- [ ] **Step 2: Verify no stale references**

Run: `pnpm -r typecheck`
Expected: PASS across 11 packages.

Run: `pnpm test`
Expected: PASS — `pnpm test` (not `pnpm -r test`) per Gotcha #7.

- [ ] **Step 3: Commit**

```bash
git add -u apps/web/test apps/mobile/test
git commit -m "test: delete duplicate app-side component tests

Component tests now live solely in packages/officials-ui/test.
DistrictPanel + DistrictMap tests preserved (map components stay
platform-specific)."
```

---

## Task 15: Workspace verify — typecheck, full tests, web build, manual smoke

- [ ] **Step 1: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across 11 packages.

- [ ] **Step 2: Full workspace test suite**

Run: `pnpm test`
Expected: PASS. Uses turbo, respects `^test` topological serialization (Gotcha #7).

- [ ] **Step 3: Web production build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Bundle size analysis shows +~30 KB gzipped from RNW (expected per spec).

- [ ] **Step 4: Web dev smoke**

Run: `pnpm --filter @chiaro/web dev`

Open in browser:
- `http://localhost:3000` — home renders OfficialsCard if calibrated, or calibration prompt
- `http://localhost:3000/officials` — renders OfficialsList
- `http://localhost:3000/officials/<bioguide>` — federal detail page renders all 6 federal cards
- `http://localhost:3000/state-officials/<id>` — state detail page renders all 6 state cards + StateConductCard + StateFinancialActivityCard

Check browser DevTools console: no React or RNW warnings. Visual parity with master branch (compare against a reference screenshot if available).

Kill dev server.

- [ ] **Step 5: Mobile Metro smoke**

Run: `pnpm --filter @chiaro/mobile dev`

Open Expo Go (or dev client) and navigate:
- Home tab — OfficialsCard
- Officials list — OfficialsList
- Federal official detail
- State official detail

Visual parity check. Kill Metro.

- [ ] **Step 6: pgTAP**

Run: `pnpm db:test` (after `pnpm db:start && pnpm db:reset`)
Expected: 409 tests PASS (no schema changes in slice 10).

- [ ] **Step 7: Sentry source-map upload smoke** (CI proxy)

If `SENTRY_AUTH_TOKEN` is set locally, `pnpm --filter @chiaro/web build` already uploads source maps. Verify in `next build` output that `Uploaded N source maps` appears. If running locally without the token, skip.

- [ ] **Step 8: Commit (no-op if previous tasks committed everything cleanly)**

```bash
git status
```

If clean: nothing to do. If dirty (likely lockfile drift): `git add -u && git commit -m "chore: workspace verify checkpoint"`.

---

## Task 16: CLAUDE.md slice 10 entry + memory update

- [ ] **Step 1: Update `CLAUDE.md` — append to the "Slices delivered" list**

Insert (before any closing horizontal rule of the section):

```markdown
- **Slice 10 — `@chiaro/officials-ui` shared component package** (2026-05-22): RNW full conversion of all 57 web + mobile UI components into a new workspace package (count 10 → 11). Web uses `react-native-web@0.19` via `next.config.mjs` `transpilePackages` + webpack alias. `ChiaroClientProvider` React Context provides the Supabase client at the layout level — eliminates ~30 per-card `useMemo(createSupabaseBrowserClient)` calls. Navigation handled via `onSelect` callback props on the 4 nav-bearing components. `DistrictMap` + `DistrictPanel` stay platform-specific (react-leaflet vs react-native-maps). ~114 component files collapsed to ~57. Component tests consolidated into `packages/officials-ui/test/` via vitest + RNW alias. No schema work (pgTAP unchanged at 409 plans).
```

- [ ] **Step 2: Add a new Gotcha #19 (if any cross-cutting friction emerged during implementation)**

Sample template (only commit if relevant):

```markdown
19. **React-Native-Web in Next 15 has these constraints:** (a) `react-native` must be listed in `transpilePackages` alongside `@chiaro/officials-ui` and `react-native-web` so its source flatpacks. (b) The webpack alias `react-native$` (with trailing `$`) ensures exact-match resolution; without `$`, deep imports like `react-native/Libraries/StyleSheet/StyleSheet` would also alias and fail. (c) `lineHeight` in RN is in px (numeric), not unitless — converting `lineHeight: 1.4` requires multiplying by font-size first. (d) `fontWeight` must be a string in RN strict mode; web allows numbers but RN's type complains. (e) `accessibilityRole="header"` + `accessibilityLevel={N}` is the only AT-correct way to preserve `<h1>`/`<h2>` semantics; RNW renders them as `<div role="heading" aria-level="N">`.
```

- [ ] **Step 3: Update memory**

Write `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice10_officials_ui.md` with:

```markdown
---
name: project-chiaro-slice10-officials-ui
description: Slice 10 — @chiaro/officials-ui shared component package (RNW)
metadata: 
  type: project
---

Slice 10 shipped 2026-05-22 — merged locally to master as squash `<HASH>`.

**What shipped:**
- New workspace package `@chiaro/officials-ui` (workspace count 10 → 11)
- 57 components migrated from web + mobile duplicate trees into single source
- ~114 files → ~57; ~50 fewer test files
- `react-native-web@0.19` + Next 15 transpilePackages + webpack alias
- `ChiaroClientProvider` React Context replaces ~30 `useMemo(createSupabaseBrowserClient)` calls
- `onSelect` callback prop pattern for 4 nav-bearing components
- `DistrictMap` + `DistrictPanel` stay platform-specific (out of scope)

**Durable lessons:**
- [populate with anything that surprised the implementer]

**Cross-links:** [[project-chiaro-slice6-federal-redesign]]
```

Update `MEMORY.md` (the index) — add this line in semantic position:

```markdown
- [Chiaro slice 10 officials-ui shared package](project_chiaro_slice10_officials_ui.md) — RNW conversion of all 57 detail-page components; ChiaroClientProvider Context; callback-prop nav
```

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: slice 10 closure — CLAUDE.md entry + Gotcha #19

@chiaro/officials-ui (workspace 11) consolidates web + mobile
officials UI under react-native-web. DistrictMap/DistrictPanel
remain platform-specific. Schema unchanged at migrations 0001-0052;
pgTAP unchanged at 409 plans across 31 files."
```

- [ ] **Step 5: Push branch + offer handoff**

Branch `slice-10-officials-ui` ready for squash-merge to master via the established slice-handoff workflow.

```bash
git log --oneline master..HEAD
```

Expected: ~14-16 commits on the branch.

Hand off to user for squash-merge approval.

---

## Self-review notes

### Spec coverage

- ✅ Package structure (Section 1 of spec) — Task 1 scaffolds; Tasks 5–11 populate.
- ✅ What stays in apps — explicit deletion lists in each task preserve `DistrictMap` + `DistrictPanel`.
- ✅ Dependency direction (one-way) — Task 1's `package.json` lists `@chiaro/db`, `@chiaro/officials`, etc. as deps; no reverse imports.
- ✅ Web RNW config (Section 2) — Task 3.
- ✅ Mobile config — Task 4.
- ✅ Package source-import via `main: ./src/index.ts` — Task 1.
- ✅ Tests config (vitest+RNW jsdom) — Task 1 Step 3.
- ✅ `'use client'` scope on Provider only — Task 2 Step 3.
- ✅ Web provider mount inside QueryProvider — Task 3 Step 3.
- ✅ Mobile provider mount inside `_layout` — Task 4 Step 2.
- ✅ Per-card `useMemo(createClient)` → `useChiaroClient` — Task 7 canonical pattern.
- ✅ Element substitutions table — Universal translation reference.
- ✅ Style normalizations — Universal translation reference.
- ✅ Verified non-issues (`:hover`, `dangerouslySetInnerHTML`, forms) — documented in spec; no task needed.
- ✅ 6 phases — represented as Tasks 1–4 (Phase 1), 5–6 (Phase 2), 7–8 (Phase 3), 9–10 (Phase 4), 11–12 (Phase 5), 13–15 (Phase 6), 16 (closure).
- ✅ Test split table — Task 13 + Task 14 enforce.
- ✅ Acceptance criteria (typecheck × 11 / test / web build / visual smoke / Sentry / CLAUDE.md) — Task 15 covers; Task 16 covers CLAUDE.md.
- ✅ Non-goals — DistrictMap/DistrictPanel stay platform-specific (enforced by deletion lists); no Tailwind/CSS-in-JS adoption; no other-package transpile entries.

### Placeholder scan

No "TBD", "TODO", "implement later", or "Similar to Task N" without code. The canonical-example tasks (5, 7, 8, 11) show one component in full, then list remaining components with their actual hook + list dependencies — the implementer applies the same pattern.

### Type consistency

- `ChiaroClient` type imported from `@chiaro/supabase-client` consistently across all references.
- `useChiaroClient()` (no args) returns `ChiaroClient` in Task 2 and is called the same way in Tasks 7–11.
- `OfficialsCardProps.onSelect` accepts `{ officialId, subCascadeSlug? }` consistently in Task 11.
- `AlignmentChipProps.onPress` is `() => void` in Task 11 (no arg) — caller curries the navigation.

### Known incomplete details

- The 6 federal cards in Task 7 each list "lists consumed" rather than restating each list's full implementation. The implementer reads the existing web file at port-time as the source of truth — this is acceptable because the universal translation rules are mechanical and the existing web file is the spec for behavior.
- Task 11 references `selectTopAlignmentChips` + `groupOfficialsByLevel` derivation hoisting. If these helpers are non-trivial, the implementer may need to add a "derivations move" sub-step. Watch for this.
- The exact set of "import sites that referenced PartyBadge" etc. is determined at port-time via Grep. The plan documents the canonical replacement pattern but does not enumerate every file — there are too many to list, and `grep -rn 'from .*PartyBadge'` is the authoritative source.
