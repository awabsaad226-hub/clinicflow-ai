// Public webhook endpoint for Calendly invitee.created / invitee.canceled events.
// Configure verify_jwt = false in supabase/config.toml so Calendly can POST to it.
// In Calendly: Account → Integrations → Webhooks → New webhook → URL = this function URL,
// events = invitee.created, invitee.canceled.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const payload = await req.json();
    const event = payload?.event ?? "invitee.created";
    const inv = payload?.payload ?? {};
    const name = inv?.name ?? inv?.invitee?.name ?? "Unknown";
    const email = inv?.email ?? inv?.invitee?.email ?? "unknown@calendly";
    const startTime =
      inv?.scheduled_event?.start_time ??
      inv?.event?.start_time ??
      inv?.start_time ?? null;
    const eventName =
      inv?.scheduled_event?.name ??
      inv?.event?.name ??
      "Calendly booking";

    const subject = event === "invitee.canceled"
      ? `Booking canceled: ${eventName}`
      : `New booking: ${eventName}`;

    const body = `${name} (${email})\n${subject}` +
      (startTime ? `\nWhen: ${new Date(startTime).toLocaleString()}` : "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("external_messages").insert({
      source: "calendly",
      from_email: email,
      from_name: name,
      subject,
      body,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
