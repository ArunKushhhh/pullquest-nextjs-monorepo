export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acts: {
        Row: {
          act_number: number
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          act_number: number
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          act_number?: number
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          earned_balance_after: number
          id: string
          locked_balance_after: number
          purchased_balance_after: number
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          earned_balance_after: number
          id?: string
          locked_balance_after: number
          purchased_balance_after: number
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          earned_balance_after?: number
          id?: string
          locked_balance_after?: number
          purchased_balance_after?: number
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          code_quality_score: number
          comments: string | null
          complexity_score: number
          created_at: string
          documentation_score: number
          id: string
          maintainer_id: string
          overall_score: number
          pr_id: string
          test_coverage_score: number
          total_score: number
        }
        Insert: {
          code_quality_score: number
          comments?: string | null
          complexity_score: number
          created_at?: string
          documentation_score: number
          id?: string
          maintainer_id: string
          overall_score: number
          pr_id: string
          test_coverage_score: number
          total_score: number
        }
        Update: {
          code_quality_score?: number
          comments?: string | null
          complexity_score?: number
          created_at?: string
          documentation_score?: number
          id?: string
          maintainer_id?: string
          overall_score?: number
          pr_id?: string
          test_coverage_score?: number
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_maintainer_id_fkey"
            columns: ["maintainer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: true
            referencedRelation: "pull_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          account_id: number
          account_login: string
          account_type: string
          created_at: string
          id: string
          installation_id: number
          installed_at: string
          installed_by: string
          permissions: Json
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: number
          account_login: string
          account_type: string
          created_at?: string
          id?: string
          installation_id: number
          installed_at?: string
          installed_by: string
          permissions?: Json
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: number
          account_login?: string
          account_type?: string
          created_at?: string
          id?: string
          installation_id?: number
          installed_at?: string
          installed_by?: string
          permissions?: Json
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installations_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          ai_summary: string | null
          created_at: string
          difficulty: string
          github_issue_id: number
          github_issue_number: number
          id: string
          is_open: boolean
          org_id: string | null
          repo_id: string
          stake_amount: number
          title: string
          trust_multiplier: number
          updated_at: string
          url: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          difficulty: string
          github_issue_id: number
          github_issue_number: number
          id?: string
          is_open?: boolean
          org_id?: string | null
          repo_id: string
          stake_amount: number
          title: string
          trust_multiplier?: number
          updated_at?: string
          url: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          difficulty?: string
          github_issue_id?: number
          github_issue_number?: number
          id?: string
          is_open?: boolean
          org_id?: string | null
          repo_id?: string
          stake_amount?: number
          title?: string
          trust_multiplier?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_archives: {
        Row: {
          act_id: string
          archived_at: string
          entries: Json
          id: string
          org_id: string | null
          type: string
        }
        Insert: {
          act_id: string
          archived_at?: string
          entries?: Json
          id?: string
          org_id?: string | null
          type: string
        }
        Update: {
          act_id?: string
          archived_at?: string
          entries?: Json
          id?: string
          org_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_archives_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "acts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_archives_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          avatar_url: string | null
          created_at: string
          credibility_score: number
          display_name: string | null
          github_org_id: number
          id: string
          installation_id: string | null
          name: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credibility_score?: number
          display_name?: string | null
          github_org_id: number
          id?: string
          installation_id?: string | null
          name: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credibility_score?: number
          display_name?: string | null
          github_org_id?: number
          id?: string
          installation_id?: string | null
          name?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
        ]
      }
      pull_requests: {
        Row: {
          ai_summary: string | null
          closed_at: string | null
          created_at: string
          github_pr_id: number
          github_pr_number: number
          id: string
          issue_id: string
          last_review_status: string | null
          merged_at: string | null
          outcome: string | null
          repo_id: string
          status: string
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          closed_at?: string | null
          created_at?: string
          github_pr_id: number
          github_pr_number: number
          id?: string
          issue_id: string
          last_review_status?: string | null
          merged_at?: string | null
          outcome?: string | null
          repo_id: string
          status?: string
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          closed_at?: string | null
          created_at?: string
          github_pr_id?: number
          github_pr_number?: number
          id?: string
          issue_id?: string
          last_review_status?: string | null
          merged_at?: string | null
          outcome?: string | null
          repo_id?: string
          status?: string
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pull_requests_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pull_requests_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pull_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      repositories: {
        Row: {
          created_at: string
          full_name: string
          github_repo_id: number
          id: string
          installation_id: string
          is_private: boolean
          member_count: number
          name: string
          org_id: string | null
          star_count: number
          trust_multiplier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          github_repo_id: number
          id?: string
          installation_id: string
          is_private?: boolean
          member_count?: number
          name: string
          org_id?: string | null
          star_count?: number
          trust_multiplier?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          github_repo_id?: number
          id?: string
          installation_id?: string
          is_private?: boolean
          member_count?: number
          name?: string
          org_id?: string | null
          star_count?: number
          trust_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositories_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repositories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stakes: {
        Row: {
          amount: number
          created_at: string
          id: string
          issue_id: string
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          issue_id: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          issue_id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          org_id: string
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          org_id: string
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          org_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      treasuries: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_staking_disabled: boolean
          org_id: string
          total_credits: number
          total_debits: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_staking_disabled?: boolean
          org_id: string
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_staking_disabled?: boolean
          org_id?: string
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasuries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_act_id: string | null
          current_tier: string
          earned_coins: number
          email: string | null
          github_id: number
          github_username: string
          global_xp: number
          has_merged_pr_this_act: boolean
          id: string
          last_login_at: string | null
          locked_coins: number
          purchased_coins: number
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_act_id?: string | null
          current_tier?: string
          earned_coins?: number
          email?: string | null
          github_id: number
          github_username: string
          global_xp?: number
          has_merged_pr_this_act?: boolean
          id?: string
          last_login_at?: string | null
          locked_coins?: number
          purchased_coins?: number
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_act_id?: string | null
          current_tier?: string
          earned_coins?: number
          email?: string | null
          github_id?: number
          github_username?: string
          global_xp?: number
          has_merged_pr_this_act?: boolean
          id?: string
          last_login_at?: string | null
          locked_coins?: number
          purchased_coins?: number
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_current_act"
            columns: ["current_act_id"]
            isOneToOne: false
            referencedRelation: "acts"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_logs: {
        Row: {
          act_id: string
          created_at: string
          difficulty: string
          evaluation_score: number
          global_xp_after: number
          id: string
          issue_id: string
          org_id: string | null
          pr_id: string
          tier_after: string
          tier_before: string
          trust_multiplier: number
          user_id: string
          xp_awarded: number
          xp_cap: number
        }
        Insert: {
          act_id: string
          created_at?: string
          difficulty: string
          evaluation_score: number
          global_xp_after: number
          id?: string
          issue_id: string
          org_id?: string | null
          pr_id: string
          tier_after: string
          tier_before: string
          trust_multiplier: number
          user_id: string
          xp_awarded: number
          xp_cap: number
        }
        Update: {
          act_id?: string
          created_at?: string
          difficulty?: string
          evaluation_score?: number
          global_xp_after?: number
          id?: string
          issue_id?: string
          org_id?: string | null
          pr_id?: string
          tier_after?: string
          tier_before?: string
          trust_multiplier?: number
          user_id?: string
          xp_awarded?: number
          xp_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_logs_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "acts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "pull_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
