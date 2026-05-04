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
      adherence_streaks: {
        Row: {
          created_at:           string | null
          current_streak:       number
          id:                   string
          last_completed_date:  string | null
          longest_streak:       number
          member_id:            string
          protocol_id:          string
          total_days_completed: number
          updated_at:           string | null
        }
        Insert: {
          created_at?:           string | null
          current_streak?:       number
          id?:                   string
          last_completed_date?:  string | null
          longest_streak?:       number
          member_id:             string
          protocol_id:           string
          total_days_completed?: number
          updated_at?:           string | null
        }
        Update: {
          created_at?:           string | null
          current_streak?:       number
          id?:                   string
          last_completed_date?:  string | null
          longest_streak?:       number
          member_id?:            string
          protocol_id?:          string
          total_days_completed?: number
          updated_at?:           string | null
        }
        Relationships: [
          {
            foreignKeyName: "adherence_streaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_streaks_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "member_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          id: string
          member_id: string
          summary_type: string
          content: string
          content_short: string | null
          source_intake_id: string | null
          model_used: string | null
          confidence: string | null
          is_current: boolean | null
          member_rating: number | null
          generated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          member_id: string
          summary_type: string
          content: string
          content_short?: string | null
          source_intake_id?: string | null
          model_used?: string | null
          confidence?: string | null
          is_current?: boolean | null
          member_rating?: number | null
          generated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          summary_type?: string
          content?: string
          content_short?: string | null
          source_intake_id?: string | null
          model_used?: string | null
          confidence?: string | null
          is_current?: boolean | null
          member_rating?: number | null
          generated_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarker_results: {
        Row: {
          created_at: string | null
          functional_zone: number | null
          gp_interpretation: string | null
          gp_range_high: number | null
          gp_range_low: number | null
          id: string
          marker_key: string | null
          marker_name: string
          member_id: string
          ni_interpretation: string | null
          ni_optimal_high: number | null
          ni_optimal_low: number | null
          ni_range_high: number | null
          ni_range_low: number | null
          raw_value: string | null
          report_id: string
          unit: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          functional_zone?: number | null
          gp_interpretation?: string | null
          gp_range_high?: number | null
          gp_range_low?: number | null
          id?: string
          marker_key?: string | null
          marker_name: string
          member_id: string
          ni_interpretation?: string | null
          ni_optimal_high?: number | null
          ni_optimal_low?: number | null
          ni_range_high?: number | null
          ni_range_low?: number | null
          raw_value?: string | null
          report_id: string
          unit?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          functional_zone?: number | null
          gp_interpretation?: string | null
          gp_range_high?: number | null
          gp_range_low?: number | null
          id?: string
          marker_key?: string | null
          marker_name?: string
          member_id?: string
          ni_interpretation?: string | null
          ni_optimal_high?: number | null
          ni_optimal_low?: number | null
          ni_range_high?: number | null
          ni_range_low?: number | null
          raw_value?: string | null
          report_id?: string
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_results_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomarker_results_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarker_trajectory: {
        Row: {
          created_at:      string | null
          functional_zone: number | null
          id:              string
          marker_key:      string
          marker_name:     string
          member_id:       string
          report_date:     string | null
          report_id:       string | null
          unit:            string | null
          value:           number | null
        }
        Insert: {
          created_at?:      string | null
          functional_zone?: number | null
          id?:              string
          marker_key:       string
          marker_name:      string
          member_id:        string
          report_date?:     string | null
          report_id?:       string | null
          unit?:            string | null
          value?:           number | null
        }
        Update: {
          created_at?:      string | null
          functional_zone?: number | null
          id?:              string
          marker_key?:      string
          marker_name?:     string
          member_id?:       string
          report_date?:     string | null
          report_id?:       string | null
          unit?:            string | null
          value?:           number | null
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_trajectory_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          consented: boolean
          consented_at: string | null
          created_at: string | null
          email: string | null
          id: string
          ip_address: string | null
          profile_id: string | null
        }
        Insert: {
          consent_type: string
          consented?: boolean
          consented_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          profile_id?: string | null
        }
        Update: {
          consent_type?: string
          consented?: boolean
          consented_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          profile_id: string
        }
        Insert: {
          conversation_id: string
          profile_id: string
        }
        Update: {
          conversation_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      daily_adherence: {
        Row: {
          completed:    boolean
          completed_at: string | null
          created_at:   string | null
          id:           string
          item_id:      string
          item_name:    string
          log_date:     string
          member_id:    string
          protocol_id:  string
          skip_reason:  string | null
          skipped:      boolean
        }
        Insert: {
          completed?:    boolean
          completed_at?: string | null
          created_at?:   string | null
          id?:           string
          item_id:       string
          item_name:     string
          log_date:      string
          member_id:     string
          protocol_id:   string
          skip_reason?:  string | null
          skipped?:      boolean
        }
        Update: {
          completed?:    boolean
          completed_at?: string | null
          created_at?:   string | null
          id?:           string
          item_id?:      string
          item_name?:    string
          log_date?:     string
          member_id?:    string
          protocol_id?:  string
          skip_reason?:  string | null
          skipped?:      boolean
        }
        Relationships: [
          {
            foreignKeyName: "daily_adherence_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "protocol_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_adherence_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_adherence_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "member_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          attended: boolean | null
          event_id: string
          id: string
          member_id: string
          registered_at: string | null
        }
        Insert: {
          attended?: boolean | null
          event_id: string
          id?: string
          member_id: string
          registered_at?: string | null
        }
        Update: {
          attended?: boolean | null
          event_id?: string
          id?: string
          member_id?: string
          registered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          ends_at: string
          event_type: string
          hosted_by: string | null
          id: string
          is_online: boolean | null
          location: string | null
          max_capacity: number | null
          meeting_url: string | null
          practitioner_id: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ends_at: string
          event_type?: string
          hosted_by?: string | null
          id?: string
          is_online?: boolean | null
          location?: string | null
          max_capacity?: number | null
          meeting_url?: string | null
          practitioner_id?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ends_at?: string
          event_type?: string
          hosted_by?: string | null
          id?: string
          is_online?: boolean | null
          location?: string | null
          max_capacity?: number | null
          meeting_url?: string | null
          practitioner_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_hosted_by_fkey"
            columns: ["hosted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      functional_ranges: {
        Row: {
          created_at: string | null
          gp_range_high: number | null
          gp_range_low: number | null
          id: string
          marker_key: string
          marker_name: string
          ni_optimal_high: number | null
          ni_optimal_low: number | null
          ni_range_high: number | null
          ni_range_low: number | null
          notes: string | null
          unit: string | null
          updated_at: string | null
          zone_1_max: number | null
          zone_2_max: number | null
          zone_3_max: number | null
          zone_4_max: number | null
          zone_4_min: number | null
          zone_5_max: number | null
        }
        Insert: {
          created_at?: string | null
          gp_range_high?: number | null
          gp_range_low?: number | null
          id?: string
          marker_key: string
          marker_name: string
          ni_optimal_high?: number | null
          ni_optimal_low?: number | null
          ni_range_high?: number | null
          ni_range_low?: number | null
          notes?: string | null
          unit?: string | null
          updated_at?: string | null
          zone_1_max?: number | null
          zone_2_max?: number | null
          zone_3_max?: number | null
          zone_4_max?: number | null
          zone_4_min?: number | null
          zone_5_max?: number | null
        }
        Update: {
          created_at?: string | null
          gp_range_high?: number | null
          gp_range_low?: number | null
          id?: string
          marker_key?: string
          marker_name?: string
          ni_optimal_high?: number | null
          ni_optimal_low?: number | null
          ni_range_high?: number | null
          ni_range_low?: number | null
          notes?: string | null
          unit?: string | null
          updated_at?: string | null
          zone_1_max?: number | null
          zone_2_max?: number | null
          zone_3_max?: number | null
          zone_4_max?: number | null
          zone_4_min?: number | null
          zone_5_max?: number | null
        }
        Relationships: []
      }
      intake_responses: {
        Row: {
          id: string
          member_id: string
          completed_sections: number | null
          is_complete: boolean | null
          chief_complaints: string[] | null
          complaint_duration: string | null
          complaint_severity: number | null
          existing_conditions: string[] | null
          current_medications: string | null
          current_supplements: string | null
          previous_practitioners: string[] | null
          previous_treatments: string | null
          diet_type: string | null
          exercise_frequency: string | null
          sleep_hours: number | null
          stress_level: number | null
          alcohol_frequency: string | null
          smoking_status: string | null
          energy_level: number | null
          mood_level: number | null
          digestion_level: number | null
          cognitive_level: number | null
          family_history: string | null
          health_goals: string[] | null
          additional_notes: string | null
          consent_to_ai_analysis: boolean | null
          consent_given_at: string | null
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          member_id: string
          completed_sections?: number | null
          is_complete?: boolean | null
          chief_complaints?: string[] | null
          complaint_duration?: string | null
          complaint_severity?: number | null
          existing_conditions?: string[] | null
          current_medications?: string | null
          current_supplements?: string | null
          previous_practitioners?: string[] | null
          previous_treatments?: string | null
          diet_type?: string | null
          exercise_frequency?: string | null
          sleep_hours?: number | null
          stress_level?: number | null
          alcohol_frequency?: string | null
          smoking_status?: string | null
          energy_level?: number | null
          mood_level?: number | null
          digestion_level?: number | null
          cognitive_level?: number | null
          family_history?: string | null
          health_goals?: string[] | null
          additional_notes?: string | null
          consent_to_ai_analysis?: boolean | null
          consent_given_at?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          completed_sections?: number | null
          is_complete?: boolean | null
          chief_complaints?: string[] | null
          complaint_duration?: string | null
          complaint_severity?: number | null
          existing_conditions?: string[] | null
          current_medications?: string | null
          current_supplements?: string | null
          previous_practitioners?: string[] | null
          previous_treatments?: string | null
          diet_type?: string | null
          exercise_frequency?: string | null
          sleep_hours?: number | null
          stress_level?: number | null
          alcohol_frequency?: string | null
          smoking_status?: string | null
          energy_level?: number | null
          mood_level?: number | null
          digestion_level?: number | null
          cognitive_level?: number | null
          family_history?: string | null
          health_goals?: string[] | null
          additional_notes?: string | null
          consent_to_ai_analysis?: boolean | null
          consent_given_at?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reports: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          lab_name: string | null
          member_id: string
          parse_error: string | null
          parsed_at: string | null
          report_date: string | null
          updated_at: string | null
          upload_status: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          lab_name?: string | null
          member_id: string
          parse_error?: string | null
          parsed_at?: string | null
          report_date?: string | null
          updated_at?: string | null
          upload_status?: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          lab_name?: string | null
          member_id?: string
          parse_error?: string | null
          parsed_at?: string | null
          report_date?: string | null
          updated_at?: string | null
          upload_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lifetracker_checkins: {
        Row: {
          checkin_date:     string
          created_at:       string | null
          digestion_rating: number | null
          energy_rating:    number | null
          id:               string
          member_id:        string
          mood_rating:      number | null
          notes:            string | null
          overall_rating:   number | null
          sleep_rating:     number | null
        }
        Insert: {
          checkin_date:      string
          created_at?:       string | null
          digestion_rating?: number | null
          energy_rating?:    number | null
          id?:               string
          member_id:         string
          mood_rating?:      number | null
          notes?:            string | null
          overall_rating?:   number | null
          sleep_rating?:     number | null
        }
        Update: {
          checkin_date?:     string
          created_at?:       string | null
          digestion_rating?: number | null
          energy_rating?:    number | null
          id?:               string
          member_id?:        string
          mood_rating?:      number | null
          notes?:            string | null
          overall_rating?:   number | null
          sleep_rating?:     number | null
        }
        Relationships: [
          {
            foreignKeyName: "lifetracker_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lifetracker_goals: {
        Row: {
          baseline_value: number | null
          category:       string | null
          created_at:     string | null
          current_value:  number | null
          description:    string | null
          id:             string
          member_id:      string
          status:         string
          target_date:    string | null
          target_unit:    string | null
          target_value:   number | null
          title:          string
          updated_at:     string | null
        }
        Insert: {
          baseline_value?: number | null
          category?:       string | null
          created_at?:     string | null
          current_value?:  number | null
          description?:    string | null
          id?:             string
          member_id:       string
          status?:         string
          target_date?:    string | null
          target_unit?:    string | null
          target_value?:   number | null
          title:           string
          updated_at?:     string | null
        }
        Update: {
          baseline_value?: number | null
          category?:       string | null
          created_at?:     string | null
          current_value?:  number | null
          description?:    string | null
          id?:             string
          member_id?:      string
          status?:         string
          target_date?:    string | null
          target_unit?:    string | null
          target_value?:   number | null
          title?:          string
          updated_at?:     string | null
        }
        Relationships: [
          {
            foreignKeyName: "lifetracker_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_symptom_logs: {
        Row: {
          duration: string | null
          id: string
          logged_at: string | null
          member_id: string
          notes: string | null
          session_id: string | null
          severity: number | null
          symptom_id: string
        }
        Insert: {
          duration?: string | null
          id?: string
          logged_at?: string | null
          member_id: string
          notes?: string | null
          session_id?: string | null
          severity?: number | null
          symptom_id: string
        }
        Update: {
          duration?: string | null
          id?: string
          logged_at?: string | null
          member_id?: string
          notes?: string | null
          session_id?: string | null
          severity?: number | null
          symptom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_symptom_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_symptom_logs_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      member_protocols: {
        Row: {
          created_at:  string | null
          id:          string
          member_id:   string
          name:        string
          paused_at:   string | null
          started_at:  string
          status:      string
          template_id: string
        }
        Insert: {
          created_at?:  string | null
          id?:          string
          member_id:    string
          name:         string
          paused_at?:   string | null
          started_at:   string
          status?:      string
          template_id:  string
        }
        Update: {
          created_at?:  string | null
          id?:          string
          member_id?:   string
          name?:        string
          paused_at?:   string | null
          started_at?:  string
          status?:      string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_protocols_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_protocols_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string | null
          filtered_reason: string | null
          id: string
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string | null
          filtered_reason?: string | null
          id?: string
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string | null
          filtered_reason?: string | null
          id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          image_urls: string[] | null
          like_count: number
          post_type: string
          published_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          like_count?: number
          post_type?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          like_count?: number
          post_type?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_items: {
        Row: {
          created_at:     string | null
          dose:           string | null
          duration_weeks: number | null
          id:             string
          item_type:      string
          name:           string
          notes:          string | null
          sort_order:     number
          template_id:    string
          timing:         string | null
        }
        Insert: {
          created_at?:     string | null
          dose?:           string | null
          duration_weeks?: number | null
          id?:             string
          item_type?:      string
          name:            string
          notes?:          string | null
          sort_order?:     number
          template_id:     string
          timing?:         string | null
        }
        Update: {
          created_at?:     string | null
          dose?:           string | null
          duration_weeks?: number | null
          id?:             string
          item_type?:      string
          name?:           string
          notes?:          string | null
          sort_order?:     number
          template_id?:    string
          timing?:         string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocol_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_templates: {
        Row: {
          created_at:     string | null
          description:    string | null
          duration_weeks: number
          id:             string
          name:           string
          root_cause_id:  string | null
          root_cause_key: string | null
          status:         string
        }
        Insert: {
          created_at?:     string | null
          description?:    string | null
          duration_weeks?: number
          id?:             string
          name:            string
          root_cause_id?:  string | null
          root_cause_key?: string | null
          status?:         string
        }
        Update: {
          created_at?:     string | null
          description?:    string | null
          duration_weeks?: number
          id?:             string
          name?:           string
          root_cause_id?:  string | null
          root_cause_key?: string | null
          status?:         string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_templates_root_cause_id_fkey"
            columns: ["root_cause_id"]
            isOneToOne: false
            referencedRelation: "root_causes"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_applications: {
        Row: {
          accepts_referrals: boolean
          area_tags: string[] | null
          bio: string | null
          city: string | null
          client_types: string[] | null
          collaboration_types: string[] | null
          consent_text: string | null
          consent_version: string
          country: string | null
          created_at: string | null
          credentials: string | null
          currently_seeing_clients: boolean | null
          delivery_mode: string | null
          email: string
          experience_range: string | null
          full_name: string
          id: string
          is_test_data: boolean
          linkedin_url: string | null
          modalities: string | null
          motivation: string | null
          open_to_collaboration: boolean
          phone: string | null
          primary_professions: string[] | null
          profile_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          specialties: string[] | null
          status: string
          submitted_at: string | null
          updated_at: string | null
          website_url: string | null
          years_experience: number | null
        }
        Insert: {
          accepts_referrals?: boolean
          area_tags?: string[] | null
          bio?: string | null
          city?: string | null
          client_types?: string[] | null
          collaboration_types?: string[] | null
          consent_text?: string | null
          consent_version?: string
          country?: string | null
          created_at?: string | null
          credentials?: string | null
          currently_seeing_clients?: boolean | null
          delivery_mode?: string | null
          email: string
          experience_range?: string | null
          full_name: string
          id?: string
          is_test_data?: boolean
          linkedin_url?: string | null
          modalities?: string | null
          motivation?: string | null
          open_to_collaboration?: boolean
          phone?: string | null
          primary_professions?: string[] | null
          profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          specialties?: string[] | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          years_experience?: number | null
        }
        Update: {
          accepts_referrals?: boolean
          area_tags?: string[] | null
          bio?: string | null
          city?: string | null
          client_types?: string[] | null
          collaboration_types?: string[] | null
          consent_text?: string | null
          consent_version?: string
          country?: string | null
          created_at?: string | null
          credentials?: string | null
          currently_seeing_clients?: boolean | null
          delivery_mode?: string | null
          email?: string
          experience_range?: string | null
          full_name?: string
          id?: string
          is_test_data?: boolean
          linkedin_url?: string | null
          modalities?: string | null
          motivation?: string | null
          open_to_collaboration?: boolean
          phone?: string | null
          primary_professions?: string[] | null
          profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          specialties?: string[] | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioners: {
        Row: {
          accepted_at: string | null
          accepts_referrals: boolean
          activated_at: string | null
          area_tags: string[] | null
          bio: string | null
          city: string | null
          client_types: string[] | null
          collaboration_types: string[] | null
          country: string | null
          created_at: string | null
          credentials: string[] | null
          currently_seeing_clients: boolean | null
          delivery_mode: string | null
          display_order: number
          experience_range: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          is_directory_ready: boolean
          is_test_data: boolean
          lifecycle_status: string
          linkedin_url: string | null
          location: string | null
          modalities: string | null
          open_to_collaboration: boolean
          other_social_urls: string | null
          paused_at: string | null
          paused_reason: string | null
          practice_name: string | null
          practitioner_tier: string
          primary_professions: string[] | null
          profile_completeness_pct: number
          profile_id: string
          referral_contact_method: string | null
          support_needs: string | null
          tagline: string | null
          trust_level: Database["public"]["Enums"]["trust_level"]
          updated_at: string | null
          vetted_by: string | null
          website_url: string | null
          years_experience: number | null
        }
        Insert: {
          accepted_at?: string | null
          accepts_referrals?: boolean
          activated_at?: string | null
          area_tags?: string[] | null
          bio?: string | null
          city?: string | null
          client_types?: string[] | null
          collaboration_types?: string[] | null
          country?: string | null
          created_at?: string | null
          credentials?: string[] | null
          currently_seeing_clients?: boolean | null
          delivery_mode?: string | null
          display_order?: number
          experience_range?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_directory_ready?: boolean
          is_test_data?: boolean
          lifecycle_status?: string
          linkedin_url?: string | null
          location?: string | null
          modalities?: string | null
          open_to_collaboration?: boolean
          other_social_urls?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          practice_name?: string | null
          practitioner_tier?: string
          primary_professions?: string[] | null
          profile_completeness_pct?: number
          profile_id: string
          referral_contact_method?: string | null
          support_needs?: string | null
          tagline?: string | null
          trust_level?: Database["public"]["Enums"]["trust_level"]
          updated_at?: string | null
          vetted_by?: string | null
          website_url?: string | null
          years_experience?: number | null
        }
        Update: {
          accepted_at?: string | null
          accepts_referrals?: boolean
          activated_at?: string | null
          area_tags?: string[] | null
          bio?: string | null
          city?: string | null
          client_types?: string[] | null
          collaboration_types?: string[] | null
          country?: string | null
          created_at?: string | null
          credentials?: string[] | null
          currently_seeing_clients?: boolean | null
          delivery_mode?: string | null
          display_order?: number
          experience_range?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_directory_ready?: boolean
          is_test_data?: boolean
          lifecycle_status?: string
          linkedin_url?: string | null
          location?: string | null
          modalities?: string | null
          open_to_collaboration?: boolean
          other_social_urls?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          practice_name?: string | null
          practitioner_tier?: string
          primary_professions?: string[] | null
          profile_completeness_pct?: number
          profile_id?: string
          referral_contact_method?: string | null
          support_needs?: string | null
          tagline?: string | null
          trust_level?: Database["public"]["Enums"]["trust_level"]
          updated_at?: string | null
          vetted_by?: string | null
          website_url?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioners_vetted_by_fkey"
            columns: ["vetted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          heard_about: string | null
          id: string
          is_test_data: boolean
          onboarding_completed_at: string | null
          onboarding_intent: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          heard_about?: string | null
          id: string
          is_test_data?: boolean
          onboarding_completed_at?: string | null
          onboarding_intent?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          heard_about?: string | null
          id?: string
          is_test_data?: boolean
          onboarding_completed_at?: string | null
          onboarding_intent?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string | null
          description: string | null
          id: string
          published_at: string | null
          resource_type: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          topic_tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          resource_type?: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          topic_tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          resource_type?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          topic_tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      root_causes: {
        Row: {
          colour: string | null
          created_at: string | null
          description: string | null
          id: string
          key: string
          name: string
          sphere_position_phi: number | null
          sphere_position_theta: number | null
        }
        Insert: {
          colour?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
          sphere_position_phi?: number | null
          sphere_position_theta?: number | null
        }
        Update: {
          colour?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
          sphere_position_phi?: number | null
          sphere_position_theta?: number | null
        }
        Relationships: []
      }
      rootfinder_results: {
        Row: {
          confidence_score: number
          created_at: string | null
          id: string
          member_id: string
          rank: number
          root_cause_id: string
          session_id: string
          symptom_count: number
          weighted_score: number
        }
        Insert: {
          confidence_score: number
          created_at?: string | null
          id?: string
          member_id: string
          rank: number
          root_cause_id: string
          session_id: string
          symptom_count: number
          weighted_score: number
        }
        Update: {
          confidence_score?: number
          created_at?: string | null
          id?: string
          member_id?: string
          rank?: number
          root_cause_id?: string
          session_id?: string
          symptom_count?: number
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "rootfinder_results_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rootfinder_results_root_cause_id_fkey"
            columns: ["root_cause_id"]
            isOneToOne: false
            referencedRelation: "root_causes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          care_plan_id: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          care_plan_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          care_plan_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          description: string
          email: string
          full_name: string
          id: string
          is_test_data: boolean
          member_id: string | null
          phone: string | null
          request_type: string
          status: string
          submitted_at: string | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          description: string
          email: string
          full_name: string
          id?: string
          is_test_data?: boolean
          member_id?: string | null
          phone?: string | null
          request_type?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          description?: string
          email?: string
          full_name?: string
          id?: string
          is_test_data?: boolean
          member_id?: string | null
          phone?: string | null
          request_type?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_root_mappings: {
        Row: {
          id: string
          root_cause_id: string
          symptom_id: string
          weight: number
        }
        Insert: {
          id?: string
          root_cause_id: string
          symptom_id: string
          weight?: number
        }
        Update: {
          id?: string
          root_cause_id?: string
          symptom_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "symptom_root_mappings_root_cause_id_fkey"
            columns: ["root_cause_id"]
            isOneToOne: false
            referencedRelation: "root_causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_root_mappings_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      symptoms: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      vitality_scores: {
        Row: {
          adherence_pct:   number | null
          biomarker_score: number | null
          cognitive_score: number | null
          created_at:      string | null
          emotional_score: number | null
          hormonal_score:  number | null
          id:              string
          member_id:       string
          notes:           string | null
          overall_score:   number | null
          physical_score:  number | null
          score_date:      string
        }
        Insert: {
          adherence_pct?:   number | null
          biomarker_score?: number | null
          cognitive_score?: number | null
          created_at?:      string | null
          emotional_score?: number | null
          hormonal_score?:  number | null
          id?:              string
          member_id:        string
          notes?:           string | null
          overall_score?:   number | null
          physical_score?:  number | null
          score_date:       string
        }
        Update: {
          adherence_pct?:   number | null
          biomarker_score?: number | null
          cognitive_score?: number | null
          created_at?:      string | null
          emotional_score?: number | null
          hormonal_score?:  number | null
          id?:              string
          member_id?:       string
          notes?:           string | null
          overall_score?:   number | null
          physical_score?:  number | null
          score_date?:      string
        }
        Relationships: [
          {
            foreignKeyName: "vitality_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      member_support_requests: {
        Row: {
          description: string | null
          id: string | null
          member_id: string | null
          request_type: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          member_id?: string | null
          request_type?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          member_id?: string | null
          request_type?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_profile_completeness: {
        Args: { p: Database["public"]["Tables"]["practitioners"]["Row"] }
        Returns: number
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_practitioner: { Args: never; Returns: boolean }
    }
    Enums: {
      content_status: "draft" | "published" | "archived"
      intake_status: "pending" | "reviewing" | "assigned" | "active" | "closed"
      message_status: "sent" | "delivered" | "read" | "filtered"
      subscription_status: "inactive" | "active" | "cancelled" | "past_due"
      trust_level: "vetted" | "unvetted"
      user_role: "user" | "practitioner" | "admin" | "member"
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
    Enums: {
      content_status: ["draft", "published", "archived"],
      intake_status: ["pending", "reviewing", "assigned", "active", "closed"],
      message_status: ["sent", "delivered", "read", "filtered"],
      subscription_status: ["inactive", "active", "cancelled", "past_due"],
      trust_level: ["vetted", "unvetted"],
      user_role: ["user", "practitioner", "admin", "member"],
    },
  },
} as const
