import { supabase } from "@/integrations/supabase/client";
import type { AiReplyResult, Message, AiConfig, Patient } from "./db-types";

/**
 * Thin abstraction over the AI engine.
 * Today: Supabase Edge Function `ai-reply` (Lovable AI Gateway).
 * Tomorrow: swap implementation here to point at any other backend
 * without touching the rest of the app. UI calls go through this module only.
 */
export async function callAiReply(input: {
  message: string;
  patient?: Patient | null;
  history?: Message[];
  config: AiConfig;
  business_context?: string;
}): Promise<AiReplyResult> {
  const { message, patient, history, config, business_context } = input;

  const { data, error } = await supabase.functions.invoke("ai-reply", {
    body: {
      message,
      patient_context: patient
        ? {
            name: patient.name,
            status: patient.status,
            last_visit: patient.last_visit,
            treatment_type: patient.treatment_type,
            notes: patient.notes,
            tags: patient.tags,
          }
        : null,
      conversation_history: (history ?? []).map((m) => ({
        sender: m.sender,
        body: m.body,
        created_at: m.created_at,
      })),
      ai_config: {
        clinic_name: config.clinic_name,
        services_offered: config.services_offered,
        pricing_details: config.pricing_details,
        tone: config.tone,
        personality: config.personality,
        custom_instructions: config.custom_instructions,
        emergency_rules: config.emergency_rules,
        booking_rules: config.booking_rules,
        disallowed_behaviors: config.disallowed_behaviors,
      },
      business_context,
    },
  });

  if (error) {
    return {
      reply: "",
      intent: "casual",
      urgency: "low",
      suggested_action: "",
      error: error.message ?? "Failed to reach AI service",
    };
  }
  if ((data as any)?.error) {
    return {
      reply: "",
      intent: "casual",
      urgency: "low",
      suggested_action: "",
      error: (data as any).error,
    };
  }
  return data as AiReplyResult;
}
