// Posts a high-urgency alert to the clinic's Slack incoming-webhook URL.
// The webhook URL is stored in the integrations table (provider='slack', config.webhook_url).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  webhook_url: string;
  patient_name: string;
  message: string;
  urgency?: string;
  intent?: string;
  context?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.webhook_url || !body?.message) {
      return new Response(JSON.stringify({ error: "webhook_url and message are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = `:rotating_light: *${(body.urgency ?? "high").toUpperCase()} priority* — ${body.patient_name}\n` +
      (body.intent ? `*Intent:* ${body.intent}\n` : "") +
      (body.context ? `*Context:* ${body.context}\n` : "") +
      `*AI draft:*\n>${body.message.replace(/\n/g, "\n>")}`;
    const r = await fetch(body.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `Slack webhook failed: ${r.status} ${t}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
