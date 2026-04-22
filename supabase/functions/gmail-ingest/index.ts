// Public webhook to ingest emails (e.g. from Zapier/Make watching your Gmail).
// POST { from_email, from_name?, subject?, body, source? }
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const body = await req.json();
    if (!body?.from_email || !body?.body) {
      return new Response(JSON.stringify({ error: "from_email and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.from("external_messages").insert({
      source: body.source ?? "gmail",
      from_email: String(body.from_email),
      from_name: body.from_name ? String(body.from_name) : null,
      subject: body.subject ? String(body.subject) : null,
      body: String(body.body),
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
