import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import type { AiConfig, AiReplyResult } from "@/lib/db-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, Sparkles, FlaskConical, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { callAiReply } from "@/lib/ai";
import { IntentBadge, UrgencyBadge } from "@/components/StatusBadges";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiSettings() {
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState("");

  // Playground
  const [testMessage, setTestMessage] = useState("Hi, I have a sharp pain on my upper-right tooth, what should I do?");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<AiReplyResult | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("*").limit(1).maybeSingle();
      setCfg(data);
      setServices((data?.services_offered ?? []).join(", "));
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<AiConfig>) =>
    setCfg((c) => (c ? { ...c, ...patch } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase
      .from("ai_config")
      .update({
        clinic_name: cfg.clinic_name,
        services_offered: services.split(",").map((s) => s.trim()).filter(Boolean),
        pricing_details: cfg.pricing_details,
        tone: cfg.tone,
        personality: cfg.personality,
        custom_instructions: cfg.custom_instructions,
        emergency_rules: cfg.emergency_rules,
        booking_rules: cfg.booking_rules,
        disallowed_behaviors: cfg.disallowed_behaviors,
      })
      .eq("id", cfg.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("AI settings saved");
  };

  const runTest = async () => {
    if (!cfg || !testMessage.trim()) return;
    setTestRunning(true);
    setTestResult(null);
    const result = await callAiReply({
      message: testMessage,
      config: cfg,
    });
    setTestRunning(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setTestResult(result);
  };

  if (loading || !cfg) {
    return (
      <AppShell title="AI Settings">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="AI Settings">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">AI Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Tune how your AI assistant talks to patients. Changes apply instantly across the app.
              </p>
            </div>
            <Button onClick={save} disabled={saving}>
              <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base">Clinic profile</CardTitle>
              <CardDescription>Basic information the AI uses in every reply.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Clinic name</Label>
                <Input value={cfg.clinic_name} onChange={(e) => update({ clinic_name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Services offered (comma separated)</Label>
                <Input
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  placeholder="Cleaning, Whitening, Implants…"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Pricing details</Label>
                <Textarea
                  rows={3}
                  value={cfg.pricing_details}
                  onChange={(e) => update({ pricing_details: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base">Personality & tone</CardTitle>
              <CardDescription>How the AI sounds and behaves.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Tone</Label>
                <Select value={cfg.tone} onValueChange={(v) => update({ tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Personality</Label>
                <Input value={cfg.personality} onChange={(e) => update({ personality: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Custom instructions</Label>
                <Textarea
                  rows={4}
                  value={cfg.custom_instructions}
                  onChange={(e) => update({ custom_instructions: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base">Rules & guardrails</CardTitle>
              <CardDescription>Define safety, urgency detection, and booking behavior.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div>
                <Label className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Emergency rules
                </Label>
                <Textarea rows={2} value={cfg.emergency_rules} onChange={(e) => update({ emergency_rules: e.target.value })} />
              </div>
              <div>
                <Label>Booking rules</Label>
                <Textarea rows={2} value={cfg.booking_rules} onChange={(e) => update({ booking_rules: e.target.value })} />
              </div>
              <div>
                <Label>Disallowed behaviors</Label>
                <Textarea rows={2} value={cfg.disallowed_behaviors} onChange={(e) => update({ disallowed_behaviors: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Playground */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Card className="surface-elevated overflow-hidden">
            <CardHeader className="gradient-soft">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-primary" /> Test AI playground
              </CardTitle>
              <CardDescription>Try a message as a patient and preview the AI's response.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div>
                <Label>Patient message</Label>
                <Textarea rows={4} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
              </div>
              <Button onClick={runTest} disabled={testRunning || !testMessage.trim()} className="w-full">
                {testRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {testRunning ? "Generating…" : "Run test"}
              </Button>

              {testResult && (
                <div className="space-y-3 rounded-lg border bg-card p-3 animate-fade-in">
                  <div className="flex flex-wrap items-center gap-2">
                    <IntentBadge intent={testResult.intent} />
                    <UrgencyBadge urgency={testResult.urgency} />
                  </div>
                  <div className="rounded-lg bg-primary p-3 text-sm text-primary-foreground">
                    {testResult.reply}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Suggested action:</span>{" "}
                    {testResult.suggested_action || "—"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card border-warning/30 bg-warning-soft/40">
            <CardContent className="p-4 text-xs text-warning-foreground">
              <p className="font-semibold">Demo mode</p>
              <p className="mt-1 opacity-90">
                The database is open to anyone using the app (no login). Add authentication before going to production. You can swap the backend later from Cloud → Settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
