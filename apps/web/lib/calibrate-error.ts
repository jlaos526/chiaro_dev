/**
 * Maps a `calibrate-location` Edge Function invoke-error HTTP status to a
 * user-facing message. Shared by the /calibrate page and the
 * /settings/address page so both surface IDENTICAL copy (the settings page
 * previously omitted the 422 branch — Slice 61 audit E9).
 */
export function mapCalibrateError(status: number | undefined): string {
  if (status === 400) return "We couldn't find that address. Double-check spelling."
  if (status === 422) return "We can't resolve districts for that location yet."
  if (status === 502) return 'Address lookup is temporarily unavailable. Try again.'
  return 'Something went wrong saving your location. Try again.'
}
