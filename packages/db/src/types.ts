export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bill_sponsors: {
        Row: {
          added_date: string | null
          bill_id: string
          official_id: string
          role: string
        }
        Insert: {
          added_date?: string | null
          bill_id: string
          official_id: string
          role: string
        }
        Update: {
          added_date?: string | null
          bill_id?: string
          official_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_sponsors_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_sponsors_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_subjects: {
        Row: {
          bill_id: string
          subject: string
        }
        Insert: {
          bill_id: string
          subject: string
        }
        Update: {
          bill_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_subjects_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_type: Database["public"]["Enums"]["bill_type"]
          congress: string
          congress_gov_url: string | null
          id: string
          ingested_at: string
          introduced_date: string
          latest_action: string | null
          number: number
          policy_area: string | null
          short_title: string | null
          source_url: string
          status: Database["public"]["Enums"]["bill_status"]
          title: string
        }
        Insert: {
          bill_type: Database["public"]["Enums"]["bill_type"]
          congress: string
          congress_gov_url?: string | null
          id?: string
          ingested_at?: string
          introduced_date: string
          latest_action?: string | null
          number: number
          policy_area?: string | null
          short_title?: string | null
          source_url: string
          status: Database["public"]["Enums"]["bill_status"]
          title: string
        }
        Update: {
          bill_type?: Database["public"]["Enums"]["bill_type"]
          congress?: string
          congress_gov_url?: string | null
          id?: string
          ingested_at?: string
          introduced_date?: string
          latest_action?: string | null
          number?: number
          policy_area?: string | null
          short_title?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["bill_status"]
          title?: string
        }
        Relationships: []
      }
      district_offices: {
        Row: {
          address: string
          city: string
          id: string
          official_id: string
          phone: string | null
          source_url: string
          state: string
          zip: string | null
        }
        Insert: {
          address: string
          city: string
          id?: string
          official_id: string
          phone?: string | null
          source_url: string
          state: string
          zip?: string | null
        }
        Update: {
          address?: string
          city?: string
          id?: string
          official_id?: string
          phone?: string | null
          source_url?: string
          state?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "district_offices_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string
          geometry: unknown
          id: string
          name: string
          source_version: string
          state: string
          tier: Database["public"]["Enums"]["district_tier"]
        }
        Insert: {
          code: string
          geometry: unknown
          id?: string
          name: string
          source_version: string
          state: string
          tier: Database["public"]["Enums"]["district_tier"]
        }
        Update: {
          code?: string
          geometry?: unknown
          id?: string
          name?: string
          source_version?: string
          state?: string
          tier?: Database["public"]["Enums"]["district_tier"]
        }
        Relationships: []
      }
      finance_individual_donors: {
        Row: {
          amount: number
          donor_name: string
          employer: string | null
          finance_summary_id: string
          occupation: string | null
          rank: number
        }
        Insert: {
          amount: number
          donor_name: string
          employer?: string | null
          finance_summary_id: string
          occupation?: string | null
          rank: number
        }
        Update: {
          amount?: number
          donor_name?: string
          employer?: string | null
          finance_summary_id?: string
          occupation?: string | null
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_individual_donors_finance_summary_id_fkey"
            columns: ["finance_summary_id"]
            isOneToOne: false
            referencedRelation: "finance_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_industry_top: {
        Row: {
          amount: number
          finance_summary_id: string
          industry: string
          rank: number
        }
        Insert: {
          amount: number
          finance_summary_id: string
          industry: string
          rank: number
        }
        Update: {
          amount?: number
          finance_summary_id?: string
          industry?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_industry_top_finance_summary_id_fkey"
            columns: ["finance_summary_id"]
            isOneToOne: false
            referencedRelation: "finance_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_pac_contributions: {
        Row: {
          amount: number
          finance_summary_id: string
          pac_fec_id: string | null
          pac_name: string
        }
        Insert: {
          amount: number
          finance_summary_id: string
          pac_fec_id?: string | null
          pac_name: string
        }
        Update: {
          amount?: number
          finance_summary_id?: string
          pac_fec_id?: string | null
          pac_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_pac_contributions_finance_summary_id_fkey"
            columns: ["finance_summary_id"]
            isOneToOne: false
            referencedRelation: "finance_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_summaries: {
        Row: {
          cycle: string
          id: string
          in_state_pct: number | null
          ingested_at: string
          official_id: string
          opensecrets_id: string
          out_of_state_pct: number | null
          small_donor_pct: number | null
          source_url: string
          total_disbursed: number | null
          total_raised: number | null
        }
        Insert: {
          cycle: string
          id?: string
          in_state_pct?: number | null
          ingested_at?: string
          official_id: string
          opensecrets_id: string
          out_of_state_pct?: number | null
          small_donor_pct?: number | null
          source_url: string
          total_disbursed?: number | null
          total_raised?: number | null
        }
        Update: {
          cycle?: string
          id?: string
          in_state_pct?: number | null
          ingested_at?: string
          official_id?: string
          opensecrets_id?: string
          out_of_state_pct?: number | null
          small_donor_pct?: number | null
          source_url?: string
          total_disbursed?: number | null
          total_raised?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_summaries_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_top_organizations: {
        Row: {
          amount: number
          finance_summary_id: string
          org_name: string
          rank: number
        }
        Insert: {
          amount: number
          finance_summary_id: string
          org_name: string
          rank: number
        }
        Update: {
          amount?: number
          finance_summary_id?: string
          org_name?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_top_organizations_finance_summary_id_fkey"
            columns: ["finance_summary_id"]
            isOneToOne: false
            referencedRelation: "finance_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      official_metrics: {
        Row: {
          attendance_pct: number | null
          bill_passage_rate: number | null
          bills_cosponsored_count: number | null
          bills_passed_count: number | null
          bills_sponsored_count: number | null
          bipartisan_vote_pct: number | null
          career_bills_sponsored_count: number | null
          committee_assignment_count: number | null
          committee_chair_count: number | null
          committee_leadership_count: number | null
          computed_at: string
          congress: string
          district_offices_count: number | null
          fiscal_impact_per_dollar_raised: number | null
          fiscal_impact_total: number | null
          hearings_held_count: number | null
          home_district_id: string | null
          in_state_donations_pct: number | null
          lives_in_district: boolean | null
          official_id: string
          out_of_state_donations_pct: number | null
          party_unity_pct: number | null
          party_unity_state: number | null
          salary_role: string | null
          salary_usd: number | null
          stock_act_compliance_pct: number | null
          stock_act_disclosures_late: number | null
          stock_act_disclosures_total: number | null
          subject_breadth: number | null
          tenure_years: number | null
          total_roll_calls: number | null
          town_halls_count: number | null
          votes_missed_count: number | null
          votes_voted_count: number | null
        }
        Insert: {
          attendance_pct?: number | null
          bill_passage_rate?: number | null
          bills_cosponsored_count?: number | null
          bills_passed_count?: number | null
          bills_sponsored_count?: number | null
          bipartisan_vote_pct?: number | null
          career_bills_sponsored_count?: number | null
          committee_assignment_count?: number | null
          committee_chair_count?: number | null
          committee_leadership_count?: number | null
          computed_at?: string
          congress: string
          district_offices_count?: number | null
          fiscal_impact_per_dollar_raised?: number | null
          fiscal_impact_total?: number | null
          hearings_held_count?: number | null
          home_district_id?: string | null
          in_state_donations_pct?: number | null
          lives_in_district?: boolean | null
          official_id: string
          out_of_state_donations_pct?: number | null
          party_unity_pct?: number | null
          party_unity_state?: number | null
          salary_role?: string | null
          salary_usd?: number | null
          stock_act_compliance_pct?: number | null
          stock_act_disclosures_late?: number | null
          stock_act_disclosures_total?: number | null
          subject_breadth?: number | null
          tenure_years?: number | null
          total_roll_calls?: number | null
          town_halls_count?: number | null
          votes_missed_count?: number | null
          votes_voted_count?: number | null
        }
        Update: {
          attendance_pct?: number | null
          bill_passage_rate?: number | null
          bills_cosponsored_count?: number | null
          bills_passed_count?: number | null
          bills_sponsored_count?: number | null
          bipartisan_vote_pct?: number | null
          career_bills_sponsored_count?: number | null
          committee_assignment_count?: number | null
          committee_chair_count?: number | null
          committee_leadership_count?: number | null
          computed_at?: string
          congress?: string
          district_offices_count?: number | null
          fiscal_impact_per_dollar_raised?: number | null
          fiscal_impact_total?: number | null
          hearings_held_count?: number | null
          home_district_id?: string | null
          in_state_donations_pct?: number | null
          lives_in_district?: boolean | null
          official_id?: string
          out_of_state_donations_pct?: number | null
          party_unity_pct?: number | null
          party_unity_state?: number | null
          salary_role?: string | null
          salary_usd?: number | null
          stock_act_compliance_pct?: number | null
          stock_act_disclosures_late?: number | null
          stock_act_disclosures_total?: number | null
          subject_breadth?: number | null
          tenure_years?: number | null
          total_roll_calls?: number | null
          town_halls_count?: number | null
          votes_missed_count?: number | null
          votes_voted_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "official_metrics_home_district_id_fkey"
            columns: ["home_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_metrics_home_district_id_fkey"
            columns: ["home_district_id"]
            isOneToOne: false
            referencedRelation: "districts_geojson"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_metrics_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: true
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      officials: {
        Row: {
          bioguide_id: string | null
          chamber: Database["public"]["Enums"]["official_chamber"]
          created_at: string
          district_code: string | null
          district_id: string
          fec_candidate_id: string | null
          first_name: string
          full_name: string
          id: string
          in_office: boolean
          last_name: string
          next_election: string | null
          official_url: string | null
          opensecrets_id: string | null
          openstates_person_id: string | null
          party: string
          portrait_url: string | null
          senate_class: number | null
          source_version: string
          state: string
          title: string | null
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          bioguide_id?: string | null
          chamber: Database["public"]["Enums"]["official_chamber"]
          created_at?: string
          district_code?: string | null
          district_id: string
          fec_candidate_id?: string | null
          first_name: string
          full_name: string
          id?: string
          in_office?: boolean
          last_name: string
          next_election?: string | null
          official_url?: string | null
          opensecrets_id?: string | null
          openstates_person_id?: string | null
          party: string
          portrait_url?: string | null
          senate_class?: number | null
          source_version: string
          state: string
          title?: string | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          bioguide_id?: string | null
          chamber?: Database["public"]["Enums"]["official_chamber"]
          created_at?: string
          district_code?: string | null
          district_id?: string
          fec_candidate_id?: string | null
          first_name?: string
          full_name?: string
          id?: string
          in_office?: boolean
          last_name?: string
          next_election?: string | null
          official_url?: string | null
          opensecrets_id?: string | null
          openstates_person_id?: string | null
          party?: string
          portrait_url?: string | null
          senate_class?: number | null
          source_version?: string
          state?: string
          title?: string | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "officials_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officials_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      officials_ingest_runs: {
        Row: {
          completed_at: string | null
          congress: string
          deactivated_count: number | null
          error: string | null
          fetched_count: number | null
          flags: string[] | null
          id: string
          ingested_count: number | null
          notes: string | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          congress: string
          deactivated_count?: number | null
          error?: string | null
          fetched_count?: number | null
          flags?: string[] | null
          id?: string
          ingested_count?: number | null
          notes?: string | null
          source: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          congress?: string
          deactivated_count?: number | null
          error?: string | null
          fetched_count?: number | null
          flags?: string[] | null
          id?: string
          ingested_count?: number | null
          notes?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      officials_leadership_history: {
        Row: {
          chamber: Database["public"]["Enums"]["official_chamber"]
          end_date: string | null
          id: string
          official_id: string
          party: string | null
          role: string
          source_url: string
          start_date: string
        }
        Insert: {
          chamber: Database["public"]["Enums"]["official_chamber"]
          end_date?: string | null
          id?: string
          official_id: string
          party?: string | null
          role: string
          source_url: string
          start_date: string
        }
        Update: {
          chamber?: Database["public"]["Enums"]["official_chamber"]
          end_date?: string | null
          id?: string
          official_id?: string
          party?: string | null
          role?: string
          source_url?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "officials_leadership_history_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          completed: boolean
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          platform: Database["public"]["Enums"]["push_platform"]
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform: Database["public"]["Enums"]["push_platform"]
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: Database["public"]["Enums"]["push_platform"]
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      scorecard_orgs: {
        Row: {
          id: string
          issue_area: string
          lean: string | null
          methodology_url: string
          name: string
          notes: string | null
          scoring_max: number
          scoring_min: number
          slug: string
        }
        Insert: {
          id?: string
          issue_area: string
          lean?: string | null
          methodology_url: string
          name: string
          notes?: string | null
          scoring_max?: number
          scoring_min?: number
          slug: string
        }
        Update: {
          id?: string
          issue_area?: string
          lean?: string | null
          methodology_url?: string
          name?: string
          notes?: string | null
          scoring_max?: number
          scoring_min?: number
          slug?: string
        }
        Relationships: []
      }
      scorecard_ratings: {
        Row: {
          congress: string
          id: string
          ingested_at: string
          official_id: string
          score: number
          scorecard_id: string
          source_url: string
        }
        Insert: {
          congress: string
          id?: string
          ingested_at?: string
          official_id: string
          score: number
          scorecard_id: string
          source_url: string
        }
        Update: {
          congress?: string
          id?: string
          ingested_at?: string
          official_id?: string
          score?: number
          scorecard_id?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_ratings_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecard_ratings_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "scorecard_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      state_bill_sponsors: {
        Row: {
          added_date: string | null
          bill_id: string
          id: string
          official_id: string
          role: string
        }
        Insert: {
          added_date?: string | null
          bill_id: string
          id?: string
          official_id: string
          role: string
        }
        Update: {
          added_date?: string | null
          bill_id?: string
          id?: string
          official_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_bill_sponsors_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "state_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_bill_sponsors_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_bill_subjects: {
        Row: {
          bill_id: string
          subject: string
        }
        Insert: {
          bill_id: string
          subject: string
        }
        Update: {
          bill_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_bill_subjects_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "state_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      state_bills: {
        Row: {
          augmented_from: string | null
          bill_type: string
          created_at: string
          fiscal_impact_amount: number | null
          hearing_date: string | null
          id: string
          introduced_date: string | null
          latest_action: string | null
          latest_action_date: string | null
          number: number
          openstates_bill_id: string
          openstates_url: string
          party_vote_split: Json | null
          session: string
          source_url: string
          state: string
          status: string | null
          status_substage: string | null
          title: string
          updated_at: string
        }
        Insert: {
          augmented_from?: string | null
          bill_type: string
          created_at?: string
          fiscal_impact_amount?: number | null
          hearing_date?: string | null
          id?: string
          introduced_date?: string | null
          latest_action?: string | null
          latest_action_date?: string | null
          number: number
          openstates_bill_id: string
          openstates_url: string
          party_vote_split?: Json | null
          session: string
          source_url: string
          state: string
          status?: string | null
          status_substage?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          augmented_from?: string | null
          bill_type?: string
          created_at?: string
          fiscal_impact_amount?: number | null
          hearing_date?: string | null
          id?: string
          introduced_date?: string | null
          latest_action?: string | null
          latest_action_date?: string | null
          number?: number
          openstates_bill_id?: string
          openstates_url?: string
          party_vote_split?: Json | null
          session?: string
          source_url?: string
          state?: string
          status?: string | null
          status_substage?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_committee_hearing_attendance: {
        Row: {
          hearing_id: string
          official_id: string
        }
        Insert: {
          hearing_id: string
          official_id: string
        }
        Update: {
          hearing_id?: string
          official_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_committee_hearing_attendance_hearing_id_fkey"
            columns: ["hearing_id"]
            isOneToOne: false
            referencedRelation: "state_committee_hearings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_committee_hearing_attendance_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_committee_hearings: {
        Row: {
          agenda_topic: string | null
          hearing_date: string
          id: string
          ingested_at: string
          location: string | null
          openstates_committee_id: string | null
          session: string
          source_url: string
          state: string
        }
        Insert: {
          agenda_topic?: string | null
          hearing_date: string
          id?: string
          ingested_at?: string
          location?: string | null
          openstates_committee_id?: string | null
          session: string
          source_url: string
          state: string
        }
        Update: {
          agenda_topic?: string | null
          hearing_date?: string
          id?: string
          ingested_at?: string
          location?: string | null
          openstates_committee_id?: string | null
          session?: string
          source_url?: string
          state?: string
        }
        Relationships: []
      }
      state_committee_memberships: {
        Row: {
          chamber: Database["public"]["Enums"]["official_chamber"]
          committee_name: string
          id: string
          ingested_at: string
          official_id: string
          openstates_committee_id: string
          role: string
          session: string | null
          source_url: string
          state: string
        }
        Insert: {
          chamber: Database["public"]["Enums"]["official_chamber"]
          committee_name: string
          id?: string
          ingested_at?: string
          official_id: string
          openstates_committee_id: string
          role: string
          session?: string | null
          source_url: string
          state: string
        }
        Update: {
          chamber?: Database["public"]["Enums"]["official_chamber"]
          committee_name?: string
          id?: string
          ingested_at?: string
          official_id?: string
          openstates_committee_id?: string
          role?: string
          session?: string | null
          source_url?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_committee_memberships_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_district_offices: {
        Row: {
          city: string
          email: string | null
          hours_text: string | null
          id: string
          ingested_at: string
          kind: string
          official_id: string
          phone: string | null
          postal_code: string | null
          source_url: string
          state: string
          street_1: string
          street_2: string | null
        }
        Insert: {
          city: string
          email?: string | null
          hours_text?: string | null
          id?: string
          ingested_at?: string
          kind: string
          official_id: string
          phone?: string | null
          postal_code?: string | null
          source_url: string
          state: string
          street_1: string
          street_2?: string | null
        }
        Update: {
          city?: string
          email?: string | null
          hours_text?: string | null
          id?: string
          ingested_at?: string
          kind?: string
          official_id?: string
          phone?: string | null
          postal_code?: string | null
          source_url?: string
          state?: string
          street_1?: string
          street_2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "state_district_offices_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_ethics_complaints: {
        Row: {
          complaint_date: string
          disposition: string | null
          external_id: string | null
          id: string
          ingested_at: string
          official_id: string
          source: string
          source_url: string
          state: string
          status: string
          summary: string
        }
        Insert: {
          complaint_date: string
          disposition?: string | null
          external_id?: string | null
          id?: string
          ingested_at?: string
          official_id: string
          source: string
          source_url: string
          state: string
          status: string
          summary: string
        }
        Update: {
          complaint_date?: string
          disposition?: string | null
          external_id?: string | null
          id?: string
          ingested_at?: string
          official_id?: string
          source?: string
          source_url?: string
          state?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_ethics_complaints_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_finance_individual_donors: {
        Row: {
          amount: number
          city: string | null
          donor_name: string
          donor_state: string | null
          employer: string | null
          occupation: string | null
          rank: number
          state_finance_summary_id: string
        }
        Insert: {
          amount: number
          city?: string | null
          donor_name: string
          donor_state?: string | null
          employer?: string | null
          occupation?: string | null
          rank: number
          state_finance_summary_id: string
        }
        Update: {
          amount?: number
          city?: string | null
          donor_name?: string
          donor_state?: string | null
          employer?: string | null
          occupation?: string | null
          rank?: number
          state_finance_summary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_finance_individual_donors_state_finance_summary_id_fkey"
            columns: ["state_finance_summary_id"]
            isOneToOne: false
            referencedRelation: "state_finance_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      state_finance_summaries: {
        Row: {
          cycle: string
          id: string
          in_state_pct: number | null
          ingested_at: string
          official_id: string
          small_donor_pct: number | null
          source: string
          source_url: string
          total_disbursed: number | null
          total_raised: number | null
        }
        Insert: {
          cycle: string
          id?: string
          in_state_pct?: number | null
          ingested_at?: string
          official_id: string
          small_donor_pct?: number | null
          source: string
          source_url: string
          total_disbursed?: number | null
          total_raised?: number | null
        }
        Update: {
          cycle?: string
          id?: string
          in_state_pct?: number | null
          ingested_at?: string
          official_id?: string
          small_donor_pct?: number | null
          source?: string
          source_url?: string
          total_disbursed?: number | null
          total_raised?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "state_finance_summaries_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_financial_disclosures: {
        Row: {
          amount_range_high: number | null
          amount_range_low: number | null
          external_id: string | null
          filing_date: string | null
          filing_year: number
          id: string
          income_kind: string | null
          income_source: string | null
          ingested_at: string
          official_id: string
          source: string
          source_url: string
          state: string
        }
        Insert: {
          amount_range_high?: number | null
          amount_range_low?: number | null
          external_id?: string | null
          filing_date?: string | null
          filing_year: number
          id?: string
          income_kind?: string | null
          income_source?: string | null
          ingested_at?: string
          official_id: string
          source: string
          source_url: string
          state: string
        }
        Update: {
          amount_range_high?: number | null
          amount_range_low?: number | null
          external_id?: string | null
          filing_date?: string | null
          filing_year?: number
          id?: string
          income_kind?: string | null
          income_source?: string | null
          ingested_at?: string
          official_id?: string
          source?: string
          source_url?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_financial_disclosures_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_official_events: {
        Row: {
          event_date: string
          event_type: string
          external_id: string | null
          id: string
          ingested_at: string
          official_id: string
          outcome: string | null
          source: string
          source_url: string
          state: string
          summary: string
        }
        Insert: {
          event_date: string
          event_type: string
          external_id?: string | null
          id?: string
          ingested_at?: string
          official_id: string
          outcome?: string | null
          source: string
          source_url: string
          state: string
          summary: string
        }
        Update: {
          event_date?: string
          event_type?: string
          external_id?: string | null
          id?: string
          ingested_at?: string
          official_id?: string
          outcome?: string | null
          source?: string
          source_url?: string
          state?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_official_events_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_scorecard_orgs: {
        Row: {
          id: string
          issue_area: string
          lean: string
          methodology_url: string
          name: string
          notes: string | null
          scoring_max: number
          scoring_min: number
          slug: string
          state: string
        }
        Insert: {
          id?: string
          issue_area: string
          lean: string
          methodology_url: string
          name: string
          notes?: string | null
          scoring_max?: number
          scoring_min?: number
          slug: string
          state: string
        }
        Update: {
          id?: string
          issue_area?: string
          lean?: string
          methodology_url?: string
          name?: string
          notes?: string | null
          scoring_max?: number
          scoring_min?: number
          slug?: string
          state?: string
        }
        Relationships: []
      }
      state_scorecard_ratings: {
        Row: {
          id: string
          ingested_at: string
          official_id: string
          score: number
          scorecard_id: string
          session: string
          source_url: string
        }
        Insert: {
          id?: string
          ingested_at?: string
          official_id: string
          score: number
          scorecard_id: string
          session: string
          source_url: string
        }
        Update: {
          id?: string
          ingested_at?: string
          official_id?: string
          score?: number
          scorecard_id?: string
          session?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_scorecard_ratings_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_scorecard_ratings_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "state_scorecard_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      state_town_halls: {
        Row: {
          attendance_estimate: number | null
          city: string | null
          event_date: string
          external_id: string | null
          format: string | null
          id: string
          ingested_at: string
          official_id: string
          source: string
          source_url: string
          state: string
        }
        Insert: {
          attendance_estimate?: number | null
          city?: string | null
          event_date: string
          external_id?: string | null
          format?: string | null
          id?: string
          ingested_at?: string
          official_id: string
          source: string
          source_url: string
          state: string
        }
        Update: {
          attendance_estimate?: number | null
          city?: string | null
          event_date?: string
          external_id?: string | null
          format?: string | null
          id?: string
          ingested_at?: string
          official_id?: string
          source?: string
          source_url?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_town_halls_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      state_vote_positions: {
        Row: {
          id: string
          official_id: string
          position: string
          vote_id: string
        }
        Insert: {
          id?: string
          official_id: string
          position: string
          vote_id: string
        }
        Update: {
          id?: string
          official_id?: string
          position?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_vote_positions_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_vote_positions_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "state_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      state_votes: {
        Row: {
          bill_id: string
          chamber: Database["public"]["Enums"]["official_chamber"]
          created_at: string
          id: string
          openstates_vote_id: string
          party_vote_split: Json | null
          question: string
          result: string
          session: string
          source_url: string
          state: string
          vote_date: string
        }
        Insert: {
          bill_id: string
          chamber: Database["public"]["Enums"]["official_chamber"]
          created_at?: string
          id?: string
          openstates_vote_id: string
          party_vote_split?: Json | null
          question: string
          result: string
          session: string
          source_url: string
          state: string
          vote_date: string
        }
        Update: {
          bill_id?: string
          chamber?: Database["public"]["Enums"]["official_chamber"]
          created_at?: string
          id?: string
          openstates_vote_id?: string
          party_vote_split?: Json | null
          question?: string
          result?: string
          session?: string
          source_url?: string
          state?: string
          vote_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_votes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "state_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          amount_range_high: number | null
          amount_range_low: number | null
          asset_name: string | null
          asset_ticker: string | null
          days_late: number | null
          external_id: string | null
          filing_date: string
          id: string
          ingested_at: string
          official_id: string
          source: string
          source_url: string
          transaction_date: string
          transaction_type: string | null
        }
        Insert: {
          amount_range_high?: number | null
          amount_range_low?: number | null
          asset_name?: string | null
          asset_ticker?: string | null
          days_late?: number | null
          external_id?: string | null
          filing_date: string
          id?: string
          ingested_at?: string
          official_id: string
          source: string
          source_url: string
          transaction_date: string
          transaction_type?: string | null
        }
        Update: {
          amount_range_high?: number | null
          amount_range_low?: number | null
          asset_name?: string | null
          asset_ticker?: string | null
          days_late?: number | null
          external_id?: string | null
          filing_date?: string
          id?: string
          ingested_at?: string
          official_id?: string
          source?: string
          source_url?: string
          transaction_date?: string
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      town_halls: {
        Row: {
          attendance_estimate: number | null
          city: string | null
          event_date: string
          external_id: string | null
          format: string | null
          id: string
          ingested_at: string
          official_id: string
          source: string
          source_url: string
          state: string | null
        }
        Insert: {
          attendance_estimate?: number | null
          city?: string | null
          event_date: string
          external_id?: string | null
          format?: string | null
          id?: string
          ingested_at?: string
          official_id: string
          source: string
          source_url: string
          state?: string | null
        }
        Update: {
          attendance_estimate?: number | null
          city?: string | null
          event_date?: string
          external_id?: string | null
          format?: string | null
          id?: string
          ingested_at?: string
          official_id?: string
          source?: string
          source_url?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "town_halls_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_districts: {
        Row: {
          created_at: string
          district_id: string
          tier: Database["public"]["Enums"]["district_tier"]
          user_id: string
        }
        Insert: {
          created_at?: string
          district_id: string
          tier: Database["public"]["Enums"]["district_tier"]
          user_id: string
        }
        Update: {
          created_at?: string
          district_id?: string
          tier?: Database["public"]["Enums"]["district_tier"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_districts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_districts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          calibrated_at: string
          geocodio_response: Json
          home_address_text: string
          home_location: unknown
          id: string
        }
        Insert: {
          calibrated_at?: string
          geocodio_response: Json
          home_address_text: string
          home_location: unknown
          id: string
        }
        Update: {
          calibrated_at?: string
          geocodio_response?: Json
          home_address_text?: string
          home_location?: unknown
          id?: string
        }
        Relationships: []
      }
      vote_positions: {
        Row: {
          official_id: string
          position: Database["public"]["Enums"]["vote_position"]
          vote_id: string
        }
        Insert: {
          official_id: string
          position: Database["public"]["Enums"]["vote_position"]
          vote_id: string
        }
        Update: {
          official_id?: string
          position?: Database["public"]["Enums"]["vote_position"]
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_positions_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_positions_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          bill_id: string | null
          chamber: Database["public"]["Enums"]["official_chamber"]
          congress: string
          id: string
          ingested_at: string
          question: string
          result: string
          roll_call: number
          session: number
          source_url: string
          vote_date: string
        }
        Insert: {
          bill_id?: string | null
          chamber: Database["public"]["Enums"]["official_chamber"]
          congress: string
          id?: string
          ingested_at?: string
          question: string
          result: string
          roll_call: number
          session: number
          source_url: string
          vote_date: string
        }
        Update: {
          bill_id?: string | null
          chamber?: Database["public"]["Enums"]["official_chamber"]
          congress?: string
          id?: string
          ingested_at?: string
          question?: string
          result?: string
          roll_call?: number
          session?: number
          source_url?: string
          vote_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      districts_geojson: {
        Row: {
          code: string | null
          geometry: Json | null
          id: string | null
          name: string | null
          source_version: string | null
          state: string | null
          tier: Database["public"]["Enums"]["district_tier"] | null
        }
        Insert: {
          code?: string | null
          geometry?: never
          id?: string | null
          name?: string | null
          source_version?: string | null
          state?: string | null
          tier?: Database["public"]["Enums"]["district_tier"] | null
        }
        Update: {
          code?: string | null
          geometry?: never
          id?: string | null
          name?: string | null
          source_version?: string | null
          state?: string | null
          tier?: Database["public"]["Enums"]["district_tier"] | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      user_locations_geojson: {
        Row: {
          calibrated_at: string | null
          home_address_text: string | null
          home_location_geojson: Json | null
          id: string | null
        }
        Insert: {
          calibrated_at?: string | null
          home_address_text?: string | null
          home_location_geojson?: never
          id?: string | null
        }
        Update: {
          calibrated_at?: string | null
          home_address_text?: string | null
          home_location_geojson?: never
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      apply_calibration: {
        Args: {
          p_address_text: string
          p_geocodio_response: Json
          p_lat: number
          p_lng: number
          p_resolved: Json
        }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      bill_status:
        | "introduced"
        | "in_committee"
        | "reported"
        | "passed_chamber"
        | "passed_both"
        | "enrolled"
        | "signed"
        | "vetoed"
        | "became_law"
        | "died"
      bill_type:
        | "hr"
        | "s"
        | "hjres"
        | "sjres"
        | "hconres"
        | "sconres"
        | "hres"
        | "sres"
      district_tier:
        | "federal_house"
        | "federal_senate"
        | "state_senate"
        | "state_house"
        | "county"
        | "place"
      official_chamber:
        | "federal_house"
        | "federal_senate"
        | "state_house"
        | "state_senate"
        | "state_legislature"
      push_platform: "ios" | "android" | "web"
      vote_position: "yes" | "no" | "present" | "not_voting"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bill_status: [
        "introduced",
        "in_committee",
        "reported",
        "passed_chamber",
        "passed_both",
        "enrolled",
        "signed",
        "vetoed",
        "became_law",
        "died",
      ],
      bill_type: [
        "hr",
        "s",
        "hjres",
        "sjres",
        "hconres",
        "sconres",
        "hres",
        "sres",
      ],
      district_tier: [
        "federal_house",
        "federal_senate",
        "state_senate",
        "state_house",
        "county",
        "place",
      ],
      official_chamber: [
        "federal_house",
        "federal_senate",
        "state_house",
        "state_senate",
        "state_legislature",
      ],
      push_platform: ["ios", "android", "web"],
      vote_position: ["yes", "no", "present", "not_voting"],
    },
  },
} as const

