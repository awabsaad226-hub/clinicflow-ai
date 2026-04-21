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
      ai_config: {
        Row: {
          booking_rules: string
          calendly_url: string
          clinic_hours: string
          clinic_name: string
          created_at: string
          custom_instructions: string
          disallowed_behaviors: string
          emergency_rules: string
          id: string
          personality: string
          pricing_details: string
          services_offered: string[]
          tone: string
          updated_at: string
        }
        Insert: {
          booking_rules?: string
          calendly_url?: string
          clinic_hours?: string
          clinic_name?: string
          created_at?: string
          custom_instructions?: string
          disallowed_behaviors?: string
          emergency_rules?: string
          id?: string
          personality?: string
          pricing_details?: string
          services_offered?: string[]
          tone?: string
          updated_at?: string
        }
        Update: {
          booking_rules?: string
          calendly_url?: string
          clinic_hours?: string
          clinic_name?: string
          created_at?: string
          custom_instructions?: string
          disallowed_behaviors?: string
          emergency_rules?: string
          id?: string
          personality?: string
          pricing_details?: string
          services_offered?: string[]
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          patient_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          treatment_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          patient_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      automations_log: {
        Row: {
          ai_output: Json | null
          automation_type: string
          created_at: string
          id: string
          patient_id: string | null
          status: string
          trigger: string | null
        }
        Insert: {
          ai_output?: Json | null
          automation_type: string
          created_at?: string
          id?: string
          patient_id?: string | null
          status?: string
          trigger?: string | null
        }
        Update: {
          ai_output?: Json | null
          automation_type?: string
          created_at?: string
          id?: string
          patient_id?: string | null
          status?: string
          trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      external_messages: {
        Row: {
          body: string
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          patient_id: string | null
          read: boolean
          received_at: string
          source: string
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          patient_id?: string | null
          read?: boolean
          received_at?: string
          source: string
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          patient_id?: string | null
          read?: boolean
          received_at?: string
          source?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          connected_at: string | null
          created_at: string
          id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          human_takeover: boolean
          id: string
          intent: Database["public"]["Enums"]["ai_intent"] | null
          patient_id: string
          sender: Database["public"]["Enums"]["message_sender"]
          suggested_action: string | null
          tags: string[]
          urgency: Database["public"]["Enums"]["ai_urgency"] | null
        }
        Insert: {
          body: string
          created_at?: string
          human_takeover?: boolean
          id?: string
          intent?: Database["public"]["Enums"]["ai_intent"] | null
          patient_id: string
          sender: Database["public"]["Enums"]["message_sender"]
          suggested_action?: string | null
          tags?: string[]
          urgency?: Database["public"]["Enums"]["ai_urgency"] | null
        }
        Update: {
          body?: string
          created_at?: string
          human_takeover?: boolean
          id?: string
          intent?: Database["public"]["Enums"]["ai_intent"] | null
          patient_id?: string
          sender?: Database["public"]["Enums"]["message_sender"]
          suggested_action?: string | null
          tags?: string[]
          urgency?: Database["public"]["Enums"]["ai_urgency"] | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_visit: string | null
          name: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["patient_status"]
          tags: string[]
          treatment_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_visit?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          treatment_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_visit?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          treatment_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_intent: "booking" | "inquiry" | "emergency" | "casual"
      ai_urgency: "low" | "medium" | "high"
      appointment_status: "scheduled" | "completed" | "missed" | "cancelled"
      message_sender: "patient" | "ai" | "staff"
      patient_status:
        | "new_lead"
        | "booked"
        | "treated"
        | "follow_up"
        | "inactive"
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
      ai_intent: ["booking", "inquiry", "emergency", "casual"],
      ai_urgency: ["low", "medium", "high"],
      appointment_status: ["scheduled", "completed", "missed", "cancelled"],
      message_sender: ["patient", "ai", "staff"],
      patient_status: [
        "new_lead",
        "booked",
        "treated",
        "follow_up",
        "inactive",
      ],
    },
  },
} as const
