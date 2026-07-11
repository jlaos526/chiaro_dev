import type { Database } from '@chiaro/db'

export type IssueTopicRow = Database['public']['Tables']['issue_topics']['Row']
export type IssueLensRow = Database['public']['Tables']['issue_lenses']['Row']
export type UserIssueSelectionRow = Database['public']['Tables']['user_issue_selections']['Row']

export interface MeasurementSource {
  type: 'scorecard' | 'bill-vote'
  weight: number
  config: { orgs?: string[]; invert?: boolean; subjects?: string[]; agree_position?: 'yes' | 'no' }
}
export interface QuizQuestion {
  slug: string
  prompt: string
  agree_direction: 1 | -1
  display_order: number
}
export type LensType = 'stance' | 'watchlist'

export interface IssueLens
  extends Omit<IssueLensRow, 'measurement_sources' | 'quiz_questions' | 'lens_type'> {
  lens_type: LensType
  measurement_sources: MeasurementSource[]
  quiz_questions: QuizQuestion[]
}
export interface IssueTopic extends IssueTopicRow {
  lenses: IssueLens[]
}

export type QuizAnswer = {
  topicSlug: string
  lensSlug: string
  questionSlug: string
  answer: 'agree' | 'disagree' | 'skip'
  starred: boolean
}
export type StancePosition = {
  topicSlug: string
  lensSlug: string
  position: number | null
  importance: 1 | 2
}

export type AlignmentDot = 'aligned' | 'partial' | 'differs' | 'none'
export interface AlignmentAxis {
  topicSlug: string
  label: string
  alignmentPct: number | null
  dot: AlignmentDot
  userPos: number | null
  repPos: number | null
}
export interface RepAlignment {
  overallPct: number | null
  axes: AlignmentAxis[]
}

export interface EvidenceSource {
  type: 'finance-industry'
  config: { category: string; industries: string[]; min_amount?: number }
}
export interface WatchlistEvidenceItem {
  industry: string
  amount: number
}
export interface RepWatchlistFlag {
  topicSlug: string
  lensSlug: string
  label: string
  category: string
  totalAmount: number
  evidence: WatchlistEvidenceItem[]
}
