// Slice 3 ingest constants. Updated per congress cycle.
// See spec § Decisions #13 + § Ingest pipeline.

export const OFFICIALS_CONGRESS = '119'
export const OFFICIALS_SOURCE = 'congress.gov.v3'

// Pre-flight sanity checks (spec Improvement 2).
// Refuse to proceed if fetched counts are absurdly low — almost
// certainly an API hiccup, not real turnover.
export const MIN_HOUSE_COUNT  = 400   // House has 435 voting + delegates
export const MIN_SENATE_COUNT = 95    // Senate has 100

// Threshold guard (spec Improvement 3).
// If toDeactivate > max(THRESHOLD_ABS, ceil(active * THRESHOLD_PCT)),
// require explicit --allow-deactivations=N CLI flag.
export const DEACTIVATE_THRESHOLD_ABS = 5
export const DEACTIVATE_THRESHOLD_PCT = 0.01  // 1% of currently-active

// At-large house seats: Congress.gov encodes the at-large district number as 0.
// TIGER renders the same seat as district code 'AL' (see tiger-config.ts).
// Mapping between the two encodings happens in the ingest normalizer; this
// constant is the raw Congress.gov value. Defaulted to 0 here because the
// local Supabase instance was not running at task time to query
// public.districts directly — verified upstream behavior from Congress.gov v3.
export const AT_LARGE_STATES = new Set(['AK','DE','MT','ND','SD','VT','WY'])
export const AT_LARGE_DISTRICT_NUMBER = 0

export const OFFICIALS_DB_URL =
  process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
