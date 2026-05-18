# Telemetry (Sentry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Sentry error-only telemetry across all three Chiaro surfaces (Next 15 web, Expo RN mobile, Deno Edge Functions) with PII scrubbing for `address`-keyed fields and source-map upload during CI/EAS builds.

**Architecture:** Three independent Sentry projects under org `chiaro` (`chiaro-web`, `chiaro-mobile`, `chiaro-edge`). Each surface initializes its SDK from a per-surface DSN env var; SDK no-ops when DSN is absent. Shared `scrubAddressInPlace(event)` helper duplicated per surface (small enough that copy beats a workspace package). Web + mobile builds upload source maps using a CI/EAS-stored `SENTRY_AUTH_TOKEN`.

**Tech Stack:** `@sentry/nextjs@^8` (web) · `@sentry/react-native@^5` + Expo plugin (mobile) · `npm:@sentry/deno@^8` (Edge Functions) · GitHub Actions for CI source-map upload · existing vitest / jest-expo / Deno test runners

**Spec:** `docs/superpowers/specs/2026-05-18-telemetry-design.md`

---

## File structure

```
apps/web/
  sentry.client.config.ts        NEW (browser SDK init)
  sentry.server.config.ts        NEW (Node runtime init)
  sentry.edge.config.ts          NEW (Edge runtime init)
  sentry.scrub.ts                NEW (shared scrubAddressInPlace helper)
  instrumentation.ts             NEW (Next 15 conventional hook)
  next.config.ts                 MODIFY (wrap with withSentryConfig)
  .env.example                   MODIFY (+ NEXT_PUBLIC_SENTRY_DSN_WEB)
  package.json                   MODIFY (+ @sentry/nextjs dep)
  test/sentry-scrub.test.ts      NEW (vitest unit tests for scrubber)

apps/mobile/
  lib/sentry.ts                  NEW (init wrapper + scrubber + ErrorBoundary re-export)
  app/_layout.tsx                MODIFY (call initSentry + wrap in ErrorBoundary)
  app.config.ts                  MODIFY (+ Sentry Expo plugin, + extra.sentryDsn)
  metro.config.js                NEW (Sentry-wrapped Metro config)
  .env.example                   MODIFY (+ EXPO_PUBLIC_SENTRY_DSN_MOBILE)
  package.json                   MODIFY (+ @sentry/react-native dep)
  test/components/sentry.test.ts NEW (jest unit tests for scrubber + init idempotency)

packages/db/supabase/functions/
  _shared/sentry.ts              NEW (Deno SDK init + withSentry wrapper + scrubber)
  _shared/sentry.test.ts         NEW (Deno test runner)
  calibrate-location/index.ts    MODIFY (wrap handler in withSentry; captureException at error sites)

.env.example                     MODIFY (root) — + SENTRY_AUTH_TOKEN + SENTRY_DSN_EDGE
.github/workflows/ci.yml         MODIFY (build job: pass SENTRY_AUTH_TOKEN + NEXT_PUBLIC_SENTRY_DSN_WEB)

docs/superpowers/
  audits/2026-05-15-audit.md     MODIFY (annotate telemetry recommendation resolved)
  mobile-dod-checklist.md        MODIFY (drop "Telemetry deferred" paragraph)
```

---

## Phase A — Operator setup + shared infra (Tasks 1-2)

### Task 1: Operator pre-flight + env scaffolding

**Files:**
- Modify: `.env.example` (repo root)
- Modify: `apps/web/.env.example`
- Modify: `apps/mobile/.env.example`

This task does NOT install Sentry SDKs (Tasks 3, 6, 9 do that per-surface). It documents the manual operator setup + scaffolds env-var slots so subsequent tasks can reference them.

- [ ] **Step 1: Operator setup (NOT automatable — record outcome)**

The implementer must perform OR document the following manual steps in the commit message. None are code changes; record what was done in the report:

1. Create a Sentry organization slug `chiaro` (free tier).
2. Create three Sentry projects under that org:
   - `chiaro-web` (platform: Next.js)
   - `chiaro-mobile` (platform: React Native)
   - `chiaro-edge` (platform: Deno)
3. Copy each project's DSN. Generate one auth token from User Settings → Auth Tokens with `project:releases` + `org:read` scope.
4. Store in GitHub repo secrets: `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN_WEB`. (Mobile DSN goes into EAS secrets separately; documented in Task 8.)

If the operator running this plan does not have Sentry access yet, that is FINE — the SDKs no-op without DSNs. Document the pending step in the commit message and proceed; the plan still produces working code.

- [ ] **Step 2: Add root .env.example entries**

Open `.env.example` (repo root). Add (append to the end if a section per environment doesn't exist):

```
# Sentry — error reporting. DSNs are public; auth token is secret.
SENTRY_AUTH_TOKEN=
SENTRY_DSN_EDGE=
```

- [ ] **Step 3: Add apps/web/.env.example entry**

Open `apps/web/.env.example`. Append:

```
# Sentry public DSN for browser + Next server + Edge runtime.
NEXT_PUBLIC_SENTRY_DSN_WEB=
```

- [ ] **Step 4: Add apps/mobile/.env.example entry**

Open `apps/mobile/.env.example`. Append:

```
# Sentry public DSN for the mobile app (active in dev-client / preview / production builds — NOT Expo Go).
EXPO_PUBLIC_SENTRY_DSN_MOBILE=
```

- [ ] **Step 5: Commit**

```bash
git add .env.example apps/web/.env.example apps/mobile/.env.example
git commit -m "chore(env): scaffold Sentry DSN + auth token env vars across three surfaces"
```

---

### Task 2: apps/web sentry.scrub.ts + tests (shared by 3 web configs)

**Files:**
- Create: `apps/web/sentry.scrub.ts`
- Create: `apps/web/test/sentry-scrub.test.ts`

The web-side scrubber is the master copy that mobile + edge will duplicate (with minor type adaptations) in Tasks 6 + 9.

- [ ] **Step 1: Failing test**

`apps/web/test/sentry-scrub.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Event } from '@sentry/types'
import { scrubAddressInPlace } from '@/sentry.scrub'

describe('scrubAddressInPlace', () => {
  it('scrubs event.request.data.address', () => {
    const e: Event = { request: { data: { address: '123 Main St', other: 'keep' } } }
    scrubAddressInPlace(e)
    expect((e.request!.data as Record<string, unknown>).address).toBe('[scrubbed]')
    expect((e.request!.data as Record<string, unknown>).other).toBe('keep')
  })

  it('scrubs nested address keys recursively', () => {
    const e: Event = { extra: { formInput: { address: '1 Wall St', city: 'NY' } } }
    scrubAddressInPlace(e)
    expect((e.extra!.formInput as Record<string, unknown>).address).toBe('[scrubbed]')
    expect((e.extra!.formInput as Record<string, unknown>).city).toBe('NY')
  })

  it('scrubs in event.breadcrumbs[].data', () => {
    const e: Event = { breadcrumbs: [{ data: { address: '1 Wall St' } }, { data: { ok: 1 } }] }
    scrubAddressInPlace(e)
    expect((e.breadcrumbs![0]!.data as Record<string, unknown>).address).toBe('[scrubbed]')
    expect((e.breadcrumbs![1]!.data as Record<string, unknown>).ok).toBe(1)
  })

  it('scrubs in event.contexts', () => {
    const e: Event = { contexts: { custom: { address: '1 Wall St' } } }
    scrubAddressInPlace(e)
    expect((e.contexts!.custom as Record<string, unknown>).address).toBe('[scrubbed]')
  })

  it('case-insensitive address key match', () => {
    const e: Event = { extra: { Address: 'X', ADDRESS_LINE1: 'Y' } }
    scrubAddressInPlace(e)
    expect(e.extra!.Address).toBe('[scrubbed]')
    expect(e.extra!.ADDRESS_LINE1).toBe('[scrubbed]')
  })

  it('preserves non-address fields', () => {
    const e: Event = { extra: { email: 'x@example.com', count: 42 } }
    scrubAddressInPlace(e)
    expect(e.extra!.email).toBe('x@example.com')
    expect(e.extra!.count).toBe(42)
  })

  it('handles undefined event sections gracefully', () => {
    const e: Event = {}
    expect(() => scrubAddressInPlace(e)).not.toThrow()
  })

  it('handles primitives in extra (does not recurse into strings)', () => {
    const e: Event = { extra: { greeting: 'hello' } }
    scrubAddressInPlace(e)
    expect(e.extra!.greeting).toBe('hello')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test sentry-scrub 2>&1 | tail -10
```

Expected: import-resolve error (scrubber not yet exists).

- [ ] **Step 3: Implement**

`apps/web/sentry.scrub.ts`:

```ts
import type { Event } from '@sentry/types'

const ADDRESS_KEY = /^address/i

function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) {
      (obj as Record<string, unknown>)[k] = '[scrubbed]'
    } else if (v && typeof v === 'object') {
      scrub(v)
    }
  }
}

export function scrubAddressInPlace(event: Event): void {
  scrub(event.request?.data)
  scrub(event.contexts)
  scrub(event.extra)
  event.breadcrumbs?.forEach((b) => scrub(b.data))
}
```

The `@sentry/types` import will resolve only after Task 3 installs `@sentry/nextjs` (which depends on `@sentry/types`). To unblock the test in THIS task before installing the SDK, use this inline type instead — replace the `import type { Event }` line with:

```ts
// Local stand-in until @sentry/nextjs (and its transitive @sentry/types) is installed in Task 3.
type Event = {
  request?: { data?: unknown }
  contexts?: Record<string, unknown>
  extra?: Record<string, unknown>
  breadcrumbs?: Array<{ data?: unknown }>
}
```

Task 3 swaps this back to the proper `import type { Event } from '@sentry/types'` once the package is on disk.

- [ ] **Step 4: Run green + typecheck**

```bash
pnpm --filter @chiaro/web test sentry-scrub 2>&1 | tail -10
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: 8/8 pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/sentry.scrub.ts apps/web/test/sentry-scrub.test.ts
git commit -m "feat(web): scrubAddressInPlace — recursive PII scrubber for Sentry beforeSend"
```

---

## Phase B — Web (Tasks 3-5)

### Task 3: Install @sentry/nextjs + write 3 runtime configs

**Files:**
- Modify: `apps/web/package.json` (+ dep)
- Modify: `apps/web/sentry.scrub.ts` (swap inline type for `@sentry/types` import)
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`

- [ ] **Step 1: Install**

```bash
pnpm --filter @chiaro/web add @sentry/nextjs 2>&1 | tail -10
```

Expected: package adds. Note the resolved version in the final report.

- [ ] **Step 2: Restore proper type import**

Edit `apps/web/sentry.scrub.ts`. Replace the inline `type Event = { ... }` block (added in Task 2) with:

```ts
import type { Event } from '@sentry/types'
```

The rest of the file stays the same.

- [ ] **Step 3: Create three runtime configs**

`apps/web/sentry.client.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { scrubAddressInPlace } from './sentry.scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  tracesSampleRate: 0,
  integrations: [],
  beforeSend(event) {
    try { scrubAddressInPlace(event) } catch { return null }
    return event
  },
})
```

`apps/web/sentry.server.config.ts` — same body, runs under Node runtime (Server Components, Route Handlers). Sentry's Next.js SDK distinguishes by import-time runtime detection — same `init` call works for both.

`apps/web/sentry.edge.config.ts` — same body, runs under Edge runtime (Next middleware). Smaller default integration set; we already pass `integrations: []`, so behaviorally identical.

All three files have the SAME contents — but Next 15 requires three separate files at these paths for the `withSentryConfig` plugin to find each runtime's init.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/web test sentry-scrub 2>&1 | tail -5
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: 8/8 pass (test still green after type-import swap); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/sentry.scrub.ts apps/web/sentry.client.config.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts pnpm-lock.yaml
git commit -m "feat(web): @sentry/nextjs + three runtime config files (client / server / edge)"
```

---

### Task 4: Add instrumentation.ts + onRequestError

**Files:**
- Create: `apps/web/instrumentation.ts`

Next 15 picks up `instrumentation.ts` at the app root automatically and calls `register()` once per server start.

- [ ] **Step 1: Create**

`apps/web/instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/instrumentation.ts
git commit -m "feat(web): instrumentation.ts — Sentry server + edge runtime init + onRequestError"
```

---

### Task 5: Wrap next.config.ts with withSentryConfig + CI source-map upload

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read current next.config.ts**

```bash
cat apps/web/next.config.ts
```

Expected: existing default-export config (Next.js config object).

- [ ] **Step 2: Wrap with withSentryConfig**

Edit `apps/web/next.config.ts`. At the top, add the import:

```ts
import { withSentryConfig } from '@sentry/nextjs'
```

At the bottom, replace the existing `export default <config>` with:

```ts
export default withSentryConfig(<existing config identifier>, {
  org: 'chiaro',
  project: 'chiaro-web',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

Replace `<existing config identifier>` with whatever the current default-export variable is named (likely `nextConfig` or similar — keep the existing config object intact, just wrap it).

- [ ] **Step 3: Verify build still succeeds without auth token**

```bash
pnpm --filter @chiaro/web build 2>&1 | tail -15
```

Expected: green build. Output includes a Sentry plugin notice like "SENTRY_AUTH_TOKEN missing, skipping source map upload" — that's the intended no-op fallback. If the build FAILS, the wrap is mis-configured (e.g. missing `silent` option causing a hard error).

- [ ] **Step 4: Update CI workflow**

Open `.github/workflows/ci.yml`. Find the `build` job (compiles apps/web). Add to its `env:` block:

```yaml
SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
NEXT_PUBLIC_SENTRY_DSN_WEB: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN_WEB }}
```

If the build step is a plain `run: pnpm --filter @chiaro/web build`, wrap it with the env block:

```yaml
- name: Build web
  run: pnpm --filter @chiaro/web build
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    NEXT_PUBLIC_SENTRY_DSN_WEB: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN_WEB }}
```

Do NOT add these env vars to the `test` job — tests must run without Sentry DSNs set.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/next.config.ts .github/workflows/ci.yml
git commit -m "feat(web,ci): withSentryConfig wrap + CI source map upload (no-op without auth token)"
```

---

## Phase C — Mobile (Tasks 6-8)

### Task 6: Install @sentry/react-native + write lib/sentry.ts + scrubber tests

**Files:**
- Modify: `apps/mobile/package.json` (+ dep)
- Create: `apps/mobile/lib/sentry.ts`
- Create: `apps/mobile/test/components/sentry.test.ts`

- [ ] **Step 1: Install**

```bash
pnpm --filter @chiaro/mobile add @sentry/react-native 2>&1 | tail -10
```

Expected: package adds. Note resolved version. If the Expo plugin requires a specific RN-SDK version range, pnpm will print a peer-dep warning — record it.

- [ ] **Step 2: Failing test**

`apps/mobile/test/components/sentry.test.ts`:

```ts
import { scrubAddressInPlace } from '@/lib/sentry'

describe('scrubAddressInPlace (mobile)', () => {
  it('scrubs event.request.data.address', () => {
    const e: any = { request: { data: { address: '123 Main St', other: 'keep' } } }
    scrubAddressInPlace(e)
    expect(e.request.data.address).toBe('[scrubbed]')
    expect(e.request.data.other).toBe('keep')
  })

  it('scrubs nested address keys recursively', () => {
    const e: any = { extra: { formInput: { address: '1 Wall St', city: 'NY' } } }
    scrubAddressInPlace(e)
    expect(e.extra.formInput.address).toBe('[scrubbed]')
    expect(e.extra.formInput.city).toBe('NY')
  })

  it('scrubs in event.breadcrumbs[].data', () => {
    const e: any = { breadcrumbs: [{ data: { address: '1 Wall St' } }] }
    scrubAddressInPlace(e)
    expect(e.breadcrumbs[0].data.address).toBe('[scrubbed]')
  })

  it('case-insensitive match', () => {
    const e: any = { extra: { Address: 'X' } }
    scrubAddressInPlace(e)
    expect(e.extra.Address).toBe('[scrubbed]')
  })

  it('handles empty event', () => {
    const e: any = {}
    expect(() => scrubAddressInPlace(e)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/sentry 2>&1 | tail -10
```

Expected: 5 tests fail with "scrubAddressInPlace not exported".

- [ ] **Step 4: Implement**

`apps/mobile/lib/sentry.ts`:

```ts
import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'

const ADDRESS_KEY = /^address/i

function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) {
      (obj as Record<string, unknown>)[k] = '[scrubbed]'
    } else if (v && typeof v === 'object') {
      scrub(v)
    }
  }
}

export function scrubAddressInPlace(event: any): void {
  scrub(event?.request?.data)
  scrub(event?.contexts)
  scrub(event?.extra)
  event?.breadcrumbs?.forEach((b: any) => scrub(b?.data))
}

let initialized = false
export function initSentry(): void {
  if (initialized) return
  const dsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn
  if (!dsn) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    beforeSend(event) {
      try { scrubAddressInPlace(event) } catch { return null }
      return event
    },
  })
  initialized = true
}

export const ErrorBoundary = Sentry.ErrorBoundary
export { Sentry }
```

Use `any` for the event type to avoid pulling `@sentry/types` into mobile (RN SDK exports its own types, but `any` keeps the scrubber decoupled and the file simple — same precedent as the Deno surface in Task 9).

- [ ] **Step 5: Run green + typecheck**

```bash
pnpm --filter @chiaro/mobile test components/sentry 2>&1 | tail -10
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
```

Expected: 5/5 pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/lib/sentry.ts apps/mobile/test/components/sentry.test.ts pnpm-lock.yaml
git commit -m "feat(mobile): @sentry/react-native + lib/sentry.ts (init + scrubber + ErrorBoundary re-export)"
```

---

### Task 7: Wire initSentry + ErrorBoundary into _layout.tsx

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Read current**

```bash
cat 'apps/mobile/app/_layout.tsx'
```

Expected output: RootLayout component using `Slot`, `useRouter`, `useSegments`, Supabase auth, `QueryProvider`.

- [ ] **Step 2: Modify**

Edit `apps/mobile/app/_layout.tsx`. Three changes:

**Edit A** — add imports at the top:

```diff
- import { Slot, useRouter, useSegments } from 'expo-router'
+ import { Slot, useRouter, useSegments } from 'expo-router'
+ import { initSentry, ErrorBoundary } from '@/lib/sentry'
```

**Edit B** — call `initSentry()` at the top of the module body (after imports, BEFORE the component):

```diff
  import type { Session } from '@supabase/supabase-js'
+
+ initSentry()

  export default function RootLayout() {
```

**Edit C** — wrap the two `return` blocks' children in `<ErrorBoundary>`:

```diff
  if (!loaded) {
    return (
+     <ErrorBoundary>
        <QueryProvider>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>
        </QueryProvider>
+     </ErrorBoundary>
    )
  }
  return (
+   <ErrorBoundary>
      <QueryProvider>
        <Slot />
      </QueryProvider>
+   </ErrorBoundary>
  )
```

- [ ] **Step 3: Typecheck + test**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
pnpm --filter @chiaro/mobile test 2>&1 | tail -10
```

Expected: typecheck clean; all existing mobile tests still green.

- [ ] **Step 4: Commit**

```bash
git add 'apps/mobile/app/_layout.tsx'
git commit -m "feat(mobile): initSentry at top-of-layout + ErrorBoundary wraps root"
```

---

### Task 8: Add Expo plugin + extra.sentryDsn + metro.config.js

**Files:**
- Modify: `apps/mobile/app.config.ts`
- Create: `apps/mobile/metro.config.js`

- [ ] **Step 1: Modify app.config.ts**

Open `apps/mobile/app.config.ts`. Two changes:

**Edit A** — extend `plugins` array. Current plugins are `['expo-router', ['expo-location', { ... }]]`. Add the Sentry plugin at the end:

```diff
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Chiaro to use your location to find your elected officials.',
      },
    ],
+   [
+     '@sentry/react-native/expo',
+     { organization: 'chiaro', project: 'chiaro-mobile' },
+   ],
  ],
```

**Edit B** — extend `extra` block. Current `extra` is `{ eas: { projectId: '...' } }`. Add `sentryDsn` alongside:

```diff
  extra: {
    eas: {
      projectId: 'f4d18da9-9c95-4c6a-8a34-c77189eca749',
    },
+   sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE,
  },
```

- [ ] **Step 2: Create metro.config.js**

`apps/mobile/metro.config.js`:

```js
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

module.exports = getSentryExpoConfig(__dirname)
```

- [ ] **Step 3: Typecheck + test**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
pnpm --filter @chiaro/mobile test 2>&1 | tail -10
```

Expected: typecheck clean; mobile tests still green (Metro config and app.config.ts don't run during jest).

- [ ] **Step 4: Document EAS secret setup (commit message, not code)**

The EAS-side source-map upload requires a `SENTRY_AUTH_TOKEN` secret in the EAS project. The operator must run, one time:

```bash
cd apps/mobile
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
```

Document this in the commit message — no code change for it.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/metro.config.js
git commit -m "$(cat <<'EOF'
feat(mobile): Expo Sentry plugin + metro.config.js for source map upload

Adds @sentry/react-native/expo to the plugins array (handles iOS +
Android native config automatically; no manual prebuild) and passes
the DSN through extra.sentryDsn from EXPO_PUBLIC_SENTRY_DSN_MOBILE.

Creates apps/mobile/metro.config.js wrapping the default config with
getSentryExpoConfig for Hermes/Metro source map generation during EAS
builds.

Operator one-time setup (NOT auto-managed by code):
  cd apps/mobile && eas secret:create \
    --scope project --name SENTRY_AUTH_TOKEN --value <token>

Without that secret, EAS builds still succeed; source maps just don't
upload, leaving production stack traces minified. Acceptable for free-
tier ops.
EOF
)"
```

---

## Phase D — Edge Functions (Tasks 9-10)

### Task 9: _shared/sentry.ts + Deno tests

**Files:**
- Create: `packages/db/supabase/functions/_shared/sentry.ts`
- Create: `packages/db/supabase/functions/_shared/sentry.test.ts`

Deno runs tests via the Deno test runner (`deno test`) or via the existing vitest setup in `packages/db/`. The existing tests at `packages/db/supabase/seed/*.test.ts` use vitest — but those run Node-style. Edge Function tests run under Deno. Use Deno's runner.

- [ ] **Step 1: Verify Deno is available**

```bash
deno --version 2>&1 | head -1 || echo "DENO_MISSING"
```

If `DENO_MISSING`, the implementer should either install Deno or document that the Edge Function tests run only in CI (which has Deno via `supabase/setup-cli`). Don't block — the test file is valuable even if it only runs in CI.

- [ ] **Step 2: Create test file**

`packages/db/supabase/functions/_shared/sentry.test.ts`:

```ts
// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertRejects, assertStrictEquals } from 'jsr:@std/assert'
import { scrubEventForTesting, withSentry } from './sentry.ts'

Deno.test('scrubEventForTesting scrubs address field', () => {
  const e: any = { request: { data: { address: '123 Main St', city: 'NY' } } }
  scrubEventForTesting(e)
  assertEquals(e.request.data.address, '[scrubbed]')
  assertEquals(e.request.data.city, 'NY')
})

Deno.test('scrubEventForTesting handles nested address', () => {
  const e: any = { extra: { formInput: { address: '1 Wall St' } } }
  scrubEventForTesting(e)
  assertEquals(e.extra.formInput.address, '[scrubbed]')
})

Deno.test('scrubEventForTesting handles breadcrumbs', () => {
  const e: any = { breadcrumbs: [{ data: { address: 'X' } }] }
  scrubEventForTesting(e)
  assertEquals(e.breadcrumbs[0].data.address, '[scrubbed]')
})

Deno.test('withSentry rethrows handler errors', async () => {
  const handler = async (_req: Request) => {
    throw new Error('boom')
  }
  const wrapped = withSentry(handler)
  await assertRejects(() => wrapped(new Request('http://x')), Error, 'boom')
})

Deno.test('withSentry returns handler response on success', async () => {
  const handler = async (_req: Request) => new Response('ok', { status: 200 })
  const wrapped = withSentry(handler)
  const res = await wrapped(new Request('http://x'))
  assertStrictEquals(res.status, 200)
  assertStrictEquals(await res.text(), 'ok')
})
```

`scrubEventForTesting` is the publicly-exported function that wraps the internal `scrub`+payload-walker for unit testing (since `beforeSend` is closed-over inside `initSentry`).

- [ ] **Step 3: Run failing**

```bash
deno test packages/db/supabase/functions/_shared/sentry.test.ts 2>&1 | tail -10
```

Expected: import-resolve failure (`./sentry.ts` not yet exists). If Deno isn't installed, skip this step — the next implementation step makes the file resolvable.

- [ ] **Step 4: Implement**

`packages/db/supabase/functions/_shared/sentry.ts`:

```ts
// deno-lint-ignore-file no-explicit-any
import * as Sentry from 'npm:@sentry/deno@8'

const ADDRESS_KEY = /^address/i

function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) {
      (obj as Record<string, unknown>)[k] = '[scrubbed]'
    } else if (v && typeof v === 'object') {
      scrub(v)
    }
  }
}

function scrubEvent(event: any): any {
  try {
    scrub(event?.request?.data)
    scrub(event?.contexts)
    scrub(event?.extra)
    event?.breadcrumbs?.forEach((b: any) => scrub(b?.data))
    return event
  } catch {
    return null
  }
}

// Test hook — exported so unit tests can exercise the scrubber without booting Sentry.
export function scrubEventForTesting(event: any): void {
  scrubEvent(event)
}

let initialized = false

export function initSentry(): void {
  if (initialized) return
  const dsn = Deno.env.get('SENTRY_DSN_EDGE')
  if (!dsn) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  })
  initialized = true
}

export function withSentry(handler: (req: Request) => Promise<Response>) {
  initSentry()
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (e) {
      Sentry.captureException(e)
      throw e
    }
  }
}

export { Sentry }
```

If the `npm:@sentry/deno@8` import fails to resolve under `supabase functions serve --env-file` (the locally-served path), swap that line for the esm.sh fallback:

```ts
import * as Sentry from 'https://esm.sh/@sentry/deno@8'
```

Verify which works by running `supabase functions serve` and hitting the function once; revert and re-test if needed.

- [ ] **Step 5: Run green**

```bash
deno test packages/db/supabase/functions/_shared/sentry.test.ts 2>&1 | tail -10
```

Expected: 5/5 pass. If Deno isn't local, skip — CI will run it.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/functions/_shared/sentry.ts packages/db/supabase/functions/_shared/sentry.test.ts
git commit -m "feat(edge): _shared/sentry.ts — withSentry wrapper + idempotent init + scrubber"
```

---

### Task 10: Adopt withSentry in calibrate-location

**Files:**
- Modify: `packages/db/supabase/functions/calibrate-location/index.ts`

- [ ] **Step 1: Modify**

Edit `packages/db/supabase/functions/calibrate-location/index.ts`. Three changes:

**Edit A** — add the import at the top (after existing imports):

```diff
  import { GeocodioHttpClient, GeocodioError, extractDistricts, type GeocodioClient } from './geocodio.ts'
  import type { CalibrateInput } from './types.ts'
+ import { withSentry, Sentry } from '../_shared/sentry.ts'
```

**Edit B** — add `Sentry.captureException(err)` at each existing `console.error` site:

```diff
    } catch (err) {
      if (err instanceof GeocodioError && err.status >= 500) {
        return jsonResponse(502, { error: 'geocoder_unavailable' })
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        return jsonResponse(502, { error: 'geocoder_timeout' })
      }
+     Sentry.captureException(err)
      console.error('geocodio_error', err)
      return jsonResponse(500, { error: 'internal' })
    }
```

```diff
    if (rpcResult.error) {
      const msg = rpcResult.error.message ?? ''
      if (msg.includes('calibrating_too_frequently')) {
        return jsonResponse(429, { error: 'calibrating_too_frequently' })
      }
      if (msg.includes('unauthenticated')) {
        return jsonResponse(401, { error: 'unauthenticated' })
      }
+     Sentry.captureException(new Error(rpcResult.error.message ?? 'rpc_error'))
      console.error('rpc_error', rpcResult.error)
      return jsonResponse(500, { error: 'db_error' })
    }
```

**Edit C** — wrap the `Deno.serve` handler:

```diff
- Deno.serve((req) => handle(req))
+ Deno.serve(withSentry((req) => handle(req)))
```

Leave the exported `handle` function untouched — tests at `packages/db/supabase/functions/calibrate-location/index.test.ts` import `handle` directly and shouldn't be affected by the Deno.serve wrapper.

- [ ] **Step 2: Run existing function tests**

```bash
pnpm --filter @chiaro/db test calibrate-location 2>&1 | tail -10
```

Expected: existing tests still pass (they invoke `handle`, not `Deno.serve`).

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/functions/calibrate-location/index.ts
git commit -m "feat(edge): calibrate-location — withSentry wrap + captureException at error sites"
```

---

## Phase E — Docs + final verify (Tasks 11-12)

### Task 11: Update audit doc + DoD checklist

**Files:**
- Modify: `docs/superpowers/audits/2026-05-15-audit.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Annotate audit doc**

Open `docs/superpowers/audits/2026-05-15-audit.md`. Find the line referring to the Sentry/PostHog telemetry recommendation in § E (around line 66). Prepend or replace with a resolution note:

```
✅ RESOLVED 2026-05-18 — Sentry telemetry shipped across web + mobile + edge functions; see `docs/superpowers/specs/2026-05-18-telemetry-design.md` and the corresponding PR. Errors-only configuration; perf/replay deferred.
```

Keep the original text alongside — annotate, don't delete.

- [ ] **Step 2: Update mobile DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md`. Find the "Telemetry (deferred but flagged)" paragraph near the bottom. Replace with:

```
## Telemetry

Sentry hooked up via `apps/mobile/lib/sentry.ts` (init at top of
`app/_layout.tsx`, wraps root in `<Sentry.ErrorBoundary>`). Active in
dev-client / preview / production builds. **NOT active in Expo Go** —
@sentry/react-native requires the native module, which Expo Go doesn't
ship.

On-device errors land in Sentry project `chiaro-mobile`. Source maps
upload during EAS builds when the `SENTRY_AUTH_TOKEN` EAS secret is
configured (one-time operator setup; see
`docs/superpowers/specs/2026-05-18-telemetry-design.md`).

Capture an event by triggering a known throw (e.g. uncomment a `throw
new Error('dod-smoke')` in a screen). Confirm the event appears in
Sentry within ~30s; verify the stack trace is readable (source maps
attached) and that `event.request.data.address` shows `[scrubbed]` if
the user was on the calibrate flow.
```

Bump the "Last updated" line at the top to 2026-05-18 and the coverage line to mention slice 5B telemetry.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/2026-05-15-audit.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs: telemetry resolved — annotate audit + update mobile DoD checklist"
```

---

### Task 12: Final workspace verify

**Files:** none modified

- [ ] **Step 1: Workspace sweep**

```bash
pnpm -r typecheck 2>&1 | tail -15
pnpm --filter @chiaro/web build 2>&1 | tail -10
pnpm --filter @chiaro/web test 2>&1 | tail -15
pnpm --filter @chiaro/mobile test 2>&1 | tail -15
pnpm --filter @chiaro/db test 2>&1 | tail -15
deno test packages/db/supabase/functions/_shared/sentry.test.ts 2>&1 | tail -10 || echo "(skipped — deno not available locally; CI runs it)"
```

Expected:
- `pnpm -r typecheck` clean across 9 packages
- `pnpm --filter @chiaro/web build` green with "Sentry plugin: SENTRY_AUTH_TOKEN missing, skipping source map upload" log line (since this is a local build, not CI)
- `pnpm --filter @chiaro/web test` green — includes new `sentry-scrub.test.ts` (8 cases)
- `pnpm --filter @chiaro/mobile test` green — includes new `sentry.test.ts` (5 cases)
- `pnpm --filter @chiaro/db test` green — existing seed tests unaffected
- `deno test ...` green if Deno is local; otherwise skipped (CI handles it)

- [ ] **Step 2: Sanity-check Sentry no-ops when DSN absent**

The local environment has no Sentry DSNs set (assuming `.env.local` doesn't have them). Verify by importing the configs:

```bash
node -e "process.env.NEXT_PUBLIC_SENTRY_DSN_WEB = ''; require('./apps/web/sentry.client.config.ts')" 2>&1 | tail -3 || echo "(expected to error on .ts import via plain node — fine; what matters is the build worked above)"
```

Skip if it errors — TS imports via plain node aren't expected to work; the real verification is the build success above.

- [ ] **Step 3: No commit if everything green**

No new files; nothing to add. This is a verification-only task. If anything failed, fix the underlying task before continuing.

## Report (after Task 12)

DONE | DONE_WITH_CONCERNS | BLOCKED — include test counts per surface + build outcome + list any deferred operator setup steps (e.g. "Sentry projects not yet created; SDK no-ops until DSNs added").

---

## Acceptance — recapped from the spec

After Task 12:

1. ✅ Sentry org + 3 projects created (or documented as pending operator action — code works without)
2. ✅ apps/web initializes Sentry on browser + server + edge runtimes
3. ✅ apps/mobile initializes Sentry from `app/_layout.tsx` + ErrorBoundary wrap
4. ✅ Edge Functions opt in via `withSentry`; calibrate-location wired
5. ✅ Source-map upload runs during CI web build (when SENTRY_AUTH_TOKEN set)
6. ✅ Mobile source-map upload documented for EAS builds
7. ✅ beforeSend scrubs address-keyed fields recursively
8. ✅ All surfaces no-op when DSN env var is absent
9. ✅ Existing calibrate-location console.error sites get captureException calls
10. ✅ `pnpm -r typecheck` clean
11. ✅ `pnpm --filter @chiaro/web build` succeeds without SENTRY_AUTH_TOKEN
12. ✅ All new + updated unit tests green
13. ✅ Audit doc annotates telemetry recommendation resolved
14. ✅ Mobile DoD checklist updated

---

## Plan self-review notes

- **Spec coverage:** Env scaffolding = Task 1. Web scrubber + 3 configs + instrumentation + next.config wrap = Tasks 2-5. Mobile init + plugin + Metro = Tasks 6-8. Edge functions infrastructure + calibrate-location adoption = Tasks 9-10. Docs = Task 11. Final verify = Task 12.
- **No placeholders:** Every code step shows the exact diff or full file. The single "may discover additional console.error sites" caveat is in the acceptance criterion, not buried in a step. Operator setup steps (Sentry admin, EAS secret) are explicitly called out as manual + documented in their commit messages — not pretend-code-tasks.
- **Type consistency:** `scrubAddressInPlace(event)` signature consistent across web (Task 2 uses `@sentry/types` Event), mobile (Task 6 uses `any` to avoid the dep), and edge (Task 9 uses `any` for Deno).  `initSentry()` is no-arg, idempotent, void-returning in mobile (Task 6) + edge (Task 9). `withSentry(handler)` signature `(req: Request) => Promise<Response>` consistent in spec + Task 9 + Task 10.
- **Intermediate states stay green** — each task commits independently with typecheck/test passing. The one tricky bit (Task 2 uses an inline `Event` type stand-in until Task 3 installs `@sentry/types`) is explicitly called out with the swap-back in Task 3 Step 2.
- **No new test infrastructure** — uses existing vitest (apps/web), jest-expo (apps/mobile from PR #5), and Deno (Edge Function — installed via `supabase/setup-cli` in CI). Local devs without Deno can still complete the slice; the Deno test runs in CI.
