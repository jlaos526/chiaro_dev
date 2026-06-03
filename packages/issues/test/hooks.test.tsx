import { describe, it, expect } from 'vitest'
import { issuesKeys } from '../src/keys.ts'
import {
  useIssueCatalog,
  useMySelections,
  useRepAlignment,
  useSaveSelections,
} from '../src/hooks.ts'

describe('hooks wiring', () => {
  it('repAlignment key is officialId-scoped', () => {
    expect(issuesKeys.repAlignment('x')).toEqual(['issues', 'repAlignment', 'x'])
  })

  it('exports the 4 public hooks as functions', () => {
    expect(typeof useIssueCatalog).toBe('function')
    expect(typeof useMySelections).toBe('function')
    expect(typeof useRepAlignment).toBe('function')
    expect(typeof useSaveSelections).toBe('function')
  })
})
