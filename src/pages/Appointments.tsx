import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import type { Appointment, Patient } from "@/lib/db-types";
import { APPOINTMENT_STATUSES } from "@/lib/db-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addDays, addWeeks, format, isSameDay, parseISO, startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08:00 → 18:00

const statusTone: Record<string, string> = {
  scheduled: "bg-primary text-primary-foreground border-primary",
  completed: "bg-success text-success-foreground border-success",
  missed: "bg-destructive text-destructive-foreground border-destructive",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function Appointments() {
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("appointments").select("*").order("starts_at"),
      supabase.from("patients").select("*").order("name"),
    ]);
    setAppts(a ?? []);
    setPatients(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  const move = (n: number) =>
    setAnchor((d) => (view === "day" ? addDays(d, n) : addWeeks(d, n)));

  const apptsByDay = (d: Date) =>
    appts.filter((a) => isSameDay(parseISO(a.starts_at), d));

  return (
    <AppShell title="Appointments">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => move(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => move(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setAnchor(new Date())}>Today</Button>
            <h2 className="ml-2 text-lg font-semibold tracking-tight">
              {view === "day"
                ? format(anchor, "EEEE, MMM d, yyyy")
                : `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> New appointment
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <Card className="surface-card overflow-hidden">
          <CardContent className="p-0">
            <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))` }}>
              {/* Header row */}
              <div className="border-b border-r bg-muted/30" />
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "border-b border-r px-2 py-2 text-center",
                    isSameDay(d, new Date()) && "bg-primary-soft",
                  )}
                >
                  <p className="text-xs text-muted-foreground">{format(d, "EEE")}</p>
                  <p className={cn("text-sm font-semibold", isSameDay(d, new Date()) && "text-primary")}>
                    {format(d, "d")}
                  </p>
                </div>
              ))}

              {/* Hour rows */}
              {HOURS.map((h) => (
                <Row
                  key={h}
                  hour={h}
                  days={days}
                  apptsByDay={apptsByDay}
                  patients={patients}
                  onClickAppt={setEditing}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Tip: click an appointment to edit. New appointments default to the selected day at 9:00.
        </p>
      </div>

      <ApptDialog
        open={creating}
        onOpenChange={setCreating}
        patients={patients}
        defaultDate={anchor}
        onSaved={load}
      />
      {editing && (
        <ApptDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          patients={patients}
          appointment={editing}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </AppShell>
  );
}

function Row({
  hour, days, apptsByDay, patients, onClickAppt,
}: {
  hour: number;
  days: Date[];
  apptsByDay: (d: Date) => Appointment[];
  patients: Patient[];
  onClickAppt: (a: Appointment) => void;
}) {
  return (
    <>
      <div className="border-b border-r p-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((d) => {
        const dayAppts = apptsByDay(d).filter(
          (a) => parseISO(a.starts_at).getHours() === hour,
        );
        return (
          <div
            key={d.toISOString() + hour}
            className={cn(
              "relative min-h-[56px] border-b border-r p-1",
              isSameDay(d, new Date()) && "bg-primary-soft/40",
            )}
          >
            {dayAppts.map((a) => {
              const p = patients.find((pp) => pp.id === a.patient_id);
              return (
                <button
                  key={a.id}
                  onClick={() => onClickAppt(a)}
                  className={cn(
                    "mb-1 w-full truncate rounded-md border-l-2 px-2 py-1 text-left text-[11px] font-medium shadow-elev-sm transition-all hover:scale-[1.01]",
                    statusTone[a.status],
                  )}
                >
                  <div className="flex items-center gap-1 truncate">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    {format(parseISO(a.starts_at), "HH:mm")}
                  </div>
                  <div className="truncate">{p?.name ?? "Unknown"}</div>
                  {a.treatment_type && (
                    <div className="truncate text-[10px] opacity-80">{a.treatment_type}</div>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function ApptDialog({
  open, onOpenChange, patients, appointment, defaultDate, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  patients: Patient[];
  appointment?: Appointment;
  defaultDate?: Date;
  onSaved: () => void;
}) {
  const isEdit = !!appointment;
  const initialStart = appointment
    ? parseISO(appointment.starts_at)
    : new Date((defaultDate ?? new Date()).setHours(9, 0, 0, 0));
  const initialEnd = appointment
    ? parseISO(appointment.ends_at)
    : new Date(initialStart.getTime() + 30 * 60000);

  const [patientId, setPatientId] = useState(appointment?.patient_id ?? patients[0]?.id ?? "");
  const [date, setDate] = useState(format(initialStart, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(initialStart, "HH:mm"));
  const [duration, setDuration] = useState(
    String(Math.max(15, Math.round((initialEnd.getTime() - initialStart.getTime()) / 60000))),
  );
  const [treatment, setTreatment] = useState(appointment?.treatment_type ?? "");
  const [status, setStatus] = useState(appointment?.status ?? "scheduled");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = appointment ? parseISO(appointment.starts_at) : new Date((defaultDate ?? new Date()).setHours(9, 0, 0, 0));
    const e = appointment ? parseISO(appointment.ends_at) : new Date(s.getTime() + 30 * 60000);
    setPatientId(appointment?.patient_id ?? patients[0]?.id ?? "");
    setDate(format(s, "yyyy-MM-dd"));
    setTime(format(s, "HH:mm"));
    setDuration(String(Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000))));
    setTreatment(appointment?.treatment_type ?? "");
    setStatus(appointment?.status ?? "scheduled");
    setNotes(appointment?.notes ?? "");
  }, [open, appointment]);

  const submit = async () => {
    if (!patientId) return toast.error("Select a patient");
    setSaving(true);
    const starts = new Date(`${date}T${time}:00`);
    const ends = new Date(starts.getTime() + Number(duration) * 60000);
    const payload = {
      patient_id: patientId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      treatment_type: treatment || null,
      status: status as any,
      notes: notes || null,
    };
    const { error } = isEdit
      ? await supabase.from("appointments").update(payload).eq("id", appointment!.id)
      : await supabase.from("appointments").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Appointment updated" : "Appointment created");
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!appointment) return;
    if (!confirm("Delete this appointment?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
    if (error) return toast.error(error.message);
    toast.success("Appointment deleted");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            {isEdit ? "Edit appointment" : "New appointment"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update or change the status of this appointment." : "Schedule a new appointment for a patient."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Select patient…" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Treatment</Label>
            <Input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. Cleaning, Whitening" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("capitalize", statusTone[status])}>{status}</Badge>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
              Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
