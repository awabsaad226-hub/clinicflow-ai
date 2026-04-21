// AI reply edge function for the dental clinic assistant.
// Wraps Lovable AI Gateway with structured tool-calling output.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

interface AiConfig {
  clinic_name?: string;
  services_offered?: string[];
  pricing_details?: string;
  tone?: string;
  personality?: string;
  custom_instructions?: string;
  emergency_rules?: string;
  booking_rules?: string;
  disallowed_behaviors?: string;
  clinic_hours?: string;
  calendly_url?: string;
}

interface PatientContext {
  name?: string;
  status?: string;
  last_visit?: string | null;
  treatment_type?: string | null;
  notes?: string | null;
  tags?: string[];
}

interface HistoryMsg {
  sender: "patient" | "ai" | "staff";
  body: string;
  created_at?: string;
}

interface RequestBody {
  message: string;
  patient_context?: PatientContext | null;
  conversation_history?: HistoryMsg[];
  ai_config?: AiConfig;
  business_context?: string;
}

function buildSystemPrompt(cfg: AiConfig, business_context?: string): string {
  const hours = cfg.clinic_hours
    ? `\nClinic availability (only propose times within these hours): ${cfg.clinic_hours}`
    : "";
  const calendly = cfg.calendly_url
    ? `\nCalendly booking link (share when proposing booking): ${cfg.calendly_url}`
    : "";
  return `You are an AI assistant for a dental clinic.

Clinic Name: ${cfg.clinic_name ?? "Our Dental Clinic"}
Services: ${(cfg.services_offered ?? []).join(", ") || "General dentistry"}
Pricing: ${cfg.pricing_details ?? "On request"}
Tone: ${cfg.tone ?? "friendly"}
Personality: ${cfg.personality ?? "Warm and professional"}${hours}${calendly}

Instructions:
${cfg.custom_instructions ?? ""}

Emergency Rules:
${cfg.emergency_rules ?? ""}

Booking Rules:
${cfg.booking_rules ?? ""}

Disallowed Behaviors:
${cfg.disallowed_behaviors ?? ""}

${business_context ? `Business Context:\n${business_context}\n` : ""}

Your goals:
- Help the patient
- Detect urgency
- Recommend relevant treatment
- Convert into appointment booking when appropriate
- Be natural and human-like
- Always reply in the same language as the patient's message`;
}

function buildContextMessage(patient?: PatientContext | null): string {
  if (!patient) return "Patient Context: (unknown caller)";
  return `Patient Context:
- Name: ${patient.name ?? "Unknown"}
- Status: ${patient.status ?? "n/a"}
- Last visit: ${patient.last_visit ?? "n/a"}
- Treatment type: ${patient.treatment_type ?? "n/a"}
- Tags: ${(patient.tags ?? []).join(", ") || "none"}
- Notes: ${patient.notes ?? "none"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.message || typeof body.message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(body.ai_config ?? {}, body.business_context);
    const contextMsg = buildContextMessage(body.patient_context);

    const history = (body.conversation_history ?? []).slice(-15).map((m) => ({
      role: m.sender === "patient" ? "user" : "assistant",
      content: m.body,
    }));

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: contextMsg },
      ...history,
      { role: "user", content: body.message },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "send_reply",
          description: "Reply to the patient and classify the message.",
          parameters: {
            type: "object",
            properties: {
              reply: { type: "string", description: "Message to send to the patient." },
              intent: { type: "string", enum: ["booking", "inquiry", "emergency", "casual"] },
              urgency: { type: "string", enum: ["low", "medium", "high"] },
              suggested_action: {
                type: "string",
                description: "Short next step the clinic should take.",
              },
            },
            required: ["reply", "intent", "urgency", "suggested_action"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "send_reply" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Lovable AI credits exhausted. Add funds in Settings → Workspace → Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let parsed = {
      reply: "",
      intent: "casual",
      urgency: "low",
      suggested_action: "",
    };

    if (toolCall?.function?.arguments) {
      try {
        parsed = { ...parsed, ...JSON.parse(toolCall.function.arguments) };
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    } else {
      // Fallback: model returned plain text
      parsed.reply = data.choices?.[0]?.message?.content ?? "";
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-reply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
