// Lists Slack channels the bot can post to (public + private it's been invited to).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
      return new Response(JSON.stringify({ error: "Slack is not connected. Connect it in Integrations." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const channels: Array<{ id: string; name: string; is_private: boolean }> = [];
    let cursor = "";
    let pages = 0;
    do {
      const url =
        `${GATEWAY_URL}/conversations.list?limit=200&types=public_channel,private_channel&exclude_archived=true` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": SLACK_API_KEY,
        },
      });
      const data = await r.json();
      if (!r.ok || data?.ok === false) {
        return new Response(JSON.stringify({ error: `Slack: ${data?.error ?? r.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const c of data.channels ?? []) {
        channels.push({ id: c.id, name: c.name, is_private: !!c.is_private });
      }
      cursor = data.response_metadata?.next_cursor ?? "";
      pages++;
    } while (cursor && pages < 5);

    channels.sort((a, b) => a.name.localeCompare(b.name));
    return new Response(JSON.stringify({ channels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
