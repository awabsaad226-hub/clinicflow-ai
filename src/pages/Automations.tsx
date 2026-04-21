import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import type { Patient, Appointment, AiConfig, AutomationLog, Message } from "@/lib/db-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Heart, RefreshCcw, Sparkles, UserPlus, CalendarCheck, Loader2,
  PlayCircle, CheckCircle2, MessageSquare, Send, Zap, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { runAutomation, persistAutomationRun, type AutomationType, type AutomationResult } from "@/lib/automations";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { IntentBadge, UrgencyBadge } from "@/components/StatusBadges";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface FlowDef {
  type: AutomationType;
  title: string;
  description: string;
  icon: typeof Sparkles;
  tone: "primary" | "accent" | "warning" | "destructive" | "success";
  triggerLabel: string;
  triggerHint: string;
}

const FLOWS: FlowDef[] = [
  {
    type: "lead_qualification",
    title: "Lead qualification",
    description: "AI greets new leads, asks 1-2 qualifying questions, and offers to book a free consult.",
    icon: UserPlus,
    tone: "primary",
    triggerLabel: "New leads",
    triggerHint: "Patients with status = New Lead and no AI message yet",
  },
  {
    type: "booking_assistant",
    title: "Booking assistant",
    description: "AI confirms preferred treatment and proposes 2 concrete time slots in the next 5 days.",
    icon: CalendarCheck,
    tone: "accent",
    triggerLabel: "Booked, no upcoming appt",
    triggerHint: "Patients marked Booked who don't yet have a scheduled appointment",
  },
  {
    type: "missed_appointment",
    title: "Missed appointment recovery",
    description: "Warm, non-judgmental reschedule message after a missed appointment.",
    icon: AlertTriangle,
    tone: "destructive",
    triggerLabel: "Recently missed",
    triggerHint: "Appointments with status = Missed in the last 14 days",
  },
  {
    type: "post_treatment",
    title: "Post-treatment follow-up",
    description: "Check in on how the patient feels, give brief aftercare tips, suggest next visit if relevant.",
    icon: Heart,
    tone: "success",
    triggerLabel: "Recent treatments",
    triggerHint: "Appointments completed in the last 7 days",
  },
  {
    type: "reactivation",
    title: "Reactivation campaign",
    description: "Personalized re-engagement for patients who haven't been seen in months.",
    icon: RefreshCcw,
    tone: "warning",
    triggerLabel: "Inactive patients",
    triggerHint: "No visit in 60+ days OR status = Inactive",
  },
];

const toneCard: Record<FlowDef["tone"], string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning-foreground",
  destructive: "bg-destructive-soft text-destructive",
  success: "bg-success-soft text-success",
};

export default function Automations() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [slackWebhook, setSlackWebhook] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<AutomationType | null>(null);
  const [runAllProgress, setRunAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<{
    flow: FlowDef;
    patient: Patient;
    result: AutomationResult;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: a }, { data: l }, { data: c }, { data: ints }] = await Promise.all([
      supabase.from("patients").select("*"),
      supabase.from("appointments").select("*"),
      supabase.from("automations_log").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("ai_config").select("*").limit(1).maybeSingle(),
      supabase.from("integrations").select("*").eq("provider", "slack").eq("status", "connected").maybeSingle(),
    ]);
    setPatients(p ?? []);
    setAppts(a ?? []);
    setLogs(l ?? []);
    setConfig(c ?? null);
    setSlackWebhook((ints as any)?.config?.webhook_url ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const candidates = useMemo(() => {
    const map: Record<AutomationType, { patient: Patient; trigger: string }[]> = {
      lead_qualification: [], booking_assistant: [], missed_appointment: [], post_treatment: [], reactivation: [],
    };
    const now = new Date();

    patients.forEach((p) => {
      // Lead qualification
      if (p.status === "new_lead") {
        map.lead_qualification.push({ patient: p, trigger: `New lead created ${format(new Date(p.created_at), "MMM d")}` });
      }
      // Booking assistant: booked, no future scheduled appt
      if (p.status === "booked") {
        const hasUpcoming = appts.some(
          (a) => a.patient_id === p.id && a.status === "scheduled" && new Date(a.starts_at) > now,
        );
        if (!hasUpcoming) {
          map.booking_assistant.push({ patient: p, trigger: "Marked Booked but no upcoming appointment" });
        }
      }
      // Reactivation
      const last = p.last_visit ? new Date(p.last_visit) : null;
      const daysSince = last ? differenceInDays(now, last) : Infinity;
      if (p.status === "inactive" || (last && daysSince >= 60)) {
        map.reactivation.push({
          patient: p,
          trigger: last ? `Last visit ${daysSince} days ago` : "No recorded visits",
        });
      }
    });

    // Missed appointments (last 14 days)
    appts
      .filter((a) => a.status === "missed" && differenceInDays(now, new Date(a.starts_at)) <= 14)
      .forEach((a) => {
        const p = patients.find((pp) => pp.id === a.patient_id);
        if (p) map.missed_appointment.push({ patient: p, trigger: `Missed appointment on ${format(new Date(a.starts_at), "MMM d, HH:mm")}` });
      });

    // Post-treatment (completed in last 7 days)
    appts
      .filter((a) => a.status === "completed" && differenceInDays(now, new Date(a.starts_at)) <= 7)
      .forEach((a) => {
        const p = patients.find((pp) => pp.id === a.patient_id);
        if (p) map.post_treatment.push({ patient: p, trigger: `Completed ${a.treatment_type ?? "treatment"} on ${format(new Date(a.starts_at), "MMM d")}` });
      });

    return map;
  }, [patients, appts]);

  const triggerFlow = async (flow: FlowDef) => {
    if (!config) {
      toast.error("AI config not loaded");
      return;
    }
    const list = candidates[flow.type];
    if (list.length === 0) {
      toast.info("No matching patients right now");
      return;
    }
    setRunning(flow.type);
    const target = list[0]; // run for the first matching patient (preview-style)
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .eq("patient_id", target.patient.id)
      .order("created_at");
    const result = await runAutomation({
      type: flow.type,
      patient: target.patient,
      history: (history ?? []) as Message[],
      config,
      trigger_context: target.trigger,
    });
    setRunning(null);
    if (result.error) return toast.error(result.error);
    setPreview({ flow, patient: target.patient, result });
  };

  const sendPreview = async (send: boolean) => {
    if (!preview) return;
    await persistAutomationRun({
      patient: preview.patient,
      type: preview.flow.type,
      result: preview.result,
      trigger: `Manual run from Automation Center`,
      send,
    });
    toast.success(send ? "Message sent and logged" : "Run logged (not sent)");
    setPreview(null);
    load();
  };

  // Run every flow for every matching patient.
  // Auto-send if AI says should_send=true AND urgency is low/medium.
  // High urgency → don't send, instead ping Slack (if connected) so a human takes over.
  const runAll = async () => {
    if (!config) {
      toast.error("AI config not loaded");
      return;
    }
    const jobs: { flow: FlowDef; patient: Patient; trigger: string }[] = [];
    FLOWS.forEach((flow) => {
      candidates[flow.type].forEach((c) => jobs.push({ flow, ...c }));
    });
    if (jobs.length === 0) {
      toast.info("No matching patients to process right now");
      return;
    }
    setRunAllProgress({ done: 0, total: jobs.length });
    let sent = 0, alerted = 0, skipped = 0, failed = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        const { data: history } = await supabase
          .from("messages").select("*").eq("patient_id", job.patient.id).order("created_at");
        const result = await runAutomation({
          type: job.flow.type,
          patient: job.patient,
          history: (history ?? []) as Message[],
          config,
          trigger_context: job.trigger,
        });
        if (result.error) { failed++; continue; }
        const safeToSend = result.should_send && result.urgency !== "high";
        await persistAutomationRun({
          patient: job.patient,
          type: job.flow.type,
          result,
          trigger: `Auto-run: ${job.trigger}`,
          send: safeToSend,
        });
        if (safeToSend) sent++; else skipped++;
        if (result.urgency === "high" && slackWebhook) {
          await supabase.functions.invoke("slack-alert", {
            body: {
              webhook_url: slackWebhook,
              patient_name: job.patient.name,
              message: result.message || "(AI flagged but produced no draft)",
              urgency: result.urgency,
              intent: result.intent,
              context: `${job.flow.title} · ${job.trigger}`,
            },
          });
          alerted++;
        }
      } catch {
        failed++;
      }
      setRunAllProgress({ done: i + 1, total: jobs.length });
    }
    setRunAllProgress(null);
    toast.success(
      `Done · ${sent} sent · ${skipped} drafted · ${alerted} Slack alert${alerted === 1 ? "" : "s"}` +
        (failed ? ` · ${failed} failed` : ""),
    );
    load();
  };

  return (
    <AppShell title="Automation Center">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">AI-driven automations</h2>
            <p className="text-sm text-muted-foreground">
              Every decision is made by the AI using your settings — no keyword rules. Tap a flow to preview the next
              message, or hit <strong>Run all & auto-send</strong> to let the AI work the queue. Safe messages send
              automatically; high-urgency ones are drafted and {slackWebhook ? "pinged to Slack" : "saved as drafts"}.
            </p>
          </div>
          <Button onClick={runAll} disabled={running !== null || runAllProgress !== null || !config} size="lg">
            {runAllProgress ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing {runAllProgress.done}/{runAllProgress.total}…</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" /> Run all & auto-send</>
            )}
          </Button>
        </div>

        <Card className="surface-card border-primary/20 bg-primary-soft/30">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-xs text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            <p className="flex-1">
              <strong>Auto-send rules:</strong> the AI sends low/medium-urgency messages on its own.
              High-urgency cases stay as drafts {slackWebhook
                ? <>and ping your Slack so a human can take over.</>
                : <>— <a href="/integrations" className="underline">connect Slack</a> to get pinged in real time.</>}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLOWS.map((flow) => {
            const list = candidates[flow.type];
            return (
              <Card key={flow.type} className="surface-card transition-all hover:shadow-elev-md">
                <CardHeader className="space-y-2">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneCard[flow.tone])}>
                    <flow.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{flow.title}</CardTitle>
                  <CardDescription className="text-xs">{flow.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border bg-muted/40 p-2.5 text-xs">
                    <p className="font-medium text-foreground">{flow.triggerLabel}</p>
                    <p className="mt-0.5 text-muted-foreground">{flow.triggerHint}</p>
                    <p className="mt-1.5">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        list.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {list.length} matching patient{list.length === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={() => triggerFlow(flow)}
                    disabled={running !== null || list.length === 0}
                    className="w-full"
                    variant={list.length === 0 ? "outline" : "default"}
                  >
                    {running === flow.type ? (
                      <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Generating…</>
                    ) : (
                      <><PlayCircle className="mr-1 h-4 w-4" /> Run for next patient</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Activity log */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Recent automation runs
            </CardTitle>
            <CardDescription>The last 30 AI-generated automation actions across the clinic.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 my-2" />)}
            {!loading && logs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No automation runs yet. Trigger a flow above to get started.
              </p>
            )}
            {!loading && logs.map((log) => {
              const p = patients.find((pp) => pp.id === log.patient_id);
              const out = (log.ai_output as any) ?? {};
              return (
                <div key={log.id} className="flex items-start gap-3 py-3">
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    log.status === "sent" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                  )}>
                    {log.status === "sent" ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{p?.name ?? "Unknown"}</p>
                      <span className="text-xs text-muted-foreground capitalize">
                        · {String(log.automation_type).replace(/_/g, " ")}
                      </span>
                      <IntentBadge intent={out.intent} />
                      <UrgencyBadge urgency={out.urgency} />
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {out.message && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{out.message}</p>
                    )}
                    {log.trigger && (
                      <p className="mt-0.5 text-xs text-muted-foreground/80">Trigger: {log.trigger}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <preview.flow.icon className="h-4 w-4 text-primary" />
                {preview.flow.title}
              </DialogTitle>
              <DialogDescription>
                AI-generated message for <span className="font-medium text-foreground">{preview.patient.name}</span>.
                Review and decide whether to send.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <IntentBadge intent={preview.result.intent} />
                <UrgencyBadge urgency={preview.result.urgency} />
                {!preview.result.should_send && (
                  <span className="rounded bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">
                    AI suggests skipping
                  </span>
                )}
              </div>
              <Textarea
                rows={5}
                value={preview.result.message}
                onChange={(e) =>
                  setPreview({ ...preview, result: { ...preview.result, message: e.target.value } })
                }
              />
              <div className="rounded-md bg-muted/50 p-3 text-xs">
                <p><span className="font-semibold text-foreground">Suggested action:</span> {preview.result.suggested_action || "—"}</p>
                <p className="mt-1"><span className="font-semibold text-foreground">AI reasoning:</span> {preview.result.reasoning || "—"}</p>
              </div>
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => sendPreview(false)}>
                Log only
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
                <Button onClick={() => sendPreview(true)}>
                  <Send className="mr-1 h-4 w-4" /> Send to patient
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
