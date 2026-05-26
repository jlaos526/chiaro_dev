import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { isCliEntry } from './cli.ts'

describe('isCliEntry', () => {
  it('returns true when import.meta.url matches pathToFileURL(argv[1]).href', () => {
    const savedArgv1 = process.argv[1]!
    process.argv[1] = process.cwd() + '/test-script.ts'
    const expected = pathToFileURL(process.argv[1]).href
    expect(isCliEntry(expected)).toBe(true)
    process.argv[1] = savedArgv1
  })

  it('returns false on mismatch', () => {
    expect(isCliEntry('file:///different.ts')).toBe(false)
  })

  it('returns false when argv[1] is undefined', () => {
    const savedArgv1 = process.argv[1]!
    process.argv = [process.argv[0]!]  // strip argv[1]
    expect(isCliEntry('file:///anything')).toBe(false)
    process.argv[1] = savedArgv1
  })
})
