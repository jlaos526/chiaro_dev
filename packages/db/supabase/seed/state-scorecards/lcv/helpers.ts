export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'

export const RATE_LIMIT_MS = 1000

export function normalizePartyChar(char: string): string {
  switch (char.trim().toUpperCase()) {
    case 'D':
      return 'Democratic'
    case 'R':
      return 'Republican'
    case 'I':
      return 'Independent'
    default:
      return char
  }
}

/**
 * Re-export from shared module. Slice 15 hoisted the canonical
 * definition to seed/shared/officials.ts; this re-export keeps
 * existing lcv mi.ts + co.ts imports working without churn.
 */
export { resolveOpenstatesPersonId } from '../../shared/officials.ts'
