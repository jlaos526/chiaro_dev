/**
 * Module augmentation for `react-native` AccessibilityProps.
 *
 * RNW 0.19's createDOMProps supports several a11y props that aren't
 * declared in RN's TypeScript definitions (`react-native/Libraries/
 * Components/View/ViewAccessibility.d.ts`). This file adds the gaps
 * so workspace code can use the runtime-correct RNW-supported props
 * without `as any` casts or createElement escape hatches.
 *
 * Slice 25 origin — slice 24 audit follow-up #1
 * (docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md).
 *
 * Augmented props:
 * - `accessibilityLevel?: number` — pairs with
 *   `accessibilityRole="header"` to produce
 *   `<div role="heading" aria-level="N">` on web. RNW createDOMProps
 *   supports (translation at `node_modules/react-native-web/dist/
 *   modules/createDOMProps/index.js:92-93,447-450`) but RN's
 *   `AccessibilityProps` omits.
 *
 * Future augmentations land here as additional fields. If RN
 * upstream adds these to AccessibilityProps in a future version,
 * this augmentation becomes a no-op (still type-valid).
 */
declare module 'react-native' {
  interface AccessibilityProps {
    accessibilityLevel?: number
  }

  /**
   * `dataSet?: Record<string, string | number | boolean | null | undefined>`
   *
   * RNW 0.19 serializes `dataSet={{ key: value }}` to `data-key="value"`
   * on the rendered DOM element (translation at
   * `node_modules/react-native-web/dist/modules/createDOMProps/index.js:140,
   * 757-767`). RN native ignores it. RN's TypeScript definitions
   * (`react-native/Libraries/Components/View/ViewPropTypes.d.ts`) omit it.
   * Slice 39 (SettingsSection) origin.
   */
  interface ViewProps {
    dataSet?: Record<string, string | number | boolean | null | undefined>
  }
}

export {}
