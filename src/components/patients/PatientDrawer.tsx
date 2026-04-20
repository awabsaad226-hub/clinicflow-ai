import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import type { Patient, Message, Appointment } from "@/lib/db-types";
import { PATIENT_STATUSES } from "@/lib/db-types";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PatientStatusBadge } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, MessageSquare, ClipboardList, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Props {
  patient: Patient | null;
  onClose: () => void;
  onChanged: () => void;
}

export function PatientDrawer({ patient, onClose, onChanged }: Props) {
  const [draft, setDraft] = useState<Patient | null>(patient);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(patient);
    if (!patient) return;
    (async () => {
      const [{ data: ms }, { data: as }] = await Promise.all([
        supabase.from("messages").select("*").eq("patient_id", patient.id).order("created_at"),
        supabase.from("appointments").select("*").eq("patient_id", patient.id).order("starts_at", { ascending: false }),
      ]);
      setMessages(ms ?? []);
      setAppts(as ?? []);
    })();
  }, [patient]);

  if (!patient || !draft) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("patients")
      .update({
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        status: draft.status,
        treatment_type: draft.treatment_type,
        notes: draft.notes,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Patient updated");
    onChanged();
  };

  const del = async () => {
    if (!confirm("Delete this patient and all their messages/appointments?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", draft.id);
    if (error) return toast.error(error.message);
    toast.success("Patient deleted");
    onClose();
    onChanged();
  };

  // Build timeline
  type Item = { ts: string; kind: "message" | "appointment" | "note"; label: string; body?: string };
  const timeline: Item[] = [
    ...messages.map<Item>((m) => ({
      ts: m.created_at,
      kind: "message",
      label: `${m.sender === "patient" ? "Patient" : m.sender === "ai" ? "AI" : "Staff"} message`,
      body: m.body,
    })),
    ...appts.map<Item>((a) => ({
      ts: a.starts_at,
      kind: "appointment",
      label: `${a.treatment_type ?? "Appointment"} (${a.status})`,
    })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <Sheet open={!!patient} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {draft.name.slice(0, 1)}
            </div>
            {draft.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <PatientStatusBadge status={draft.status} />
            <span className="text-xs">Created {format(new Date(draft.created_at), "MMM d, yyyy")}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Profile</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PATIENT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Treatment</Label>
                <Input value={draft.treatment_type ?? ""} onChange={(e) => setDraft({ ...draft, treatment_type: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button onClick={save} disabled={saving} size="sm">
                <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`/inbox?patient=${draft.id}`}>
                  <MessageSquare className="mr-1 h-4 w-4" /> Open chat
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:text-destructive" onClick={del}>
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Timeline</h3>
            {timeline.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
            <ol className="relative space-y-4 border-l border-border pl-5">
              {timeline.map((it, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-primary/30">
                    {it.kind === "message" ? (
                      <MessageSquare className="h-2.5 w-2.5 text-primary" />
                    ) : it.kind === "appointment" ? (
                      <Calendar className="h-2.5 w-2.5 text-accent" />
                    ) : (
                      <ClipboardList className="h-2.5 w-2.5 text-muted-foreground" />
                    )}
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">
                    {format(new Date(it.ts), "MMM d, yyyy HH:mm")} · {it.label}
                  </p>
                  {it.body && <p className="mt-1 line-clamp-3 text-sm">{it.body}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
