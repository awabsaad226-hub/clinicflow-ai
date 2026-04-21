import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import type { Patient, Message, AiConfig } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Send, Sparkles, UserCog, Tag, Loader2, Mail, Inbox as InboxIcon, Plus } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { IntentBadge, UrgencyBadge, PatientStatusBadge } from "@/components/StatusBadges";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callAiReply } from "@/lib/ai";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Inbox() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [params, setParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(params.get("patient"));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [takeover, setTakeover] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshAll = async () => {
    const [{ data: ps }, { data: cfg }] = await Promise.all([
      supabase.from("patients").select("*").order("created_at", { ascending: false }),
      supabase.from("ai_config").select("*").limit(1).maybeSingle(),
    ]);
    setPatients(ps ?? []);
    setConfig(cfg ?? null);
    if (!activeId && ps && ps.length) setActiveId(ps[0].id);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setParams((p) => {
      p.set("patient", activeId);
      return p;
    });
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("patient_id", activeId)
        .order("created_at");
      setMessages(data ?? []);
    })();
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const filtered = useMemo(() => {
    if (!query) return patients;
    const q = query.toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, query]);

  const active = patients.find((p) => p.id === activeId) ?? null;

  // Last patient message preview per conversation (lightweight)
  const [previews, setPreviews] = useState<Record<string, { body: string; ts: string; urgency: string | null }>>({});
  useEffect(() => {
    if (patients.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("patient_id, body, created_at, urgency")
        .order("created_at", { ascending: false })
        .limit(200);
      const map: typeof previews = {};
      (data ?? []).forEach((m) => {
        if (!map[m.patient_id]) map[m.patient_id] = { body: m.body, ts: m.created_at, urgency: m.urgency };
      });
      setPreviews(map);
    })();
  }, [patients, messages]);

  const sendManual = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");

    // Insert patient message
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ patient_id: active.id, sender: "patient" as const, body })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setSending(false);
      return;
    }
    const newMessages = [...messages, inserted as Message];
    setMessages(newMessages);
    setSending(false);

    // If not in takeover mode, generate AI reply
    if (!takeover && config) {
      setAiLoading(true);
      const result = await callAiReply({
        message: body,
        patient: active,
        history: newMessages,
        config,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        const { data: aiMsg } = await supabase
          .from("messages")
          .insert({
            patient_id: active.id,
            sender: "ai" as const,
            body: result.reply,
            intent: result.intent as any,
            urgency: result.urgency as any,
            suggested_action: result.suggested_action,
          })
          .select()
          .single();
        if (aiMsg) setMessages((m) => [...m, aiMsg as Message]);
        await supabase.from("automations_log").insert({
          patient_id: active.id,
          automation_type: "reply",
          trigger: "incoming_message",
          ai_output: result as any,
        });
      }
      setAiLoading(false);
    }
  };

  const sendStaffReply = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ patient_id: active.id, sender: "staff" as const, body, human_takeover: true })
      .select()
      .single();
    setSending(false);
    if (error) return toast.error(error.message);
    setMessages((m) => [...m, inserted as Message]);
  };

  const regenerateAi = async () => {
    if (!active || !config) return;
    const lastPatient = [...messages].reverse().find((m) => m.sender === "patient");
    if (!lastPatient) {
      toast.error("No patient message to reply to");
      return;
    }
    setAiLoading(true);
    const result = await callAiReply({
      message: lastPatient.body,
      patient: active,
      history: messages,
      config,
    });
    setAiLoading(false);
    if (result.error) return toast.error(result.error);
    setDraft(result.reply);
    toast.success(`AI suggestion ready · ${result.intent} / ${result.urgency}`);
  };

  return (
    <AppShell title="Inbox">
      <Tabs defaultValue="conversations" className="space-y-3">
        <TabsList>
          <TabsTrigger value="conversations" className="gap-2">
            <InboxIcon className="h-4 w-4" /> Patient chats
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" /> External emails
          </TabsTrigger>
        </TabsList>
        <TabsContent value="emails"><EmailsPanel /></TabsContent>
        <TabsContent value="conversations">
      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <Card className="surface-card flex h-full min-h-0 flex-col overflow-hidden">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filtered.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No conversations</p>
            )}
            {filtered.map((p) => {
              const prev = previews[p.id];
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50",
                    isActive && "bg-primary-soft/60",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {p.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {prev && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(prev.ts), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {prev?.body ?? "No messages yet"}
                    </p>
                    {prev?.urgency === "high" && (
                      <span className="mt-1 inline-block rounded bg-destructive-soft px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        URGENT
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Message panel */}
        <Card className="surface-card flex h-full min-h-0 flex-col overflow-hidden">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation to start.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {active.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{active.name}</p>
                  <p className="text-xs text-muted-foreground">{active.phone ?? active.email ?? "—"}</p>
                </div>
                <PatientStatusBadge status={active.status} className="hidden sm:inline-flex" />
                <div className="ml-auto flex items-center gap-3">
                  <TagDialog patient={active} onChanged={refreshAll} />
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="takeover" className="text-xs">Take over</Label>
                    <Switch id="takeover" checked={takeover} onCheckedChange={setTakeover} />
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gradient-soft p-4 scrollbar-thin">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">No messages yet — send the first one below.</p>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} m={m} />
                ))}
                {aiLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI is typing…
                  </div>
                )}
              </div>

              <div className="border-t p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={regenerateAi} disabled={aiLoading || !config}>
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> AI suggestion
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {takeover ? "Human mode — AI won't auto-reply." : "Auto mode — AI will reply to incoming messages."}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder={takeover ? "Type your reply…" : "Type as the patient (AI will reply)…"}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        takeover ? sendStaffReply() : sendManual();
                      }
                    }}
                    className="min-h-[44px] resize-none"
                  />
                  <Button
                    onClick={takeover ? sendStaffReply : sendManual}
                    disabled={sending || !draft.trim()}
                    className="h-auto"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function MessageBubble({ m }: { m: Message }) {
  const isPatient = m.sender === "patient";
  const isAi = m.sender === "ai";
  return (
    <div className={cn("flex w-full", isPatient ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-elev-sm",
          isPatient && "rounded-bl-md bg-card text-card-foreground border",
          isAi && "rounded-br-md bg-primary text-primary-foreground",
          m.sender === "staff" && "rounded-br-md bg-accent text-accent-foreground",
        )}
      >
        <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase opacity-70">
          {m.sender}
          <span>· {format(new Date(m.created_at), "HH:mm")}</span>
        </div>
        <p className="whitespace-pre-wrap">{m.body}</p>
        {(m.intent || m.urgency) && (
          <div className={cn("mt-2 flex flex-wrap items-center gap-1.5", !isPatient && "opacity-90")}>
            <IntentBadge intent={m.intent} />
            <UrgencyBadge urgency={m.urgency} />
          </div>
        )}
        {(m.tags?.length ?? 0) > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {m.tags.map((t) => (
              <span key={t} className="rounded bg-background/30 px-1.5 py-0.5 text-[10px]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagDialog({ patient, onChanged }: { patient: Patient; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState((patient.tags ?? []).join(", "));
  useEffect(() => setTags((patient.tags ?? []).join(", ")), [patient.id]);
  const save = async () => {
    const arr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("patients").update({ tags: arr }).eq("id", patient.id);
    if (error) return toast.error(error.message);
    toast.success("Tags updated");
    setOpen(false);
    onChanged();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Tag className="mr-1 h-3.5 w-3.5" /> Tags</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit tags</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="tg-tags">Comma-separated</Label>
          <Input id="tg-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="urgent, pricing, booking" />
          <p className="text-xs text-muted-foreground">Suggested: urgent, pricing, booking, follow-up</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
