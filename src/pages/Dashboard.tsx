import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Sparkles, Calendar, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Patient, Appointment, Message } from "@/lib/db-types";
import { format, isToday } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IntentBadge, UrgencyBadge } from "@/components/StatusBadges";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recent, setRecent] = useState<(Message & { patient?: Patient })[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: ps }, { data: as }, { data: ms }] = await Promise.all([
        supabase.from("patients").select("*").order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").order("starts_at"),
        supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      if (!mounted) return;
      setPatients(ps ?? []);
      setAppointments(as ?? []);
      const enriched = (ms ?? []).map((m) => ({
        ...m,
        patient: (ps ?? []).find((p) => p.id === m.patient_id),
      }));
      setRecent(enriched);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const today = new Date();

  const newLeadsToday = patients.filter(
    (p) => isToday(new Date(p.created_at)) && p.status === "new_lead"
  ).length;
  const apptsToday = appointments.filter((a) => isToday(new Date(a.starts_at)));
  const missed = appointments.filter((a) => a.status === "missed").length;

  const upcoming24h = appointments.filter((a) => {
    const t = new Date(a.starts_at).getTime();
    return t >= today.getTime() && t <= today.getTime() + 24 * 3600 * 1000 && a.status === "scheduled";
  });

  const urgentMessages = recent.filter((m) => m.urgency === "high").slice(0, 4);
  const recentConvos = recent.slice(0, 6);

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back 👋</h2>
          <p className="text-sm text-muted-foreground">Here's what's happening at your clinic today.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Patients" value={patients.length} icon={Users} tone="primary" />
            <MetricCard label="New Leads Today" value={newLeadsToday} icon={Sparkles} tone="accent" hint="Created in the last 24h" />
            <MetricCard label="Appointments Today" value={apptsToday.length} icon={Calendar} tone="success" />
            <MetricCard label="Missed" value={missed} icon={AlertTriangle} tone="destructive" hint="All-time missed" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="surface-card lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Recent conversations</CardTitle>
                <CardDescription>Latest messages across the inbox</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/inbox">
                  Open inbox <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y">
              {recentConvos.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
              )}
              {recentConvos.map((m) => (
                <Link
                  key={m.id}
                  to={`/inbox?patient=${m.patient_id}`}
                  className="flex items-start gap-3 py-3 transition-colors hover:bg-muted/50 rounded-lg -mx-2 px-2"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {(m.patient?.name ?? "?").slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{m.patient?.name ?? "Unknown"}</p>
                      <span className="text-xs text-muted-foreground capitalize">· {m.sender}</span>
                      <IntentBadge intent={m.intent} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{m.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "MMM d, HH:mm")}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="surface-card border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                AI-detected urgent cases
              </CardTitle>
              <CardDescription>Messages flagged as high urgency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {urgentMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">No urgent cases right now.</p>
              )}
              {urgentMessages.map((m) => (
                <Link
                  key={m.id}
                  to={`/inbox?patient=${m.patient_id}`}
                  className="block rounded-lg border border-destructive/20 bg-destructive-soft/40 p-3 transition-colors hover:bg-destructive-soft"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{m.patient?.name ?? "Unknown"}</p>
                    <UrgencyBadge urgency={m.urgency} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.body}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Upcoming appointments (next 24h)</CardTitle>
            <CardDescription>Scheduled visits</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming24h.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No upcoming appointments.</p>
            ) : (
              <div className="divide-y">
                {upcoming24h.map((a) => {
                  const p = patients.find((pp) => pp.id === a.patient_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{p?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{a.treatment_type ?? "Visit"}</p>
                        </div>
                      </div>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {format(new Date(a.starts_at), "EEE HH:mm")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
