import { supabase } from "@/integrations/supabase/client";
import type { Patient, Message, Appointment, AiConfig } from "@/lib/db-types";

/**
 * Seeds demo data the first time the app loads (only if tables are empty).
 * Idempotent — safe to call repeatedly.
 */
export async function ensureDemoData(): Promise<void> {
  const { count } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();

  const patients = [
    {
      name: "Sarah Johnson",
      phone: "+1 555 0142",
      email: "sarah.j@example.com",
      status: "booked" as const,
      last_visit: days(-30),
      treatment_type: "Whitening",
      notes: "Sensitive to cold. Prefers morning slots.",
      tags: ["whitening", "vip"],
    },
    {
      name: "Michael Chen",
      phone: "+1 555 0188",
      email: "m.chen@example.com",
      status: "new_lead" as const,
      treatment_type: "Implants",
      notes: "Asked about implant pricing.",
      tags: ["pricing", "implants"],
    },
    {
      name: "Aisha Patel",
      phone: "+1 555 0199",
      email: "aisha.p@example.com",
      status: "follow_up" as const,
      last_visit: days(-7),
      treatment_type: "Root Canal",
      notes: "Follow-up after root canal.",
      tags: ["urgent"],
    },
    {
      name: "David Garcia",
      phone: "+1 555 0124",
      email: "d.garcia@example.com",
      status: "treated" as const,
      last_visit: days(-14),
      treatment_type: "Cleaning",
      tags: ["cleaning"],
    },
    {
      name: "Emily Rossi",
      phone: "+1 555 0156",
      email: "e.rossi@example.com",
      status: "new_lead" as const,
      notes: "Interested in orthodontics for daughter.",
      tags: ["pricing", "orthodontics"],
    },
    {
      name: "Liam O'Connor",
      phone: "+1 555 0173",
      email: "liam.oc@example.com",
      status: "inactive" as const,
      last_visit: days(-120),
      treatment_type: "Cleaning",
      tags: ["reactivation"],
    },
  ];

  const { data: insertedPatients, error: pErr } = await supabase
    .from("patients")
    .insert(patients)
    .select();
  if (pErr || !insertedPatients) return;

  // Appointments
  const apptByName = (name: string) => insertedPatients.find((p) => p.name === name)!;
  const appts = [
    {
      patient_id: apptByName("Sarah Johnson").id,
      starts_at: days(0),
      ends_at: new Date(new Date(days(0)).getTime() + 60 * 60000).toISOString(),
      treatment_type: "Whitening consult",
      status: "scheduled" as const,
    },
    {
      patient_id: apptByName("Aisha Patel").id,
      starts_at: days(1),
      ends_at: new Date(new Date(days(1)).getTime() + 45 * 60000).toISOString(),
      treatment_type: "Root canal follow-up",
      status: "scheduled" as const,
    },
    {
      patient_id: apptByName("David Garcia").id,
      starts_at: days(-1),
      ends_at: new Date(new Date(days(-1)).getTime() + 30 * 60000).toISOString(),
      treatment_type: "Cleaning",
      status: "missed" as const,
    },
    {
      patient_id: apptByName("David Garcia").id,
      starts_at: days(-14),
      ends_at: new Date(new Date(days(-14)).getTime() + 30 * 60000).toISOString(),
      treatment_type: "Cleaning",
      status: "completed" as const,
    },
  ];
  await supabase.from("appointments").insert(appts);

  // Conversations
  const messages = [
    // Sarah
    {
      patient_id: apptByName("Sarah Johnson").id,
      sender: "patient",
      body: "Hi! I'd like to know more about teeth whitening, is it safe for sensitive teeth?",
    },
    {
      patient_id: apptByName("Sarah Johnson").id,
      sender: "ai",
      body: "Hi Sarah! Yes, our whitening is safe for sensitive teeth — we use a gentler gel. Want me to book you a quick consult this week?",
      intent: "inquiry",
      urgency: "low",
      suggested_action: "Offer 2 consult slots",
      tags: ["whitening"],
    },
    // Michael
    {
      patient_id: apptByName("Michael Chen").id,
      sender: "patient",
      body: "What's the pricing for a single implant?",
    },
    {
      patient_id: apptByName("Michael Chen").id,
      sender: "ai",
      body: "Great question! Implants start at $1,500 including the crown. Pricing varies based on bone health — would you like a free 15-min consult to get an exact quote?",
      intent: "inquiry",
      urgency: "low",
      suggested_action: "Send pricing PDF + book consult",
      tags: ["pricing", "implants"],
    },
    // Aisha — urgent
    {
      patient_id: apptByName("Aisha Patel").id,
      sender: "patient",
      body: "I have severe pain in my back tooth since last night, it's swollen too 😣",
    },
    {
      patient_id: apptByName("Aisha Patel").id,
      sender: "ai",
      body: "I'm so sorry, Aisha — that sounds urgent. Severe pain with swelling needs same-day attention. We have a slot at 2:30 PM today, can you make it?",
      intent: "emergency",
      urgency: "high",
      suggested_action: "Same-day emergency slot",
      tags: ["urgent", "booking"],
    },
  ];
  await supabase.from("messages").insert(messages as any);
}
