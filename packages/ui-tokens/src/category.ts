export type CategoryId =
  | 'service-record'
  | 'community-presence'
  | 'finance'
  | 'issue-positions'
  | 'ethics-accountability'
  | 'voting-bills'

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  'service-record':        'Service Record',
  'community-presence':    'Community Presence',
  'finance':               'Finance',
  'issue-positions':       'Issue Positions',
  'ethics-accountability': 'Ethics & Accountability',
  'voting-bills':          'Voting & Bills',
}

// Palette — slice 41 semantic-aligned. Locked 2026-05-29.
export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#c89a4e',  // gold (achievement medal, unchanged)
  'community-presence':    '#b86340',  // terracotta (town square clay) — was '#1f9b88'
  'finance':               '#1a8f5a',  // emerald (money) — was '#3da75b'
  'issue-positions':       '#3b6ed1',  // blue (considered stance, unchanged)
  'ethics-accountability': '#8a3a4d',  // burgundy (judicial gravitas) — was '#d68a1f'
  'voting-bills':          '#7d57c1',  // purple (legislative, unchanged)
}

// Slice 41: lightened/desaturated tints per category for nested expand
// panels. Issue Positions + Voting Bills unchanged; 4 changed categories
// re-derived from new accents (terracotta / emerald / burgundy + slice 41
// re-tone of gold).
export const SUB_CASCADE_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#e1c896',  // unchanged
  'community-presence':    '#e0b8a0',  // terracotta-derived — was '#7fc7bb'
  'finance':               '#7eb898',  // emerald-derived — was '#8fc89d'
  'issue-positions':       '#87aae0',  // unchanged
  'ethics-accountability': '#c89aa8',  // burgundy-derived — was '#ecbc7d'
  'voting-bills':          '#b39bd9',  // unchanged
}

// Slice 41: CATEGORY_ACCENT_DARK now mirrors CATEGORY_ACCENT (single-hex
// per category, both modes). Export name preserved for slice 37
// `useCategoryAccent` hook back-compat.
export const CATEGORY_ACCENT_DARK: Record<CategoryId, string> = CATEGORY_ACCENT

// Slice 41: dark-mode SUB_CASCADE_ACCENT — re-derived from new accents.
export const SUB_CASCADE_ACCENT_DARK: Record<CategoryId, string> = {
  'service-record':        '#8a6a55',  // gold-derived — was '#9a8866'
  'community-presence':    '#a08858',  // terracotta-derived — was '#4a9888'
  'finance':               '#4e8060',  // emerald-derived — was '#5e9a70'
  'issue-positions':       '#6680b8',  // unchanged
  'ethics-accountability': '#704a55',  // burgundy-derived — was '#b08850'
  'voting-bills':          '#8470a8',  // unchanged
}

// Slice 43: universal category card bg + 3px top stripe pattern.
// Replaces the slice 41 CATEGORY_CARD_GRADIENT* + CATEGORY_CARD_BG_SOLID*
// per-category maps. The stripe color comes from useCategoryAccent(id)
// (unchanged); the bg is the same for all 6 categories. Light value is
// V2b "medium pop" — visibly elevated above page bg #efece5 without
// overshooting into clinical white. Dark value sits above slice 40
// surface.elevated #262a30 for clearer card boundaries against page bg
// #16181c. See docs/superpowers/specs/2026-05-29-card-bg-stripe-cascade-design.md §4.
export const CATEGORY_CARD_BG = '#fffaf2'
export const CATEGORY_CARD_BG_DARK = '#2a2e34'
