// Slice 77 (audit C30): the congress number + finance cycle that parameterize
// the federal detail cards were hardcoded independently in the web AND mobile
// detail pages — guaranteed silent divergence at the next congressional
// turnover (the hooks just filter on a stale value; no error). One definition,
// both pages import it. At turnover bump BOTH values here AND the
// congress→start-date map in fetchOfficialTownHalls (queries.ts).
export const CURRENT_CONGRESS = '119'
export const CURRENT_CYCLE = '2024'
