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

export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)',
  'issue-positions':       'linear-gradient(180deg, #f6f8fc 0%, #fff 100%)',
  'community-presence':    'linear-gradient(180deg, #f3faf8 0%, #fff 100%)',
  'finance':               'linear-gradient(180deg, #f4faf6 0%, #fff 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)',
  'voting-bills':          'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)',
}

// Slice 37: solid per-category card background tokens (moved from
// MetricCardShell). Native uses these directly (RN lacks a built-in
// linear-gradient primitive); web prefers CATEGORY_CARD_GRADIENT.
export const CATEGORY_CARD_BG_SOLID: Record<CategoryId, string> = {
  'service-record':        '#fcfaf2',
  'issue-positions':       '#f6f8fc',
  'community-presence':    '#f3faf8',
  'finance':               '#f4faf6',
  'ethics-accountability': '#fcf7f0',
  'voting-bills':          '#f7f4fc',
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

// Slice 37: dark-mode CATEGORY_CARD_GRADIENT — fades a deep tier-tinted
// stop to the same neutral surface used in CATEGORY_CARD_BG_SOLID_DARK.
export const CATEGORY_CARD_GRADIENT_DARK: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #2a221c 0%, #1a1714 100%)',
  'issue-positions':       'linear-gradient(180deg, #1c2030 0%, #1a1714 100%)',
  'community-presence':    'linear-gradient(180deg, #1c2a28 0%, #1a1714 100%)',
  'finance':               'linear-gradient(180deg, #1c2820 0%, #1a1714 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #2a2218 0%, #1a1714 100%)',
  'voting-bills':          'linear-gradient(180deg, #241c2a 0%, #1a1714 100%)',
}

// Slice 37: dark-mode CATEGORY_CARD_BG_SOLID. Deeper warm equivalents so
// each card retains its semantic temperature against a dark surface.
export const CATEGORY_CARD_BG_SOLID_DARK: Record<CategoryId, string> = {
  'service-record':        '#2a221c',
  'issue-positions':       '#1c2030',
  'community-presence':    '#1c2a28',
  'finance':               '#1c2820',
  'ethics-accountability': '#2a2218',
  'voting-bills':          '#241c2a',
}
