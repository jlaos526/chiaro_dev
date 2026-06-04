// Curated OpenSecrets industry-name lists per watchlist category. Strings must
// match finance_industry_top.industry EXACTLY (the SQL fn does `industry in (...)`).
// Operator extends these in code as new industries surface (YAGNI on a table).

export const FOSSIL_FUEL_INDUSTRIES: string[] = [
  'Oil & Gas',
  'Coal Mining',
  'Mining',
  'Electric Utilities',
  'Natural Gas Pipelines',
  'Oil & Gas Refining & Marketing',
]

export const PRIVATE_PRISON_INDUSTRIES: string[] = [
  'Private Prisons',
  'Corrections',
  'Prisons & Corrections',
]
