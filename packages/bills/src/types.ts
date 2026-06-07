import type { Database } from '@chiaro/db'

export type BillRow            = Database['public']['Tables']['bills']['Row']
export type BillSubject        = Database['public']['Tables']['bill_subjects']['Row']
export type BillSponsor        = Database['public']['Tables']['bill_sponsors']['Row']
export type VoteRow            = Database['public']['Tables']['votes']['Row']
export type VotePosition       = Database['public']['Tables']['vote_positions']['Row']
export type BillType           = BillRow['bill_type']
export type BillStatus         = BillRow['status']
export type VotePositionEnum   = VotePosition['position']
