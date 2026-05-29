// Top-10 OpenSecrets industry categories get stable colors so the same industry
// renders the same color across reps. List from OpenSecrets' top-level industry taxonomy.
export const INDUSTRY_COLOR: Record<string, string> = {
  'Securities & Investment':   '#3b6ed1',
  'Real Estate':               '#1f9b88',
  'Lawyers/Law Firms':         '#7d57c1',
  'Health Professionals':      '#3da75b',
  'Insurance':                 '#f7c63d',
  'Oil & Gas':                 '#1a1714',
  'Pharmaceuticals/Health Products': '#d13b3b',
  'Commercial Banks':          '#5b6cff',
  'Retired':                   '#807a72',
  'Education':                 '#d68a1f',
}

export const INDUSTRY_DEFAULT_COLOR = '#807a72'  // fallback for industries outside top 10

// Slice 37: dark-mode industry palette. Same keys; saturated colors
// lifted +20% lightness; "Oil & Gas" (near-black on light) inverts to
// near-paper neutral on dark; "Retired" stays warm-gray-muted.
export const INDUSTRY_COLOR_DARK: Record<string, string> = {
  'Securities & Investment':   '#7ba0e8',
  'Real Estate':               '#5dc4b3',
  'Lawyers/Law Firms':         '#b399df',
  'Health Professionals':      '#7fc89a',
  'Insurance':                 '#fbdd7f',
  'Oil & Gas':                 '#d4cec5',
  'Pharmaceuticals/Health Products': '#e87878',
  'Commercial Banks':          '#8a98ff',
  'Retired':                   '#a8a098',
  'Education':                 '#ecb05b',
}

export const INDUSTRY_DEFAULT_COLOR_DARK = '#a8a098'
