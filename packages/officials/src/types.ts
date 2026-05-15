import type { Database } from '@chiaro/db'

export type OfficialRow = Database['public']['Tables']['officials']['Row']
export type Chamber = OfficialRow['chamber']
export type Party = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export interface OfficialWithDistrict extends OfficialRow {
  district: {
    id: string
    tier: Database['public']['Tables']['districts']['Row']['tier']
    state: string
    code: string
    name: string
  }
}
