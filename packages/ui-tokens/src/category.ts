export type CategoryId =
  | 'service-record'
  | 'issue-positions'
  | 'community-presence'
  | 'finance'
  | 'ethics-accountability'
  | 'voting-bills'

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  'service-record':        'Service Record',
  'issue-positions':       'Issue Positions',
  'community-presence':    'Community Presence',
  'finance':               'Finance',
  'ethics-accountability': 'Ethics & Accountability',
  'voting-bills':          'Voting & Bills',
}

// Palette A — semantic earthen. Locked 2026-05-17.
export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#c89a4e',
  'issue-positions':       '#3b6ed1',
  'community-presence':    '#1f9b88',
  'finance':               '#3da75b',
  'ethics-accountability': '#d68a1f',
  'voting-bills':          '#7d57c1',
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
