export function titleCaseIssueArea(kebab: string): string {
  if (!kebab) return ''
  return kebab
    .split('-')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
