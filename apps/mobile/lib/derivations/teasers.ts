import { titleCaseIssueArea } from '@chiaro/ui-tokens'

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? singular + 's')}`
}

export function serviceRecordTeaser(args: {
  role: string | null
  firstElectedYear: number | null
}): string | null {
  if (!args.role) return null
  if (args.firstElectedYear == null) return args.role
  return `${args.role} · since ${args.firstElectedYear}`
}

export function issuePositionsTeaser(args: {
  topAlignedIssue: string | null
  topDifferIssue:  string | null
}): string | null {
  const aligned = args.topAlignedIssue ? titleCaseIssueArea(args.topAlignedIssue) : null
  const differs = args.topDifferIssue ? titleCaseIssueArea(args.topDifferIssue) : null
  if (!aligned && !differs) return null
  if (aligned && differs) return `Strongly aligned on ${aligned}, differs on ${differs}`
  if (aligned) return `Strongly aligned on ${aligned}`
  return `Differs on ${differs}`
}

export function communityPresenceTeaser(args: {
  livesInDistrict: boolean | null
  officeCount: number
  recentTownHallCount: number
}): string | null {
  const parts: string[] = []
  if (args.livesInDistrict === true) parts.push('Lives in district')
  const offices = plural(args.officeCount, 'office')
  const halls = plural(args.recentTownHallCount, 'recent town hall')
  parts.push(`${offices}, ${halls}`)
  return parts.join(' · ')
}

function formatMillions(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function financeTeaser(args: {
  totalRaised: number | null
  topIndustry: string | null
}): string | null {
  if (args.totalRaised == null) return null
  const raised = formatMillions(args.totalRaised)
  if (!args.topIndustry) return `${raised} raised`
  return `${raised} raised · top industry: ${args.topIndustry}`
}

export function ethicsAccountabilityTeaser(args: {
  lateTrades: number
  inStatePct: number | null
}): string | null {
  const trades = plural(args.lateTrades, 'stock trade') + ' late'
  if (args.inStatePct == null) return trades
  const majority = args.inStatePct >= 50 ? 'in-state' : 'out-of-state'
  return `${trades} · majority of donors ${majority}`
}

function attendanceLabel(pct: number | null): string {
  if (pct == null) return 'No attendance data'
  if (pct >= 90) return 'High attendance'
  if (pct >= 70) return 'Strong attendance'
  if (pct >= 40) return 'Mixed attendance'
  return 'Low attendance'
}

export function votingBillsTeaser(args: {
  attendancePct: number | null
  billsThisCongress: number
}): string | null {
  const att = attendanceLabel(args.attendancePct)
  const bills = `${plural(args.billsThisCongress, 'bill')} introduced this Congress`
  return `${att} · ${bills}`
}
