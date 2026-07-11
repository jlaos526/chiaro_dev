import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { hasFlag, isCliEntry, parseFlag } from './cli.ts'

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

describe('parseFlag', () => {
  it('returns the value after = when the flag is present', () => {
    expect(parseFlag('session', ['node', 'x', '--session=2024'])).toBe('2024')
  })

  it('returns undefined when the flag is absent', () => {
    expect(parseFlag('session', ['node', 'x', '--state=CA'])).toBe(undefined)
  })

  it('returns empty string for --name= (present with empty value)', () => {
    expect(parseFlag('session', ['--session='])).toBe('')
  })

  it('preserves an = inside the value (slices after the first =)', () => {
    expect(parseFlag('cycle', ['--cycle=2023-2024=x'])).toBe('2023-2024=x')
  })

  it('first occurrence wins on duplicates', () => {
    expect(parseFlag('state', ['--state=CA', '--state=NY'])).toBe('CA')
  })

  it('does not match a --name=value flag whose name is a prefix of another', () => {
    // --state must not be matched by parseFlag('stat')
    expect(parseFlag('stat', ['--state=CA'])).toBe(undefined)
  })

  it('defaults argv to process.argv', () => {
    const saved = process.argv
    process.argv = ['node', 'x', '--foo=bar']
    try {
      expect(parseFlag('foo')).toBe('bar')
    } finally {
      process.argv = saved
    }
  })
})

describe('hasFlag', () => {
  it('returns true when the bare flag is present', () => {
    expect(hasFlag('instrument', ['node', 'x', '--instrument'])).toBe(true)
  })

  it('returns false when the bare flag is absent', () => {
    expect(hasFlag('instrument', ['node', 'x', '--no-apply'])).toBe(false)
  })

  it('does not treat a --name=value value flag as the bare flag', () => {
    expect(hasFlag('state', ['--state=CA'])).toBe(false)
  })

  it('defaults argv to process.argv', () => {
    const saved = process.argv
    process.argv = ['node', 'x', '--force']
    try {
      expect(hasFlag('force')).toBe(true)
    } finally {
      process.argv = saved
    }
  })
})
