# Slice 47 — F1 web page rewrites + navigation rail

**Date:** 2026-05-30
**Branch:** `slice-47-f1-web-rewrites`
**Tier:** Mega Slice (~19 files modified/new/deleted)

## 1. Goals & scope

Replace the 6 raw-HTML web pages (audit F1) with declarative compositions using slice 45 brand primitives, behind a new persistent navigation rail that owns brand identity + user identity + sign-out. Closes audit F1 plus the auth-gated nav infrastructure foundation that slice 48 mobile parity will mirror.

### In scope

- 6 page rewrites: `/`, `/officials`, `/settings/address`, `/profile/edit`, `/not-found`, plus delete `apps/web/app/settings/layout.tsx`
- 2 new screen shells: `BrandPageScreen`, `BrandFormScreen`
- 1 new navigation primitive: `BrandNavRail` (responsive: persistent left rail ≥768px, hamburger overlay <768px)
- 1 new auth-gated wrapper in root layout: `BrandNavRailMount`
- 1 new breakpoint hook: `useBreakpoint`
- Logo extension: optional `wordmarkSize?: number` prop (decouples wordmark from mark size)
- `WEB_VIEWPORT_FILL` DRY hoist (currently 3 copies across AuthScreen/SettingsScreen/CalibrateScreen)
- Slice 45 cleanup items 1 + 2 (BrandButton ternary collapse + BrandAlert glyph from token)
- One-tap sign out (no confirmation modal)

### Out of scope

- Mobile React Navigation Drawer parity (slice 48)
- Mobile BrandStack nav theming (slice 48)
- Logo geometry changes (only sizing/decoupling)
- `/sign-in`, `/sign-up`, `/calibrate` page rewrites (pre-auth pages; rail intentionally excluded)
- `/legal/privacy`, `/legal/terms` (already migrated in slice 39 cleanup batch)
- Slice 45 cleanup items 3 + 4 (deferred per slice 45 final review)
- Cookie-based no-flash rail-width hint (deferred follow-up)

## 2. Architecture

```
apps/web/
  app/
    layout.tsx                          # NO CHANGE — root layout untouched
  lib/
    query-client.tsx                    # MODIFY — render BrandNavRailMount as a sibling of children inside QueryProvider
    page.tsx                            # REWRITE — Logo lockup (S=24, wordmark 28) + Welcome heading + DistrictPanel + OfficialsCardClient
    officials/page.tsx                  # REWRITE — BrandPageScreen + title "Your officials" + OfficialsListClient
    not-found.tsx                       # REWRITE — BrandPageScreen + title "Page not found" + BrandLink
    profile/edit/page.tsx               # REWRITE — BrandFormScreen + 2 BrandTextInput + BrandButton + BrandAlert
    settings/
      layout.tsx                        # DELETE
      address/page.tsx                  # REWRITE — BrandFormScreen + last-updated subtitle + BrandTextInput + BrandButton + BrandAlert

packages/officials-ui/src/
  screens/
    BrandPageScreen.tsx                 # NEW — outer + bg + WEB_VIEWPORT_FILL + centered column (maxWidth 560) + optional title
    BrandFormScreen.tsx                 # NEW — centered card (maxWidth 400) + optional title/subtitle/back-link + form children slot
    _viewport-fill.ts                   # NEW — shared WEB_VIEWPORT_FILL constant
  nav/
    BrandNavRail.tsx                    # NEW — responsive: persistent rail desktop, hamburger overlay mobile
    BrandNavRailMount.tsx               # NEW — auth-gated, route-aware wrapper
    useBreakpoint.ts                    # NEW — 768px breakpoint hook with SSR-safe initial value
    sign-out.ts                         # NEW — shared signOut(router, client) helper
  Logo.tsx                              # MODIFY — add wordmarkSize?: number prop
  primitives/
    BrandButton.tsx                     # MODIFY — collapse borderColor ternary (slice 45 item 1)
    BrandAlert.tsx                      # MODIFY — glyph color from semantic.text.onAccent (slice 45 item 2)
  auth/AuthScreen.tsx                   # MODIFY — consume shared WEB_VIEWPORT_FILL
  settings/SettingsScreen.tsx           # MODIFY — consume shared WEB_VIEWPORT_FILL
  calibrate/CalibrateScreen.tsx        # MODIFY — consume shared WEB_VIEWPORT_FILL
  settings/SettingsActionRow.tsx       # MODIFY — sign-out handler delegates to shared helper
```

### Dependency direction

`@chiaro/officials-ui` already depends on `@chiaro/ui-tokens` (slice 32) and `@chiaro/supabase-client` (slice 10 ChiaroClientProvider). `BrandNavRailMount` reads auth state via the existing `useChiaroClient()` from slice 10 and the existing `getMyProfile` query pattern. No new workspace dependencies.

**File count:** 11 modifications + 7 new + 1 delete = ~19 files.

## 3. BrandNavRail composition + behavior

### Desktop (≥768px) — persistent left rail

- Width: 200px
- Background: `semantic.bg.subtle`
- Right border: 1px `semantic.border.default`

**Composition (top to bottom):**

1. **Avatar block**
   - 36px avatar circle (mark gradient bg, white initials at 14px/700)
   - Stacked text right of avatar: name (700, 13px) + @handle (11px muted)
   - Bottom border 1px `semantic.border.default`, padding-bottom 12px
2. **Navigate section**
   - Label "NAVIGATE" (10px, 700, uppercase, letter-spacing 0.6px, color `semantic.text.muted`)
   - 3 items: Home, Officials, Settings (13px, padding 7px/8px, border-radius 6px)
   - Active item: `semantic.bg.elevated` background + 600 weight
   - Each item: leading 14px icon square (placeholder slot — icons future), label
3. **Flex spacer** (pushes Sign out to bottom)
4. **Sign out item** — danger color (`semantic.alert.danger.fg`), single item (no section label), one-tap

### Mobile (<768px) — hamburger overlay

- **Top bar:** fixed top, height 52px, `semantic.bg.elevated` background, 1px bottom border `semantic.border.default`
  - Hamburger button left (22×22, 3 horizontal bars, padding 14px)
  - Avatar circle right (28×28 with initials)
  - No center title (page body has its own h1)
- **Tap hamburger** → rail slides in from left over a scrim
  - Scrim: `rgba(0,0,0,0.25)`, full viewport, fade-in
  - Rail overlay: width 240px, slide-in transform, `semantic.bg.elevated` (not subtle — overlay needs higher contrast)
  - Tap scrim or any nav item or rail item → dismiss
- **Open rail composition** identical to desktop rail

### Auth gating (`BrandNavRailMount`)

- Renders `null` if no Supabase session user
- Renders `null` on excluded routes: `/sign-in`, `/sign-up`, `/calibrate` (matched against `usePathname()` using prefix match)
- Else renders `<BrandNavRail user={...} pathname={pathname} onSignOut={handler} />`

### Identity data

`BrandNavRailMount` reads `getMyProfile()` (cached by ChiaroClientProvider's React Query). Avatar initials derived from `display_name`:
- If `display_name` set: first letter, uppercase
- Else if `username` set: first letter, uppercase
- Else: `'?'`

Handle is `@${username}` when set, else empty (avatar block shows just the initial without the handle row).
Name fallback: `display_name` → `username` → `'Welcome'` (no preceding "Welcome,").

### Sign out helper

`nav/sign-out.ts` exports `signOut(router, client)` that:
1. Clears `chiaro_skip_calibrate` cookie (`document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'`)
2. Awaits `client.auth.signOut()`
3. `router.push('/sign-in')`
4. `router.refresh()`

Consumed by both the rail's Sign out item AND the existing `/settings` → Sign out row (slice 39). Eliminates duplication.

### Body layout shift

When rail is mounted on desktop, body content gets `marginLeft: 200px`. Mechanism:
- Root layout sets `--chiaro-rail-width: 0px` initially (server snapshot + first paint)
- `BrandNavRailMount` flips it to `200px` once mounted client-side with desktop breakpoint
- `BrandPageScreen` + `BrandFormScreen` consume it via `paddingLeft: 'calc(16px + var(--chiaro-rail-width, 0px))'` on web; native ignores
- Mobile rail overlay does NOT shift content; the top bar adds 52px to body `paddingTop` via the same CSS-var pattern (`--chiaro-rail-topbar: 52px`)

### SSR / hydration

`useBreakpoint(768)` uses `useSyncExternalStore` with:
- Server snapshot: `false` (treat SSR as mobile, hamburger collapsed — safer for narrow viewports)
- Client subscribe: `window.matchMedia('(min-width: 768px)')` change listener
- Client snapshot: `mql.matches`

Brief content shift on first paint (rail mounts after `useBreakpoint` resolves to `true`) is acceptable for v1. Cookie-based viewport hint is a documented follow-up (mirrors slice 38 dark mode no-flash).

## 4. Screen shells

### `BrandPageScreen`

```tsx
interface BrandPageScreenProps {
  title?: string         // optional h1 via BrandHeading level={1}
  children: ReactNode
}
```

- Outer `<View>`: `flex: 1`, `bg.app`, `WEB_VIEWPORT_FILL`, `alignItems: 'center'`, `paddingVertical: 24`, web `paddingHorizontal: 'calc(16px + var(--chiaro-rail-width, 0px) / 2)'` to balance rail width; native uses `paddingHorizontal: 16`
- Inner column: `width: '100%'`, `maxWidth: 560`, `gap: 24`
- If `title` provided, renders `<BrandHeading level={1}>{title}</BrandHeading>` at top of column

**Consumers:** `/`, `/officials`, `/not-found`

### `BrandFormScreen`

```tsx
interface BrandFormScreenProps {
  title: string                          // required h1
  subtitle?: string                      // optional muted body text below title
  backHref?: string                      // optional BrandLink href
  backLabel?: string                     // accompanies backHref (e.g. "← Settings")
  children: ReactNode                    // form content
}
```

- Outer same as `BrandPageScreen` (bg + viewport-fill + rail-aware padding) plus `justifyContent: 'center'` for vertical centering
- Inner card: `width: '100%'`, `maxWidth: 400`, `bg.elevated`, `borderRadius: 16`, `paddingHorizontal: 24`, `paddingVertical: 30`
  - Shadow: `shadowColor: '#000'`, `shadowOpacity: 0.06`, `shadowRadius: 20`, `shadowOffset: { width: 0, height: 6 }`, `elevation: 4` (same as AuthScreen card)
- Card composition (top to bottom):
  - Optional back link: `<BrandLink href={backHref}>{backLabel}</BrandLink>` with `marginBottom: 12`
  - `<BrandHeading level={1}>{title}</BrandHeading>`
  - Optional `<BrandBodyText muted size="sm">{subtitle}</BrandBodyText>` with `marginTop: 4`
  - Children (form), `marginTop: 18`

**No wordmark/logo** — those belong to `AuthScreen` (pre-auth surface).

**Consumers:** `/profile/edit`, `/settings/address`

### `_viewport-fill.ts`

```tsx
import { Platform } from 'react-native'

export const WEB_VIEWPORT_FILL = Platform.OS === 'web'
  ? ({ minHeight: '100vh' as unknown as number })
  : null
```

Imported by `AuthScreen`, `SettingsScreen`, `CalibrateScreen`, `BrandPageScreen`, `BrandFormScreen`. Eliminates 3× duplicate declarations.

## 5. Page rewrites — concrete shapes

### `/` (home)

```tsx
// apps/web/app/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyProfile } from '@chiaro/profile'
import { redirect } from 'next/navigation'
import { BrandPageScreen, BrandHeading, BrandAlert, BrandLink, Logo } from '@chiaro/officials-ui'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCardClient } from './OfficialsCardClient'

export default async function Home(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const profile = await getMyProfile(supabase)

  const greetingName = profile?.display_name ?? profile?.username ?? null
  const greeting = greetingName ? `Welcome, ${greetingName}` : 'Welcome'

  return (
    <BrandPageScreen>
      <Logo variant="lockup" size={24} wordmarkSize={28} />
      <BrandHeading level={1}>{greeting}</BrandHeading>
      {!profile?.completed && (
        <BrandAlert severity="info" title="Complete your profile">
          <BrandLink href="/profile/edit">Add your display name and username →</BrandLink>
        </BrandAlert>
      )}
      <DistrictPanel />
      <OfficialsCardClient />
    </BrandPageScreen>
  )
}
```

Sign-out form REMOVED from home (moved to rail). Title omitted on the shell because Logo + BrandHeading provide the page anchor (Logo provides brand identity, BrandHeading provides h1 landmark).

### `/officials`

```tsx
// apps/web/app/officials/page.tsx
export default async function OfficialsPage(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return (
    <BrandPageScreen title="Your officials">
      <OfficialsListClient />
    </BrandPageScreen>
  )
}
```

### `/not-found`

```tsx
// apps/web/app/not-found.tsx
export default function NotFound(): React.JSX.Element {
  return (
    <BrandPageScreen title="Page not found">
      <BrandBodyText>We couldn't find what you were looking for.</BrandBodyText>
      <BrandLink href="/">← Go home</BrandLink>
    </BrandPageScreen>
  )
}
```

No auth check (Next.js 404 boundary renders this for both authed + unauth users; rail mount handles gating).

### `/profile/edit`

```tsx
// apps/web/app/profile/edit/page.tsx
'use client'
// ... existing imports + state ...

return (
  <BrandFormScreen title="Complete your profile" backHref="/" backLabel="← Home">
    <BrandTextInput
      label="Display name"
      value={displayName}
      onChangeText={setDisplayName}
      required
    />
    <BrandTextInput
      label="Username"
      value={username}
      onChangeText={setUsername}
      required
    />
    {error && <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert>}
    <BrandButton variant="primary" disabled={loading} onPress={handleSubmit}>
      {loading ? 'Saving…' : 'Save'}
    </BrandButton>
  </BrandFormScreen>
)
```

Submit handler preserved (calls `updateMyProfile` then `router.push('/')` + refresh). Errors flow into BrandAlert.

### `/settings/address`

```tsx
// apps/web/app/settings/address/page.tsx
'use client'
// ... existing imports + state ...

if (bootstrapping) {
  return (
    <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
      <BrandBodyText muted>Loading…</BrandBodyText>
    </BrandFormScreen>
  )
}

const subtitle = calibratedAt
  ? `Last updated ${new Date(calibratedAt).toLocaleString()}`
  : undefined

return (
  <BrandFormScreen
    title="Home address"
    backHref="/settings"
    backLabel="← Settings"
    subtitle={subtitle}
  >
    <BrandTextInput
      label="Address"
      value={address}
      onChangeText={setAddress}
      required
    />
    {error && <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert>}
    <BrandButton variant="primary" disabled={loading} onPress={handleSubmit}>
      {loading ? 'Saving…' : 'Save'}
    </BrandButton>
  </BrandFormScreen>
)
```

Submit handler preserved (calls `calibrate-location` Edge Function then `router.push('/settings')` + refresh).

### `apps/web/app/settings/layout.tsx`

**Deleted.** Next.js falls through to root layout. /settings keeps SettingsScreen chrome. /settings/address gets BrandFormScreen chrome with its own back-nav. Fixes the double-heading bug.

### `apps/web/lib/query-client.tsx`

Modified to mount `BrandNavRailMount` as a sibling of children inside the existing `ChiaroClientProvider → QueryClientProvider` chain:

```tsx
// MODIFY — apps/web/lib/query-client.tsx
import { BrandNavRailMount } from '@chiaro/officials-ui'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [qc] = React.useState(getQueryClient)
  return (
    <ChiaroClientProvider client={chiaroClient}>
      <QueryClientProvider client={qc}>
        <BrandNavRailMount />            {/* NEW — sibling of children */}
        {children}
      </QueryClientProvider>
    </ChiaroClientProvider>
  )
}
```

`apps/web/app/layout.tsx` itself is **unchanged**. The mount sits inside `QueryProvider` (slice 10 ChiaroClientProvider chain) so it has access to both `useChiaroClient()` (Supabase) and React Query. It also lives inside `ClientBrandModeWiring` (transitively, since QueryProvider is rendered as ClientBrandModeWiring's child), so the rail picks up dark mode via `useBrandTokens()`.

`BrandNavRailMount` is a client component (uses `usePathname`, `useChiaroClient`, `useBreakpoint`).

## 6. Logo extension + cleanup items

### `Logo.tsx` — `wordmarkSize?: number` prop addition

**Behavior unchanged when omitted.** Current: `wordmarkSize = size * 0.65`.

When provided:
- Wordmark renders at exact `wordmarkSize` px
- Gap: `gap = Math.max(size, wordmarkSize) * 0.4`
- Tracking computed off `wordmarkSize` (preserves Inter optical-size feel): `tracking = (wordmarkSize >= 48 ? 0.06 : wordmarkSize >= 24 ? 0.07 : 0.08) * wordmarkSize`
- Tagline size + gap derive from `wordmarkSize` (not `size`) so tagline stays subordinate to the wordmark, not the mark

Type:

```tsx
export interface LogoProps {
  size?: number
  variant?: 'mark' | 'lockup'
  tagline?: string
  accessibilityLabel?: string
  wordmarkSize?: number     // NEW — defaults to size × 0.65
}
```

Home page consumer: `<Logo variant="lockup" size={24} wordmarkSize={28} />` (W3 locked).

### Slice 45 cleanup item 1 — BrandButton borderColor ternary

```diff
- borderColor: variant === 'primary' ? semantic.accent.primary : semantic.accent.primary,
+ borderColor: semantic.accent.primary,
```

No behavior change. Existing test asserting `borderColor === semantic.accent.primary` for both variants stays valid.

### Slice 45 cleanup item 2 — BrandAlert glyph color from token

```diff
- <Text style={{ color: '#fff', fontWeight: '700' }}>{glyph}</Text>
+ <Text style={{ color: semantic.text.onAccent, fontWeight: '700' }}>{glyph}</Text>
```

Light mode: `#fff` unchanged. Dark mode: `#fff0dc` cream (slice 33 portrait initials family) — tiny warm tint against the colored severity circle. Visible only side-by-side, intentional consistency with the slice 33+ on-accent convention.

## 7. Testing

### New unit tests (`packages/officials-ui/test/`)

- `screens/BrandPageScreen.test.tsx` — ~6 cases:
  - Renders title as h1 via BrandHeading when provided
  - Omits title heading when undefined
  - Applies `semantic.bg.app` background
  - Applies WEB_VIEWPORT_FILL on web only
  - Renders children inside maxWidth 560 column
  - Consumes `--chiaro-rail-width` CSS var on web (asserts `paddingLeft: calc(...)`)

- `screens/BrandFormScreen.test.tsx` — ~7 cases:
  - Renders required title as h1
  - Renders optional subtitle as muted body text
  - Renders optional back link with href + label
  - Omits back link when href absent
  - Card has bg.elevated + maxWidth 400 + shadow
  - Renders form children
  - Negative: does not render wordmark/logo

- `nav/BrandNavRail.test.tsx` — ~12 cases:
  - Desktop variant: renders avatar block + Navigate section + Sign out
  - Active route gets bg.elevated + 600 weight
  - Sign out invokes handler on press
  - Avatar initials derived from display_name → username → '?'
  - Mobile variant: renders top bar (hamburger + avatar)
  - Mobile: hamburger press opens overlay
  - Mobile: scrim click closes overlay
  - Mobile: nav item click closes overlay
  - aria-expanded on hamburger reflects open state

- `nav/BrandNavRailMount.test.tsx` — ~7 cases:
  - Renders null when no session user
  - Renders null on `/sign-in`
  - Renders null on `/sign-up`
  - Renders null on `/calibrate`
  - Renders rail on `/`
  - Renders rail on `/officials`
  - Renders rail on `/settings`, `/settings/address`, `/profile/edit`

- `nav/useBreakpoint.test.ts` — ~4 cases:
  - SSR snapshot returns false
  - Post-mount returns true ≥768
  - Post-mount returns false <768
  - Updates on viewport resize

- `nav/sign-out.test.ts` — ~3 cases:
  - Clears chiaro_skip_calibrate cookie
  - Calls supabase.auth.signOut
  - Routes to /sign-in + refresh

- `Logo.test.tsx` — ~6 new cases (existing 18 stay):
  - `wordmarkSize` prop sets wordmark fontSize directly
  - Gap = max(size, wordmarkSize) × 0.4 when wordmarkSize > size
  - Gap = max(size, wordmarkSize) × 0.4 when wordmarkSize < size
  - Tracking computed off wordmarkSize (not size) when wordmarkSize provided
  - Omitted prop preserves S × 0.65 default
  - Tagline size derives from wordmarkSize when provided

- `primitives/BrandButton.test.tsx` — clarify (no new): assertion that `borderColor === accent.primary` for both variants

- `primitives/BrandAlert.test.tsx` — ~2 new:
  - Glyph color === `semantic.text.onAccent` in light mode
  - Glyph color === `semantic.text.onAccent` in dark mode

### Modified shell tests

- `auth/AuthScreen.test.tsx`, `settings/SettingsScreen.test.tsx`, `calibrate/CalibrateScreen.test.tsx`: WEB_VIEWPORT_FILL assertions stay (still web-only, same value), just sourced from shared import. Verify import path updated.

### Web page tests (`apps/web/test/`)

- `app/page.test.tsx` (NEW) — ~4 cases:
  - Auth redirect when no user
  - Renders Logo + welcome heading with profile name
  - Renders BrandAlert when profile incomplete
  - Negative: no sign-out form in body

- `app/officials/page.test.tsx` (NEW) — ~2 cases:
  - Auth redirect
  - Renders BrandPageScreen with title "Your officials"

- `app/not-found.test.tsx` (NEW) — ~2 cases:
  - Renders title "Page not found"
  - Renders "← Go home" link with href="/"

- `app/profile/edit/page.test.tsx` (NEW) — ~3 cases:
  - Form submission happy path
  - BrandAlert renders on submission error
  - BrandButton disabled during loading

- `app/settings/address/page.test.tsx` (NEW) — ~4 cases:
  - Bootstrap from existing location populates inputs
  - Last-updated subtitle renders when calibratedAt present
  - Form submission flow happy path
  - Form submission flow error path

- `lib/query-client.test.tsx` (NEW) — ~2 cases:
  - Wires BrandNavRailMount as sibling of children inside QueryProvider
  - Renders children after the mount

**Total delta:** ~62 new test cases. officials-ui 496 → ~538. apps/web jumps from minimal to ~17 page-test cases.

**No schema work.** pgTAP unchanged at 402.

### Manual smoke checklist (extended `docs/superpowers/mobile-dod-checklist.md` web section)

1. Sign-in → land on `/` → see rail with avatar + Navigate + Sign out
2. Resize browser <768px → rail collapses to hamburger top bar
3. Tap hamburger → overlay rail slides in, scrim dims content
4. Navigate Home → Officials → Settings, active item highlight tracks
5. Sign out from rail → land on `/sign-in`
6. Hit `/sign-in` directly → no rail visible
7. Hit a 404 URL → BrandPageScreen "Page not found" with rail (if authed) or without (if unauth)
8. Edit profile flow (happy + error) + edit address flow (happy + error)
9. Dark mode toggle from /settings → rail repaints correctly
10. /settings/address back-nav lands on /settings (not /home)

## 8. Risks & open questions

### R1 — Layout shift on rail mount (acknowledged)

SSR + first paint render with `--chiaro-rail-width: 0px`; once `useBreakpoint` resolves client-side, the var flips to 200px and content shifts right. Single-frame shift, no broken layout. Mitigations considered but deferred:
- Cookie-based viewport-hint (similar to slice 38 dark mode no-flash) — adds complexity, defers for now since first-visit users hit `/sign-in` (no rail) before authed routes
- Reserving the 200px space at root layout regardless of viewport — wastes space on mobile

### R2 — `BrandNavRailMount` and `/calibrate` interaction

Today `/calibrate` is reachable post-signup but pre-location-set. The mount excludes `/calibrate` from rail rendering. If a user opens `/calibrate` after they've already calibrated (refreshing the URL by hand), they'd see no rail. Acceptable — calibrate is an edge interaction; settings has its own Edit address row.

### R3 — `useBreakpoint` 768 threshold

Arbitrary but matches Tailwind's `md` default. Future tablet-portrait designs may want a different breakpoint; centralized in one hook so easy to tune.

### R4 — Rail mounted in body, not html

The rail lives inside the React root (body), not as a sibling of `<main>`. On routes where rail is excluded, the body has no rail at all — no empty 200px ghost slot. BrandPageScreen + BrandFormScreen compute their left padding from a CSS var that the rail mount sets; when the mount renders null, the var defaults to 0 and pages fill the viewport.

### R5 — Mobile parity deferred

Slice 48 has to mirror the rail concept in React Navigation Drawer for the Expo app. The web rail is built API-first (`user`, `pathname`, `onSignOut`) so the mobile equivalent can swap the visual without rebuilding the data layer.

### R6 — `BrandAlert severity="info"` for profile-completion prompt

Terracotta. If usage of the info severity feels overloaded later, can rebase to a dedicated "prompt" surface in a future slice. Low risk.

### R7 — Sign-out is one-tap, no confirmation

Locked. Matches slice 39 SettingsActionRow behavior. If user reports accidental sign-outs in production, a confirm modal can be added in a follow-up.

## 9. Visual decisions locked

| Decision | Lock | Notes |
|---|---|---|
| Shell strategy | Two new shells (BrandPageScreen + BrandFormScreen) | Q1 |
| Settings layout disposition | Delete `apps/web/app/settings/layout.tsx` | Q2 |
| Home heading treatment | Logo lockup + Welcome heading (Q3a Option A) | First consumer of decoupled Logo |
| Logo size on home | mark S=24, wordmark 28px, default tracking | W3 — decoupled via new prop |
| Sign-out placement | Inside two-level side menu (M3 refined) | Pinned bottom of rail |
| Rail brand chrome | NO logo/wordmark inside rail | Body owns brand identity |
| Nav pattern | Responsive: persistent rail ≥768px, hamburger overlay <768px | Original responsive (R) |
| Cleanup items bundled | Slice 45 items 1 + 2 only | Items 3 + 4 deferred per slice 45 review |
| Sign-out confirmation | None (one-tap) | Parity with slice 39 |
