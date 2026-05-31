# Mobile On-Device DoD Checklist

> Slice 2.5 / 3.5 follow-up. Run once per significant mobile-touching slice.
> Last updated: 2026-05-18 (covers slices 1–3 + 4 + 4.5 + 5A redesigns + 5B telemetry coverage).

## Build the APK

Prerequisites:
- [Expo account](https://expo.dev/) (free tier sufficient)
- `eas-cli` installed locally (`npm i -g eas-cli`)
- Logged in: `eas login`
- Linked to the project: `cd apps/mobile && eas init` (or verify `extra.eas.projectId` matches `f4d18da9-9c95-4c6a-8a34-c77189eca749`)

Build command:
```bash
cd apps/mobile
eas build --profile development --platform android
```

This produces an APK with the development client (Metro can connect). Build
queues on Expo's free tier may take 15–45 minutes. The CLI prints a build URL;
the APK download link appears there when ready.

iOS device builds need Apple Developer credentials and an interactive
provisioning step; defer until a paid Apple account is available.

## Install on device

1. Enable "Install from unknown sources" on the Android device (Settings →
   Security → Install unknown apps → allow your file manager / browser).
2. Download the APK from the EAS build URL on the device's browser.
3. Open the APK → Install.
4. Start Metro from dev machine: `pnpm --filter @chiaro/mobile dev` (or
   `cd apps/mobile && npx expo start --dev-client`).
5. Open the installed Chiaro app on the device → tap "Enter URL manually"
   if needed and paste the Metro URL printed in the terminal.

## Smoke checklist

Run through each scenario on a real Android device. Tick once verified.

### Auth (slice 1)

- [ ] Sign up with a fresh email → land on `/profile/edit`
- [ ] Fill display name + username → save → redirect to `/calibrate`
- [ ] Sign out → return to `/sign-in`
- [ ] Sign in with same credentials → home loads

### Calibration (slice 2)

- [ ] Tap "Use my location" → GPS permission prompt appears with the
      string from `app.config.ts:14-15` ("Chiaro uses your location to
      find the elected officials representing your address.")
- [ ] Grant → reverse geocode resolves → calibrate completes → home loads
- [ ] **GPS-denied path:** sign up a fresh user, deny GPS permission,
      verify fallback UX in `lib/location-permissions.ts:11` (typed-address
      form should appear instead of crashing)
- [ ] Type a known full address in the manual form → resolves → districts
      appear

### Districts (slice 2)

- [ ] Home shows district list grouped (Federal / State / Local)
- [ ] Map panel renders with district polygons + home pin
- [ ] Tier toggles work (federal_house / federal_senate / state_* /
      county / place)
- [ ] No console errors; no "Map container is already initialized" RN
      warnings

### Officials (slice 3)

> Prereq: run `pnpm seed:officials` against the dev Supabase instance
> the app is pointed at, so the officials table is populated.

- [ ] Home shows "Your officials" card with ~3 federal officials
      (1 house + 2 senate) below the District panel
- [ ] Each row shows portrait/initials, name, party badge (D/R/I/L/G/ID),
      and chamber · state metadata
- [ ] Tap "See all officials →" → `/officials` list grouped by chamber
- [ ] Tap any official → `/officials/[id]` detail page:
   - Photo + name + party + chamber/state/district/term info
   - "Open official site →" deep-links to gov.gov in browser
   - Twitter link (if present) deep-links to X/Twitter
- [ ] Back navigation works
- [ ] Portrait fallback: official with no `portrait_url` shows initials
      in the `OfficialAvatar` (synthesized test data or admin-cleared
      portrait_url)

### Settings (slice 2)

- [ ] Open Settings from home
- [ ] Edit Address sub-page → change address → save → districts refresh
      on home (TanStack staleTime is 5 min; pull-to-refresh or restart
      app to force refetch)
- [ ] Sign out from Settings

### Edge cases

- [ ] Kill app and reopen → still signed in (token persists via AsyncStorage)
- [ ] Background then foreground → no auth refresh loops
- [ ] Disable network → graceful error messages; no white-screen crashes

### Officials detail redesign (slice 4 + 4.5)

> Prereq: `pnpm seed:officials` so the officials table is populated. Re-run
> `apps/web/scripts/audit-fixture-attach.ts` against Mike Carey (or current
> audit target) so a fixture official has full slice-4 data.

- [ ] Open detail page for the audit-fixture official (e.g. Mike Carey)
- [ ] Bio header layout: Portrait → Name → BioIdentityRow (party | chamber |
      📍 DistrictBadge) → top-3 AlignmentChip row → BioServiceCard →
      contact links
- [ ] DistrictBadge text reads "Ohio's 15th District" (or matching variant
      for the official); map-pin SVG visible
- [ ] Top-3 alignment chips render when scorecards exist; color-only
      (no ✓✓ / ✗✗ glyph)
- [ ] All 6 category bars collapse/expand on tap with pill-chevron flip
- [ ] Sub-cascades inside Issue Positions + Finance + Voting & Bills expand
      independently
- [ ] Inline evidence expand on every metric card (no modal)
- [ ] Senate variant — open Bernie Moreno or Jon Husted:
   - BioIdentityRow district chip shows "Ohio" (full state name, no district number)
   - Lives in District card: muted bg + italic grey "No Data" value +
     grey dot + "Unavailable" label + "no data available for this seat"
- [ ] At-large variant — open Harriet Hageman (WY):
   - BioIdentityRow district chip shows "Wyoming's At-Large District"
- [ ] Compliance icons in STOCK Act evidence rows: ✓ (green) on-time vs
      ✖ (U+2716 amber) late
- [ ] Placeholder sub-cascades (Committee Work) render soft beige italic;
      non-tappable

### Finance placeholders (slice 5A)

- [ ] Individual Donors sub-cascade expands into bars (no longer
      soft-beige placeholder)
- [ ] Top Organizations sub-cascade expands into bars
- [ ] Top Industries still renders correctly (regression check)
- [ ] Tap "Show 5 more donors" / "Show 5 more organizations" reveals
      rows 6-10
- [ ] OpenSecrets external link at bottom of each bar block opens in
      browser via Linking

### Deep-link verification

- [ ] From home OfficialsCard, tap an alignment chip
- [ ] Detail page opens with Issue Positions category auto-expanded AND
      the matching sub-cascade auto-expanded (e.g. "Environment")
- [ ] Other chips work the same for civil-rights, business, etc.

### Three variants summary

| Variant            | Verify                                              |
|--------------------|-----------------------------------------------------|
| House w/ fixture   | Full data: salary, tenure, scorecards, finance bars, stock txns, town halls, votes/bills |
| Senate (no fixture)| Empty-states clean; "N/A (Senate)" Lives-in-District; DistrictBadge full state name |
| At-Large (WY)      | DistrictBadge reads "Wyoming's At-Large District"; no "WY-01" leak |

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

## Slice 38 — Dark mode toggle

- [ ] Settings page shows Theme row between Home address and Sign out.
- [ ] Three options visible: System, Light, Dark; correct option is highlighted on mount.
- [ ] Tapping each option repaints the UI instantly.
- [ ] After choosing Dark, kill + relaunch app → splash visible, then UI renders in dark mode with no flash.
- [ ] After choosing System, change OS theme → app follows live.
- [ ] After choosing Light then System, OS theme dictates rendering.

## Slice 39 — Settings architecture + Calibrate refactor

- [ ] Settings page shows 5 sections in order: Account, Appearance, Notifications, Profile, About.
- [ ] Sign-out row in Account section uses destructive (red) text.
- [ ] Tapping Home address navigates to /settings/address.
- [ ] Tapping Sign out signs out and routes to /sign-in.
- [ ] Theme row in Appearance section toggles brand mode; entire page repaints.
- [ ] Notifications toggles are disabled and don't respond to taps.
- [ ] Profile rows show "Coming soon" badge.
- [ ] About section shows version string.
- [ ] Privacy policy / Terms of service nav rows navigate (may 404 — acceptable for v1).
- [ ] /calibrate shows centered card; "Use my current location" button (brand-outlined) appears above address input; Calibrate + GPS + Skip flows work.
- [ ] Tap "Use my current location" → GPS permission prompt → coords submitted via `{lat, lng}` body to `calibrate-location` Edge Function.
- [ ] GPS-denied path shows the helper's friendly message in CalibrateScreen's error slot.
- [ ] All Settings + Calibrate surfaces fully repaint in dark mode.

## Slice 40 — Dark mode reskin

- [ ] Light mode unchanged: BioPortrait orange gradient, link blue, brand-orange CTA buttons.
- [ ] Dark mode toggle → page bg becomes cool slate (not warm brown).
- [ ] Dark mode card bg + elevated surfaces are cool slate equivalents (no warm-brown card islands floating on cool bg).
- [ ] BioPortrait dark fallback gradient is sage (#6b7a5d → #9caa8e), not blue.
- [ ] BioPortrait initials in dark are warm cream (#fff0dc), not white or dark ink.
- [ ] CTA buttons (Calibrate, Sign in, etc.) in dark use slate-blue (#374f68), not warm tan orange.
- [ ] Hover/pressed states stay in the slate-blue family (no orange flash).
- [ ] Alert tints (danger red, warning amber, success green) unchanged in dark.
- [ ] Link blue (#7a98e1) unchanged in dark.

## Slice 41 — Category palette reskin

- [ ] Federal officials detail page (mobile) shows 6 cards in new order: Service Record → Community Presence → Finance → Issue Positions → Ethics → Voting & Bills.
- [ ] Service Record card dot is gold `#c89a4e`.
- [ ] Community Presence card dot is terracotta `#b86340` (NEW; was teal).
- [ ] Finance card dot is emerald `#1a8f5a` (NEW; was medium green).
- [ ] Issue Positions card dot is blue `#3b6ed1` (unchanged).
- [ ] Ethics & Accountability card dot is burgundy `#8a3a4d` (NEW; was amber).
- [ ] Voting & Bills card dot is purple `#7d57c1` (unchanged).
- [ ] In dark mode, each card bg shows a subtle hue tint over cool slate (no warm-brown islands).
- [ ] In light mode, each card bg shows medium-saturation category tint (visibly different from app bg cream).
- [ ] Map district fill in dark mode is cool slate `#3a3e45`, not warm brown.
- [ ] Sub-cascade nested expand panels show desaturated category tints (light + dark).

## Slice 42 — AlignmentChip palette reskin

- [ ] AlignmentChip in BioHeader (federal + state officials) shows the new 5-tier thermal palette in light mode: pale emerald aligned → gold Mixed → peach/terracotta differs.
- [ ] AlignmentChip Strongly Aligned chip is visibly deeper saturation than Mostly Aligned (V2 emphasis).
- [ ] AlignmentChip Strongly Differs chip is visibly deeper saturation than Mostly Differs (V2 emphasis).
- [ ] AlignmentChip Mixed chip is gold/cream `#eedbb5` — visibly distinct from the page bg cream `#efece5`.
- [ ] In dark mode, AlignmentChip Mixed bg is gold-tinted cool slate `#23211a` (matches Service Record card bg).
- [ ] ComplianceIcon on-time variant (✓ green) bg matches Strongly Aligned chip bg in both light and dark mode.
- [ ] ComplianceIcon late variant (✖ peach) bg matches Mostly Differs chip bg in both light and dark mode.

## Slice 43 — Category card bg stripe cascade

- [ ] All 6 category cards on `/officials/[id]` (mobile) show a neutral cream-tinted bg + 3px top stripe in their category accent: Service Record gold, Community Presence terracotta, Finance emerald, Issue Positions blue, Ethics burgundy, Voting Bills purple.
- [ ] In dark mode, all 6 cards show the cool slate `#2a2e34` bg + same stripe accents — cards sit visibly above the cool-slate page bg.
- [ ] FinanceSummaryStrip renders the universal card bg + emerald top stripe; small-donor / PAC% / total-raised dots still visible.
- [ ] TopAmountBreakdown progress bars still render `signal.success` green fills (not changed by slice 43).
- [ ] Placeholder + unavailable MetricCardShell variants render WITHOUT a top stripe (1px border + subtle bg) — read as "no data" rather than as active category cards.
- [ ] `/state-officials/[id]` cards mirror the federal pattern (same 6 stripes + universal bg).

## Slice 45 — Brand primitives

- [ ] `BrandButton` primary variant renders with `accent.primary` bg on mobile (orange in light, slate-blue in dark).
- [ ] `BrandButton` secondary variant renders outlined.
- [ ] `BrandHeading` renders text with proper visual hierarchy (h1 > h2 > h3).
- [ ] `BrandBodyText` default (15px) vs sm (13px) sizes visible distinct.
- [ ] `BrandLink` is tappable on mobile, opens external URL (or fires onPress) via `Linking`.
- [ ] `BrandAlert` renders all 4 severities (burgundy/gold/emerald/terracotta) with correct pill + icon colors.
- [ ] AuthForm error banner shows brand-family burgundy bg (was peach-pink in slice 32 era).
- [ ] Dark mode toggle repaints all 5 primitives without app restart.

## Slice 46 — Inline-hex sweep

- [ ] PillChevron pill bg repaints between modes (warm cream in light, cool slate in dark).
- [ ] EvidenceExpand dashed-border separator visible in both light + dark modes.
- [ ] DistrictBadge map-pin reads as saturated red in light, brighter coral in dark.
- [ ] DistrictBadge text label uses body-text color (charcoal in light, cream in dark).
- [ ] Logo mark on mobile splash/header shows brand orange (not slate-blue) — Logo is mode-invariant by design.

## Slice 47 — F1 web rewrites + nav rail (web)

- [ ] Sign in → land on `/` → see persistent left rail with avatar + Navigate + Sign out
- [ ] Resize browser <768px → rail collapses to hamburger top bar
- [ ] Tap hamburger → overlay rail slides in, scrim dims content
- [ ] Tap scrim → overlay closes
- [ ] Navigate Home → Officials → Settings, active item highlight tracks
- [ ] Sign out from rail → land on `/sign-in`, no rail visible
- [ ] Hit `/sign-in` directly while authed → no rail visible (excluded route)
- [ ] Hit a 404 URL → "Page not found" via BrandPageScreen, rail present if authed
- [ ] Edit profile flow happy path → routes back to `/`
- [ ] Edit profile flow error path → BrandAlert displays + form re-enabled
- [ ] Edit address flow happy path → routes back to `/settings`
- [ ] Edit address flow error path → BrandAlert displays
- [ ] /settings/address back link lands on /settings (not `/`)
- [ ] Dark mode toggle from /settings → rail repaints correctly
- [ ] Home page Welcome heading uses display_name when present; falls back to username; "Welcome" alone when both null
- [ ] Profile-completion BrandAlert appears on home only when profile.completed === false

## Slice 48 — F2 + F3 mobile parity (iOS + Android)

- [ ] Sign in → land on `/` → see drawer header (hamburger left, "Home" centered)
- [ ] Tap hamburger → drawer slides in from left with avatar + Navigate + Sign out
- [ ] Swipe from left edge → drawer opens with native iOS / Material gesture
- [ ] Tap scrim → drawer closes
- [ ] Navigate Home → Officials → Settings via drawer, active item highlight tracks
- [ ] Drawer header title updates per screen
- [ ] Sign out from drawer → land on `/sign-in`
- [ ] Home page Logo lockup + "Welcome, {name}" body renders below drawer header
- [ ] Profile-completion BrandAlert appears on home only when incomplete
- [ ] Tap "Complete your profile" link → routes to /profile/edit (hidden from drawer menu, has back arrow)
- [ ] /profile/edit back-arrow returns to /
- [ ] Edit address from /settings → /settings/address (hidden from drawer menu, has back arrow)
- [ ] /settings/address back-arrow returns to /settings
- [ ] Hardware back button (Android) closes open drawer first, then navigates back
- [ ] Dark mode toggle from /settings → drawer header + drawer content + content area repaint correctly
- [ ] Safe area insets respected on iPhone notch + Android system bars
- [ ] Keyboard does not push drawer off-screen
- [ ] /officials/[id] + /state-officials/[id] hidden from drawer menu + back-arrow returns to officials list
- [ ] /calibrate hidden from drawer menu (pre-calibration redirect still works)

## After the run

If any item fails:
1. Note the device (model, Android version) + reproducible steps
2. Capture a screenshot or short screen recording
3. Open a slice 3.5 / 3.6 follow-up task

If everything passes, this DoD is satisfied. Note the date and the Chiaro
version (from `app.config.ts:7`) in the team channel / planning doc.
