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
