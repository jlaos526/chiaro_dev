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
