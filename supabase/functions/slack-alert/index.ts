// Posts a high-urgency alert to a Slack channel via the Lovable Slack connector gateway.
// The channel id (e.g. C0123ABCD) is stored in integrations.config.channel_id.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface Body {
  channel_id: string;
  patient_name?: string;
  message: string;
  urgency?: string;
  intent?: string;
  context?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!SLACK_API_KEY) throw new Error("Slack is not connected. Please connect Slack in Integrations.");

    const body = (await req.json()) as Body;
    if (!body?.channel_id || !body?.message) {
      return new Response(JSON.stringify({ error: "channel_id and message are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text =
      `:rotating_light: *${(body.urgency ?? "high").toUpperCase()} priority*` +
      (body.patient_name ? ` — ${body.patient_name}` : "") + `\n` +
      (body.intent ? `*Intent:* ${body.intent}\n` : "") +
      (body.context ? `*Context:* ${body.context}\n` : "") +
      `*AI draft:*\n>${body.message.replace(/\n/g, "\n>")}`;

    const r = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: body.channel_id,
        text,
        username: "DentalAI",
        icon_emoji: ":tooth:",
      }),
    });
    const data = await r.json();
    if (!r.ok || data?.ok === false) {
      return new Response(JSON.stringify({ error: `Slack: ${data?.error ?? r.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, ts: data.ts, channel: data.channel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
