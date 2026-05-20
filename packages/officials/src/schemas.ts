import { z } from 'zod'

// Mirrors the public.official_chamber enum (migration 0028).
// Used to validate external payloads carrying chamber values.
export const ChamberSchema = z.enum([
  'federal_house',
  'federal_senate',
  'state_house',
  'state_senate',
  'state_legislature',
])
