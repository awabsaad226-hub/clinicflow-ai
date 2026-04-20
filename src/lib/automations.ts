import { supabase } from "@/integrations/supabase/client";
import type { Patient, Message, AiConfig } from "./db-types";

export type AutomationType =
  | "missed_appointment"
  | "post_treatment"
  | "reactivation"
  | "lead_qualification"
  | "booking_assistant";

export interface AutomationResult {
  message: string;
  intent: "booking" | "inquiry" | "emergency" | "casual";
  urgency: "low" | "medium" | "high";
  suggested_action: string;
  should_send: boolean;
  reasoning: string;
  error?: string;
}

/** Calls the ai-automation edge function. */
export async function runAutomation(input: {
  type: AutomationType;
  patient: Patient;
  history?: Message[];
  config: AiConfig;
  trigger_context?: string;
}): Promise<AutomationResult> {
  const { type, patient, history, config, trigger_context } = input;
  const { data, error } = await supabase.functions.invoke("ai-automation", {
    body: {
      automation_type: type,
      patient_context: {
        name: patient.name,
        status: patient.status,
        last_visit: patient.last_visit,
        treatment_type: patient.treatment_type,
        notes: patient.notes,
        tags: patient.tags,
      },
      conversation_history: (history ?? []).map((m) => ({
        sender: m.sender, body: m.body, created_at: m.created_at,
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
      trigger_context,
    },
  });
  if (error) {
    return { message: "", intent: "casual", urgency: "low", suggested_action: "", should_send: false, reasoning: "", error: error.message };
  }
  if ((data as any)?.error) {
    return { message: "", intent: "casual", urgency: "low", suggested_action: "", should_send: false, reasoning: "", error: (data as any).error };
  }
  return data as AutomationResult;
}

/** Persists the AI-generated outbound message + log entry. */
export async function persistAutomationRun(opts: {
  patient: Patient;
  type: AutomationType;
  result: AutomationResult;
  trigger: string;
  send: boolean;
}) {
  const { patient, type, result, trigger, send } = opts;
  if (send && result.message) {
    await supabase.from("messages").insert({
      patient_id: patient.id,
      sender: "ai" as const,
      body: result.message,
      intent: result.intent as any,
      urgency: result.urgency as any,
      suggested_action: result.suggested_action,
      tags: [type],
    });
  }
  await supabase.from("automations_log").insert({
    patient_id: patient.id,
    automation_type: type,
    trigger,
    ai_output: result as any,
    status: send ? "sent" : "drafted",
  });
}
