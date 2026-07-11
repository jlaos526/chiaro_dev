# @chiaro/officials-ui

Shared cross-platform (react-native-web) component library for apps/web and
apps/mobile. Grew out of the slice-10 "officials detail components" charter
and now spans the whole UI surface. This file documents the layering and the
import rules the package manifest can't fully express (audit C27; slice 70).

## Layering (bottom → top)

| Layer | Dirs | May import from |
|---|---|---|
| tokens/hooks | `brand-hooks.ts`, `theme-context.tsx`, `image-context.tsx`, `client-context.tsx`, `types/` | `@chiaro/ui-tokens` only |
| primitives | `primitives/` (BrandButton, BrandHeading, BrandBodyText, BrandLink, BrandAlert, SmartAnchor) | tokens/hooks |
| atoms | `inputs/`, `bio/`, `cards/` (CardSubsection, MetricCardShell…), `AlignmentChip`, `OfficialAvatar` | primitives + tokens |
| domain cards | `federal/`, `state/`, `finance/`, `issues/` | atoms + domain packages (`@chiaro/officials`, `@chiaro/bills`, `@chiaro/state-bills`, `@chiaro/issues`, `@chiaro/profile`) |
| screens/nav | `screens/`, `settings/`, `auth/`, `calibrate/`, `nav/` | everything below |

Data fetching lives in the domain packages (TanStack hooks taking a
`ChiaroClient`); components get the client via `ChiaroClientProvider`
(`client-context.tsx`). Navigation is callback-props only — no router
imports outside `nav/` (slice-10 convention).

## Import rules

- **Apps import from the barrel** (`@chiaro/officials-ui`) by default. The
  package declares `"sideEffects": ["./src/types/react-native-augment.ts"]`
  and apps/web pairs it with `experimental.optimizePackageImports`, so barrel
  imports tree-shake per-route (audit C2).
- **Deep imports** (`@chiaro/officials-ui/src/<path>.tsx`, with extension) are
  the documented escape hatch for exactly two cases:
  1. **Native-only components** the web barrel must not pull in:
     `nav/BackButton.tsx`, `nav/BrandDrawer.tsx`, `nav/BrandDrawerContent.tsx`
     (expo-router / react-navigation peer deps — importing these from web
     breaks the Next build). Consumed by apps/mobile only.
  2. **Root-layout-level symbols on web** where a barrel import would put the
     whole graph in the /layout chunk group: `client-context.tsx`,
     `nav/BrandNavRailMount.tsx` (see apps/web/lib/query-client.tsx).
- Everything else in `src/` is technically reachable via the `./src/*`
  wildcard export but is NOT public API — don't grow new deep-import sites
  outside the two cases above. (Replacing the wildcard with explicit subpath
  exports is queued as the S80 remainder of audit C27.)

## Web-safe vs native-only

The barrel (`src/index.ts`) must stay importable under Next.js/webpack. The
three native-only nav components above are deliberately EXCLUDED from it —
if a new component needs expo-router, react-navigation, or any native-only
module, keep it out of the barrel and document it here.
