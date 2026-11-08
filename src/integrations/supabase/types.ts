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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inspections: {
        Row: {
          created_at: string
          fit_ok: boolean | null
          id: string
          inspection_date: string
          notes: string | null
          radio_ok: boolean | null
          shov_ok: boolean | null
          status: string
          user_id: string | null
          vehicle_id: string
          winter_ok: boolean | null
        }
        Insert: {
          created_at?: string
          fit_ok?: boolean | null
          id?: string
          inspection_date?: string
          notes?: string | null
          radio_ok?: boolean | null
          shov_ok?: boolean | null
          status: string
          user_id?: string | null
          vehicle_id: string
          winter_ok?: boolean | null
        }
        Update: {
          created_at?: string
          fit_ok?: boolean | null
          id?: string
          inspection_date?: string
          notes?: string | null
          radio_ok?: boolean | null
          shov_ok?: boolean | null
          status?: string
          user_id?: string | null
          vehicle_id?: string
          winter_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      telegram_credentials: {
        Row: {
          ciphertext: string
          key_version: number
          user_id: string
        }
        Insert: {
          ciphertext: string
          key_version?: number
          user_id: string
        }
        Update: {
          ciphertext?: string
          key_version?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "telegram_settings"
            referencedColumns: ["user_id"]
          },
        ]
      }
      telegram_reports: {
        Row: {
          changes_count: number
          claimed_at: string
          delivery_status: string
          id: string
          last_error: string | null
          period_end: string
          period_start: string
          send_attempts: number
          sent_at: string | null
          telegram_message_id: number | null
          tests_count: number
          user_id: string
          vehicles_count: number
        }
        Insert: {
          changes_count?: number
          claimed_at?: string
          delivery_status?: string
          id?: string
          last_error?: string | null
          period_end: string
          period_start: string
          send_attempts?: number
          sent_at?: string | null
          telegram_message_id?: number | null
          tests_count?: number
          user_id: string
          vehicles_count?: number
        }
        Update: {
          changes_count?: number
          claimed_at?: string
          delivery_status?: string
          id?: string
          last_error?: string | null
          period_end?: string
          period_start?: string
          send_attempts?: number
          sent_at?: string | null
          telegram_message_id?: number | null
          tests_count?: number
          user_id?: string
          vehicles_count?: number
        }
        Relationships: []
      }
      telegram_settings: {
        Row: {
          connection_verified: boolean
          created_at: string
          enabled: boolean
          enabled_at: string | null
          last_error: string | null
          last_success_at: string | null
          telegram_bot_id: number
          telegram_bot_username: string
          telegram_chat_id: string
          telegram_chat_title: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          connection_verified?: boolean
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          telegram_bot_id: number
          telegram_bot_username: string
          telegram_chat_id: string
          telegram_chat_title: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          connection_verified?: boolean
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          telegram_bot_id?: number
          telegram_bot_username?: string
          telegram_chat_id?: string
          telegram_chat_title?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      vehicle_audit_events: {
        Row: {
          actor_id: string | null
          after_values: Json | null
          before_values: Json | null
          changed_fields: string[]
          event_type: string
          id: string
          occurred_at: string
          owner_at_event: string | null
          vehicle_id: string
        }
        Insert: {
          actor_id?: string | null
          after_values?: Json | null
          before_values?: Json | null
          changed_fields: string[]
          event_type: string
          id?: string
          occurred_at?: string
          owner_at_event?: string | null
          vehicle_id: string
        }
        Update: {
          actor_id?: string | null
          after_values?: Json | null
          before_values?: Json | null
          changed_fields?: string[]
          event_type?: string
          id?: string
          occurred_at?: string
          owner_at_event?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_note_changes: {
        Row: {
          changed_at: string
          id: string
          new_notes: string | null
          old_notes: string | null
          user_id: string | null
          vehicle_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_notes?: string | null
          old_notes?: string | null
          user_id?: string | null
          vehicle_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_notes?: string | null
          old_notes?: string | null
          user_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_note_changes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          category: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string | null
          vehicle_number: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_number: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_telegram_report: {
        Args: { p_end: string; p_start: string; p_user_id: string }
        Returns: string
      }
      save_verified_telegram_config: {
        Args: {
          p_bot_id: number
          p_chat_id: string
          p_ciphertext: string
          p_title: string
          p_user_id: string
          p_username: string
        }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
