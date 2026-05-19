# Telemetry (Sentry) — Design Spec

**Date:** 2026-05-18
**Status:** Shipped 2026-05-19 via PR #6 (`4d9280e`). Operator pre-flight (Sentry org + 3 projects + GitHub/EAS/Supabase secrets) still pending — SDKs no-op until DSNs are set.
**Scope:** Hook up Sentry error-only telemetry across all three Chiaro surfaces: `apps/web` (Next 15 / React 19), `apps/mobile` (Expo SDK 54 / RN 0.81), and `packages/db/supabase/functions/*` (Deno Edge Functions). Wire source-map upload into web + mobile builds.
**Predecessor:** [Mobile DoD Parity](2026-05-18-mobile-dod-parity-design.md) (merged 2026-05-18 as PR #5)

---

## Goal

The 2026-05-15 audit (`docs/superpowers/audits/2026-05-15-audit.md` § E) called out missing telemetry as a slice-3+ prerequisite:

> error-reporting hookup (Sentry/PostHog) before Slice 3 ships, since debugging on a real device without telemetry is painful.

It has been deferred through slices 3, 4, 4.5, and 5A. This slice closes that gap with the minimum useful telemetry surface: **errors only** (no performance tracing, no replay, no profiling) across web + mobile + Edge Functions.

After this slice ships:
- Production crashes + unhandled rejections + thrown errors reach Sentry from all three surfaces
- Stack traces are readable (source maps uploaded for web + mobile builds; Deno bundles aren't minified)
- PII scrubbing redacts `address`-keyed fields (Chiaro's primary user-input PII surface — calibration flow)
- Per-surface Sentry projects give clean alert routing
- The mobile DoD on-device smoke (currently deferred) becomes meaningfully debuggable when a tester hits a bug

---

## Out of scope

- **Performance tracing / `tracesSampleRate > 0`.** Deferred — adds event volume, free-tier pressure, and isn't asked for. Revisit when ops needs query timing for GeocodIO / Supabase.
- **Session replay (web only).** Deferred — privacy review (GDPR/DSAR thinking) needed before turning on replay against real users.
- **Profiling.** Deferred — overhead + same privacy considerations as replay.
- **Sentry user identifier (`Sentry.setUser`)** wired into auth login. Errors ship as anonymous in this slice. Wiring `setUser` is a small follow-up; out-of-scope here to keep the auth modules untouched.
- **PostHog or any analytics vendor.** This slice is errors-only. Product analytics is a separate decision.
- **Frontend error boundaries beyond root-level mobile.** Web keeps Next 15's existing `error.tsx` convention. Per-route error UIs not added.
- **Distributed tracing / linking web → edge → DB requests via trace IDs.** Requires propagating `sentry-trace` headers; deferred along with performance.

---

## Locked decisions

| Decision | Choice | Source |
|---|---|---|
| Vendor | Sentry | Brainstorm clarifier; matches 2026-05-15 audit |
| Capture scope | Errors only (no perf, no replay, no profiling) | Brainstorm clarifier |
| Surfaces | All three (web + mobile + edge) in one slice | Brainstorm clarifier |
| Project granularity | Three Sentry projects (`chiaro-web`, `chiaro-mobile`, `chiaro-edge`) | Brainstorm Approach 1 |
| Init style | Manual `Sentry.init` in entry points (not wizard-auto) | Brainstorm Approach 1 |
| Source maps | Uploaded in CI for web + mobile; skipped for Deno (non-minified) | Brainstorm Approach 1 |
| PII scrubbing | `beforeSend` hook scrubs `address`-keyed fields | Design Section 4 |
| Sentry user ID | Anonymous events in this slice (follow-up to wire setUser) | Design Section 4 |

---

## Architecture

Three independent Sentry projects under one org `chiaro`. Each surface initializes its SDK from a per-surface DSN env var. Single `beforeSend(event)` PII-scrub hook copied per surface (small enough that duplication beats a new workspace package).

```
Sentry org "chiaro"
├─ project "chiaro-web"     ← apps/web (@sentry/nextjs)
├─ project "chiaro-mobile"  ← apps/mobile (@sentry/react-native + Expo plugin)
└─ project "chiaro-edge"    ← packages/db/supabase/functions/* (npm:@sentry/deno)
```

DSN env vars (DSNs are designed for client exposure; auth token is build-time only):

| Var | Used by | Scope |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN_WEB` | web client + server + edge runtime configs | public |
| `EXPO_PUBLIC_SENTRY_DSN_MOBILE` | mobile via `Constants.expoConfig.extra.sentryDsn` | public |
| `SENTRY_DSN_EDGE` | Edge Functions only | server-only |
| `SENTRY_AUTH_TOKEN` | CI source-map upload (web + mobile) | secret |
| `SENTRY_ORG=chiaro` | CI source-map upload | config |

No DB migrations, no domain logic changes, no UI changes except a single `<Sentry.ErrorBoundary>` wrap at the mobile app shell.

---

## Component changes

### apps/web (Next 15)

**New:** `apps/web/sentry.client.config.ts`

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

**New:** `apps/web/sentry.server.config.ts` + `apps/web/sentry.edge.config.ts` — same shape, swap `@sentry/nextjs` import context. Server config can use the same public DSN.

**New:** `apps/web/sentry.scrub.ts` — shared `scrubAddressInPlace(event)`:

```ts
import type { Event } from '@sentry/types'
const ADDRESS_KEY = /^address/i
function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) (obj as Record<string, unknown>)[k] = '[scrubbed]'
    else if (v && typeof v === 'object') scrub(v)
  }
}
export function scrubAddressInPlace(event: Event): void {
  scrub(event.request?.data)
  scrub(event.contexts)
  scrub(event.extra)
  event.breadcrumbs?.forEach(b => scrub(b.data))
}
```

**New:** `apps/web/instrumentation.ts`

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge')   await import('./sentry.edge.config')
}
export { captureRequestError as onRequestError } from '@sentry/nextjs'
```

**Modified:** `apps/web/next.config.ts` — wrap export with `withSentryConfig`:

```ts
import { withSentryConfig } from '@sentry/nextjs'
// existing config ...
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

**Modified:** `apps/web/.env.example` — add the DSN + auth token entries.

### apps/mobile (Expo SDK 54)

**New:** `apps/mobile/lib/sentry.ts`

```ts
import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import type { Event } from '@sentry/types'

const ADDRESS_KEY = /^address/i
function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) (obj as Record<string, unknown>)[k] = '[scrubbed]'
    else if (v && typeof v === 'object') scrub(v)
  }
}
export function scrubAddressInPlace(event: Event): void {
  scrub(event.request?.data)
  scrub(event.contexts)
  scrub(event.extra)
  event.breadcrumbs?.forEach(b => scrub(b.data))
}

let initialized = false
export function initSentry() {
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

**Modified:** `apps/mobile/app/_layout.tsx`

```diff
+ import { initSentry, ErrorBoundary } from '@/lib/sentry'
+ initSentry()
  // ... existing imports/component code ...
  return (
+   <ErrorBoundary>
      <Stack>
        ...existing children...
      </Stack>
+   </ErrorBoundary>
  )
```

**Modified:** `apps/mobile/app.config.ts`

```diff
  export default {
    expo: {
      ...,
+     plugins: [
+       ...(existing plugins ?? []),
+       ['@sentry/react-native/expo', { organization: 'chiaro', project: 'chiaro-mobile' }],
+     ],
      extra: {
        ...,
+       sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE,
      },
    },
  }
```

**New:** `apps/mobile/metro.config.js`

```js
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
module.exports = getSentryExpoConfig(__dirname)
```

### packages/db/supabase/functions/ (Deno)

**New:** `packages/db/supabase/functions/_shared/sentry.ts`

```ts
import * as Sentry from 'npm:@sentry/deno@8'

const ADDRESS_KEY = /^address/i
function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) (obj as Record<string, unknown>)[k] = '[scrubbed]'
    else if (v && typeof v === 'object') scrub(v)
  }
}
function scrubEvent(event: any): any {
  try {
    scrub(event.request?.data)
    scrub(event.contexts)
    scrub(event.extra)
    event.breadcrumbs?.forEach((b: any) => scrub(b.data))
    return event
  } catch { return null }
}

let initialized = false
export function initSentry(): void {
  if (initialized) return
  const dsn = Deno.env.get('SENTRY_DSN_EDGE')
  if (!dsn) return
  Sentry.init({ dsn, tracesSampleRate: 0, beforeSend: scrubEvent })
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

**Modified:** `packages/db/supabase/functions/calibrate-location/index.ts`

```diff
+ import { withSentry, Sentry } from '../_shared/sentry.ts'

- Deno.serve(async (req) => {
+ Deno.serve(withSentry(async (req) => {
    // ...existing logic...
    } catch (err) {
+     Sentry.captureException(err)
      console.error('geocodio_error', err)
      // ...
    }
    if (rpcResult.error) {
+     Sentry.captureException(new Error(rpcResult.error.message ?? 'rpc_error'))
      console.error('rpc_error', rpcResult.error)
      // ...
    }
- })
+ }))
```

### Env vars + CI

**Modified:** `.env.example` (repo root):

```
SENTRY_AUTH_TOKEN=
SENTRY_DSN_EDGE=
```

**Modified:** `apps/web/.env.example`:

```
NEXT_PUBLIC_SENTRY_DSN_WEB=
```

**Modified:** `apps/mobile/.env.example` (or eas.json — depending on existing convention):

```
EXPO_PUBLIC_SENTRY_DSN_MOBILE=
```

**Modified:** `.github/workflows/ci.yml` — `build` job:

```yaml
- run: pnpm --filter @chiaro/web build
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    NEXT_PUBLIC_SENTRY_DSN_WEB: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN_WEB }}
```

Mobile EAS source-map upload: documented as a one-time operator step (`eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value ...`) — not committed in code, so no eas.json change in this slice.

### Docs

**Modified:** `docs/superpowers/audits/2026-05-15-audit.md` — mark the telemetry recommendation as resolved with a callout pointing at this spec.

**Modified:** `docs/superpowers/mobile-dod-checklist.md` — drop the "Telemetry (deferred but flagged)" paragraph at the bottom; replace with "Telemetry hooked up — see Sentry `chiaro-mobile` project for on-device errors. Active only in dev-client / preview / production builds (not Expo Go)."

---

## Data flow

### Initialization (per surface)

```
[apps/web]
  Next 15 boots → instrumentation.ts:register()
    → NEXT_RUNTIME=nodejs → sentry.server.config.ts → Sentry.init(...)
    → NEXT_RUNTIME=edge   → sentry.edge.config.ts   → Sentry.init(...)
  Browser bundle (via withSentryConfig) auto-injects sentry.client.config.ts at page mount

[apps/mobile]
  app/_layout.tsx top-of-module → initSentry() reads expo extra → Sentry.init(...)
  ErrorBoundary wraps root <Stack>

[edge functions]
  Each function wraps Deno.serve handler in withSentry(...)
    → first request triggers initSentry() (idempotent) → Sentry.init(...)
```

### Error capture

```
[Unhandled exceptions]
  Web    → window.onerror + onunhandledrejection auto-bound by SDK
  Mobile → ErrorUtils + native crash reporter (via Expo plugin's native module)
  Edge   → withSentry try/catch → captureException + rethrow (Supabase returns 500)
                                ↓
                       Sentry SDK transport
                                ↓
                       beforeSend(event) → scrubAddressInPlace(event)
                                ↓
                       POST to ingest endpoint
                                ↓
                  Sentry org "chiaro" → project (web/mobile/edge)
```

### Handled errors (explicit captures)

Existing `console.error` sites get `Sentry.captureException()` calls alongside:

- `packages/db/supabase/functions/calibrate-location/index.ts` — `geocodio_error`, `rpc_error`
- Any other `console.error` discovered during implementation (currently 2 in `apps/web/lib`)

### Build-time (source maps)

```
pnpm --filter @chiaro/web build [in CI]
  ↓
  next build → Sentry webpack plugin (via withSentryConfig)
    → uploads .next/static/**/*.map to chiaro-web project using SENTRY_AUTH_TOKEN
    → hides source maps from client (hideSourceMaps: true)

eas build --platform [android|ios]
  ↓
  Expo plugin (in app.config.ts) + getSentryExpoConfig (in metro.config.js)
    → uploads Hermes bundle source maps to chiaro-mobile project
    → uses EAS secret SENTRY_AUTH_TOKEN (one-time operator setup)

supabase functions deploy
  ↓
  Deno bundle = no minification = no source map upload needed
```

---

## Error handling + edge cases

- **DSN missing in env** — each `Sentry.init` is gated by a presence check. App boots normally with zero telemetry. One console line announces "Sentry disabled (no DSN)" so dev environments still surface the state.
- **CI missing `SENTRY_AUTH_TOKEN`** — `withSentryConfig` no-ops the source-map upload; build still succeeds. Local dev builds (no token) work the same way.
- **`beforeSend` throws** — wrapped in try/catch; returns `null` so the event drops rather than ships unscrubbed. Test case covers circular references in `event.extra`.
- **Sentry ingest down / network error** — SDK has internal retry + in-memory queue. Mobile + edge buffers drop on process exit (acceptable for free-tier ops).
- **Expo Go** — `@sentry/react-native` requires the native module, which Expo Go doesn't ship. Sentry is active only in dev-client / preview / production builds. Document in the spec acceptance + DoD checklist.
- **Edge Function cold-start race** — `initSentry()` is idempotent (`initialized` flag). Multiple parallel invocations during a cold start all early-return after the first.
- **`npm:@sentry/deno@8` import** — works under Supabase's Deno runtime + `supabase functions serve`. If it fails to resolve in the local CLI, fall back to `https://esm.sh/@sentry/deno@8` (covered in implementation Task 9).
- **Sentry user identifier** — not wired in this slice. Errors ship as anonymous. Acceptable starting point; `setUser` follow-up in a future small slice.
- **Test isolation** — Sentry init reads DSN from env. vitest + jest both run without `SENTRY_DSN_*` exported, so `Sentry.init` early-returns and tests never ship events to Sentry. Verify in the plan's pre-flight: CI `test` jobs must NOT add the DSN secrets to their `env:` blocks (only the `build` job needs them).
- **SDK version pinning** — pin `@sentry/nextjs@^8`, `@sentry/react-native@^5`, `@sentry/deno@8` (or whichever versions the Expo plugin currently requires). Document resolved versions in the plan after first install.

---

## Testing

### New unit tests

- **`apps/web/test/sentry-scrub.test.ts`** — pure-function tests for `scrubAddressInPlace`:
  - Scrubs `event.request.data.address`
  - Scrubs nested `event.extra.formInput.address` (recursive)
  - Scrubs `event.breadcrumbs[].data.address`
  - Preserves non-address fields
  - Handles `event.contexts` containing addresses
  - `beforeSend` wrapper returns `null` when scrub throws (circular reference)
- **`apps/mobile/test/sentry.test.ts`** — same scrub logic, RN test runner (jest-expo). Mock `expo-constants` to provide a fake DSN; verify `initSentry()` calls `Sentry.init` once + early-returns on second call.
- **`packages/db/supabase/functions/_shared/sentry.test.ts`** — Deno test (`supabase functions test` or `deno test`):
  - `withSentry(handler)` rethrows handler errors after capturing
  - `initSentry()` is idempotent
  - Scrub function handles event payloads with addresses

### No mobile integration test

The Expo plugin's source-map upload integration with EAS is verified by the manual DoD pass on the next EAS build. No automated test for it.

### Manual smoke (separate from automated suite)

After deploy:
1. Trigger a known error on web (e.g., `throw new Error('sentry-smoke-test')` in a route handler hit via curl). Verify event appears in `chiaro-web` Sentry project with readable stack trace (source maps).
2. Trigger a known error in mobile dev-client build. Verify event in `chiaro-mobile` project.
3. Hit the calibrate Edge Function with a deliberately malformed address (empty string). Verify the captured `geocodio_error` lands in `chiaro-edge`.
4. Verify a calibrate event whose `request.data.address` is `'123 Main St'` ships with `address: '[scrubbed]'` in the Sentry payload (open the event detail, inspect the request body).

### Tooling

No new test infrastructure. Vitest (apps/web), jest-expo (apps/mobile), Deno's built-in test runner (Edge Functions) all already in place from prior slices.

---

## Acceptance criteria

1. ✅ Sentry org `chiaro` exists with three projects: `chiaro-web`, `chiaro-mobile`, `chiaro-edge` (manual one-time setup in Sentry admin — pre-implementation step in plan Task 1).
2. ✅ `apps/web` initializes Sentry on browser + server + edge runtimes via `instrumentation.ts` + the three `sentry.*.config.ts` files.
3. ✅ `apps/mobile` initializes Sentry from `app/_layout.tsx` via `lib/sentry.ts`, wraps root `<Stack>` in `<Sentry.ErrorBoundary>`.
4. ✅ All Edge Functions opt in to Sentry by importing `withSentry` from `_shared/sentry.ts`; `calibrate-location` is wired (template for future functions).
5. ✅ Source-map upload runs during CI web build when `SENTRY_AUTH_TOKEN` is set; gracefully no-ops when absent.
6. ✅ Mobile source-map upload runs during EAS build using EAS secret (documented but not auto-managed by code).
7. ✅ `beforeSend(event)` scrubs `address`-keyed fields recursively in `request.data`, `contexts`, `extra`, `breadcrumbs[].data`.
8. ✅ All three surfaces no-op when their DSN env var is absent — apps boot normally without Sentry.
9. ✅ Existing `console.error` sites get explicit `Sentry.captureException` calls. Audited at spec-write time: only 2 sites in `calibrate-location/index.ts` (`geocodio_error`, `rpc_error`); web + mobile currently have no `console.error` sources, so unhandled exceptions are the only path on those surfaces. Plan implementation may discover additional sites — wire them too.
10. ✅ `pnpm -r typecheck` clean across 9 packages.
11. ✅ `pnpm --filter @chiaro/web build` succeeds without `SENTRY_AUTH_TOKEN` set.
12. ✅ All new + updated unit tests green.
13. ✅ `docs/superpowers/audits/2026-05-15-audit.md` annotates telemetry-recommendation as resolved.
14. ✅ `docs/superpowers/mobile-dod-checklist.md` updated to reference the Sentry mobile project (drops "deferred" language).
15. ✅ Manual smoke (post-merge): triggered error on each surface lands in the correct Sentry project with readable stack trace + address scrubbed.
