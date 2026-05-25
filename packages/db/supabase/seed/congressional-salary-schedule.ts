// Source: Congressional Research Service, "Salaries of Members of Congress: Recent Actions
// and Historical Tables" (https://crsreports.congress.gov/product/pdf/R/R44648).
// Updated 2025; reflects current statutory rates.

export const CONGRESSIONAL_SALARY_SOURCE =
  'https://crsreports.congress.gov/product/pdf/R/R44648'

export const CONGRESSIONAL_SALARY_SCHEDULE: Record<string, number> = {
  Member:                                174_000,
  Speaker:                               223_500,
  'President Pro Tempore':               193_400,
  'Majority Leader':                     193_400,
  'Minority Leader':                     193_400,
  'Majority Whip':                       193_400,
  'Minority Whip':                       193_400,
  // Committee chairs + ranking members: same as Members under current statute.
}

export function lookupSalary(role: string | null | undefined): { amount: number; role: string } {
  if (!role) return { amount: CONGRESSIONAL_SALARY_SCHEDULE.Member!, role: 'Member' }
  const exact = CONGRESSIONAL_SALARY_SCHEDULE[role]
  if (exact !== undefined) return { amount: exact, role }
  return { amount: CONGRESSIONAL_SALARY_SCHEDULE.Member!, role: 'Member' }
}
