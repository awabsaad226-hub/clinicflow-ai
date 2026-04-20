import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Patient = Tables<"patients">;
export type PatientInsert = TablesInsert<"patients">;
export type PatientUpdate = TablesUpdate<"patients">;

export type Appointment = Tables<"appointments">;
export type AppointmentInsert = TablesInsert<"appointments">;

export type Message = Tables<"messages">;
export type MessageInsert = TablesInsert<"messages">;

export type AiConfig = Tables<"ai_config">;
export type AiConfigUpdate = TablesUpdate<"ai_config">;

export type AutomationLog = Tables<"automations_log">;

export const PATIENT_STATUSES = [
  { value: "new_lead", label: "New Lead" },
  { value: "booked", label: "Booked" },
  { value: "treated", label: "Treated" },
  { value: "follow_up", label: "Follow-up" },
  { value: "inactive", label: "Inactive" },
] as const;

export const APPOINTMENT_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type AiReplyResult = {
  reply: string;
  intent: "booking" | "inquiry" | "emergency" | "casual";
  urgency: "low" | "medium" | "high";
  suggested_action: string;
  error?: string;
};
