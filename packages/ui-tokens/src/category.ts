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

export const SUB_CASCADE_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#e1c896',
  'issue-positions':       '#87aae0',
  'community-presence':    '#7fc7bb',
  'finance':               '#8fc89d',
  'ethics-accountability': '#ecbc7d',
  'voting-bills':          '#b39bd9',
}

// Slice 41: Level B medium saturation start stops; #fff endpoint preserved.
export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #f5e6cc 0%, #fff 100%)',
  'community-presence':    'linear-gradient(180deg, #f5dece 0%, #fff 100%)',
  'finance':               'linear-gradient(180deg, #d4e8d8 0%, #fff 100%)',
  'issue-positions':       'linear-gradient(180deg, #d8e0f5 0%, #fff 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #ecc8cf 0%, #fff 100%)',
  'voting-bills':          'linear-gradient(180deg, #e0d5f0 0%, #fff 100%)',
}

// Slice 41: Level B medium saturation. Cards identify as their category
// color rather than near-invisible pale tints. Native uses these directly
// (RN lacks a built-in linear-gradient primitive); web prefers CATEGORY_CARD_GRADIENT.
export const CATEGORY_CARD_BG_SOLID: Record<CategoryId, string> = {
  'service-record':        '#f5e6cc',  // gold tint
  'community-presence':    '#f5dece',  // terracotta tint
  'finance':               '#d4e8d8',  // emerald tint
  'issue-positions':       '#d8e0f5',  // blue tint
  'ethics-accountability': '#ecc8cf',  // burgundy tint
  'voting-bills':          '#e0d5f0',  // purple tint
}

// Slice 41: CATEGORY_ACCENT_DARK now mirrors CATEGORY_ACCENT (single-hex
// per category, both modes). Export name preserved for slice 37
// `useCategoryAccent` hook back-compat.
export const CATEGORY_ACCENT_DARK: Record<CategoryId, string> = CATEGORY_ACCENT

// Slice 37: dark-mode SUB_CASCADE_ACCENT — softer tint pulled toward
// neutral so cascade levels remain perceptibly distinct from CATEGORY_ACCENT.
export const SUB_CASCADE_ACCENT_DARK: Record<CategoryId, string> = {
  'service-record':        '#9a8866',
  'issue-positions':       '#6680b8',
  'community-presence':    '#4a9888',
  'finance':               '#5e9a70',
  'ethics-accountability': '#b08850',
  'voting-bills':          '#8470a8',
}

// Slice 41: cool slate start stops + cascade endpoint to slice 40 bg.app
// (#16181c, was warm '#1a1714' — slice 40 left this stale).
export const CATEGORY_CARD_GRADIENT_DARK: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #23211a 0%, #16181c 100%)',
  'community-presence':    'linear-gradient(180deg, #23201c 0%, #16181c 100%)',
  'finance':               'linear-gradient(180deg, #1c2521 0%, #16181c 100%)',
  'issue-positions':       'linear-gradient(180deg, #1c2030 0%, #16181c 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #22191d 0%, #16181c 100%)',
  'voting-bills':          'linear-gradient(180deg, #241c2a 0%, #16181c 100%)',
}

// Slice 41: cool slate base + subtle hue tint per category. Replaces the
// slice 33-37 warm-brown anchors that visibly clashed with slice 40's new
// cool slate page bg (#16181c) and card bg (#1e2126).
export const CATEGORY_CARD_BG_SOLID_DARK: Record<CategoryId, string> = {
  'service-record':        '#23211a',  // gold-tinted cool slate — was '#2a221c'
  'community-presence':    '#23201c',  // terracotta-tinted — was '#1c2a28' teal-tinted
  'finance':               '#1c2521',  // emerald-tinted — was '#1c2820' medium-green-tinted
  'issue-positions':       '#1c2030',  // unchanged
  'ethics-accountability': '#22191d',  // burgundy-tinted — was '#2a2218' amber-tinted
  'voting-bills':          '#241c2a',  // unchanged
}
