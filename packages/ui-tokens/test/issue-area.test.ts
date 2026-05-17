import { describe, expect, it } from 'vitest'
import { titleCaseIssueArea } from '../src/issue-area.ts'

describe('titleCaseIssueArea', () => {
  it('single-word kebab → Title', () => {
    expect(titleCaseIssueArea('environment')).toBe('Environment')
    expect(titleCaseIssueArea('labor')).toBe('Labor')
  })
  it('multi-word kebab → Title Case', () => {
    expect(titleCaseIssueArea('civil-liberties')).toBe('Civil Liberties')
    expect(titleCaseIssueArea('civil-rights')).toBe('Civil Rights')
    expect(titleCaseIssueArea('reproductive-rights')).toBe('Reproductive Rights')
    expect(titleCaseIssueArea('liberal-policy')).toBe('Liberal Policy')
    expect(titleCaseIssueArea('conservative-policy')).toBe('Conservative Policy')
    expect(titleCaseIssueArea('business-policy')).toBe('Business Policy')
    expect(titleCaseIssueArea('second-amendment')).toBe('Second Amendment')
  })
  it('empty string → empty string', () => {
    expect(titleCaseIssueArea('')).toBe('')
  })
})
