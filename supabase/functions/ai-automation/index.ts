// Edge function: AI-driven automations.
// Generates personalized re-engagement / follow-up / reactivation messages
// for a given patient, using their history and the clinic's AI config.
// All decisions are made by the AI — no keyword logic.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type AutomationType =
  | "missed_appointment"
  | "post_treatment"
  | "reactivation"
  | "lead_qualification"
  | "booking_assistant";

interface RequestBody {
  automation_type: AutomationType;
  patient_context: Record<string, unknown> | null;
  conversation_history: { sender: string; body: string; created_at?: string }[];
  ai_config: Record<string, unknown>;
  trigger_context?: string; // e.g. "Missed appointment 2025-04-19 at 14:00"
}

const AUTOMATION_GOALS: Record<AutomationType, string> = {
  missed_appointment:
    "The patient missed their recent appointment. Write a warm, non-judgmental message that acknowledges life happens, asks if they'd like to reschedule, and proposes 1-2 specific time options.",
  post_treatment:
    "The patient recently completed a treatment. Check in on how they're feeling, give 1-2 brief aftercare tips relevant to their treatment, and suggest a routine cleaning if appropriate.",
  reactivation:
    "The patient has been inactive for a long time. Send a personalized, friendly re-engagement message — remind them gently of the value of regular checkups and offer a clear next step (book a checkup).",
  lead_qualification:
    "This is a new lead. Greet them warmly, ask 1-2 short qualifying questions about what they're looking for, and offer to book a free consultation.",
  booking_assistant:
    "Help the patient finalize a booking. Confirm their preferred treatment, propose 2 concrete time slots in the next 5 days, and ask which works best.",
};

function buildSystemPrompt(cfg: Record<string, any>): string {
  const calendly = cfg.calendly_url
    ? `\nCalendly booking link (include in messages when proposing booking): ${cfg.calendly_url}`
    : "";
  const hours = cfg.clinic_hours
    ? `\nClinic availability (use these hours when proposing time slots — never propose times outside these): ${cfg.clinic_hours}`
    : "";
  return `You are an AI assistant for a dental clinic.

Clinic Name: ${cfg.clinic_name ?? "Our Dental Clinic"}
Services: ${(cfg.services_offered ?? []).join?.(", ") || "General dentistry"}
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

You are now generating an outbound automation message (the patient did not just message you).
Be human, concise (under 70 words), and avoid sounding like a template. Reply in the same language as recent patient messages if any.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.automation_type || !AUTOMATION_GOALS[body.automation_type]) {
      return new Response(JSON.stringify({ error: "invalid automation_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(body.ai_config ?? {});
    const goal = AUTOMATION_GOALS[body.automation_type];

    const history = (body.conversation_history ?? []).slice(-10).map((m) => ({
      role: m.sender === "patient" ? "user" : "assistant",
      content: m.body,
    }));

    const userMsg = `Automation goal:
${goal}

Trigger context:
${body.trigger_context ?? "(none)"}

Patient context:
${JSON.stringify(body.patient_context ?? {}, null, 2)}

Recent conversation history is provided for tone matching.

Compose the outbound message now.`;

    const tools = [{
      type: "function",
      function: {
        name: "send_automation_message",
        description: "Send an outbound automation message and classify it.",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "The message to send to the patient." },
            intent: { type: "string", enum: ["booking", "inquiry", "emergency", "casual"] },
            urgency: { type: "string", enum: ["low", "medium", "high"] },
            suggested_action: { type: "string" },
            should_send: {
              type: "boolean",
              description: "Whether sending this is appropriate now (false if patient was just contacted or context indicates skipping).",
            },
            reasoning: { type: "string", description: "Short justification for the decision." },
          },
          required: ["message", "intent", "urgency", "suggested_action", "should_send", "reasoning"],
          additionalProperties: false,
        },
      },
    }];

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userMsg },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "send_automation_message" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Lovable AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: Record<string, unknown> = {
      message: "", intent: "casual", urgency: "low", suggested_action: "", should_send: true, reasoning: "",
    };
    if (toolCall?.function?.arguments) {
      try { parsed = { ...parsed, ...JSON.parse(toolCall.function.arguments) }; }
      catch (e) { console.error("parse tool args:", e); }
    } else {
      parsed.message = data.choices?.[0]?.message?.content ?? "";
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-automation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
