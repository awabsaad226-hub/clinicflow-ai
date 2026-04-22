import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail, MessageSquare, CalendarDays, CheckCircle2, Loader2, Plug, ExternalLink, Copy, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Integration {
  id: string;
  provider: "gmail" | "slack" | "calendly";
  status: "connected" | "disconnected";
  config: Record<string, any>;
  connected_at: string | null;
}

interface SlackChannel { id: string; name: string; is_private: boolean }

const SUPABASE_PROJECT = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const CALENDLY_WEBHOOK_URL = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/calendly-webhook`;
const GMAIL_INGEST_URL = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/gmail-ingest`;

export default function Integrations() {
  const [rows, setRows] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Gmail (demo)
  const [gmailEmail, setGmailEmail] = useState("");

  // Slack (real connector)
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [slackChannelId, setSlackChannelId] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [slackConnectorLinked, setSlackConnectorLinked] = useState(false);

  // Calendly
  const [calendlyUrl, setCalendlyUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("integrations").select("*").order("provider");
    const list = (data ?? []) as unknown as Integration[];
    setRows(list);
    setGmailEmail(list.find((r) => r.provider === "gmail")?.config?.email ?? "");
    setSlackChannelId(list.find((r) => r.provider === "slack")?.config?.channel_id ?? "");
    setCalendlyUrl(list.find((r) => r.provider === "calendly")?.config?.url ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-attempt to load Slack channels — succeeds only if the connector is linked
  const loadSlackChannels = async () => {
    setLoadingChannels(true);
    const { data, error } = await supabase.functions.invoke("slack-channels", { body: {} });
    setLoadingChannels(false);
    if (error || (data as any)?.error) {
      setSlackConnectorLinked(false);
      return;
    }
    setSlackConnectorLinked(true);
    setSlackChannels((data as any).channels ?? []);
  };
  useEffect(() => { loadSlackChannels(); }, []);

  const updateIntegration = async (
    provider: Integration["provider"],
    patch: { status?: "connected" | "disconnected"; config?: Record<string, any> },
  ) => {
    const row = rows.find((r) => r.provider === provider);
    if (!row) return;
    setSavingId(row.id);
    const update: any = {};
    if (patch.status) {
      update.status = patch.status;
      update.connected_at = patch.status === "connected" ? new Date().toISOString() : null;
    }
    if (patch.config) update.config = { ...row.config, ...patch.config };
    const { error } = await supabase.from("integrations").update(update).eq("id", row.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success(`${provider} updated`);
    load();
  };

  const saveGmail = async () => {
    if (!gmailEmail.trim()) return toast.error("Enter a Gmail address first");
    await updateIntegration("gmail", {
      status: "connected",
      config: { email: gmailEmail.trim() },
    });
  };

  const saveSlackChannel = async () => {
    if (!slackChannelId) return toast.error("Pick a Slack channel first");
    const channel = slackChannels.find((c) => c.id === slackChannelId);
    await updateIntegration("slack", {
      status: "connected",
      config: { channel_id: slackChannelId, channel_name: channel?.name ?? null },
    });
  };

  const testSlack = async () => {
    if (!slackChannelId) return toast.error("Save a channel first");
    const { data, error } = await supabase.functions.invoke("slack-alert", {
      body: {
        channel_id: slackChannelId,
        patient_name: "Test patient",
        message: "This is a test alert from your DentalAI workspace. If you see this, Slack alerts work! ✅",
        urgency: "low",
        intent: "casual",
        context: "Manual test from Integrations page",
      },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Slack test failed");
    } else {
      toast.success(`Sent to #${slackChannels.find((c) => c.id === slackChannelId)?.name ?? "channel"}`);
    }
  };

  const saveCalendly = async () => {
    if (!calendlyUrl.trim() || !calendlyUrl.includes("calendly.com")) {
      return toast.error("Paste your Calendly URL (https://calendly.com/...)");
    }
    await updateIntegration("calendly", {
      status: "connected",
      config: { url: calendlyUrl.trim() },
    });
    const { data: cfg } = await supabase.from("ai_config").select("id").limit(1).maybeSingle();
    if (cfg?.id) {
      await supabase.from("ai_config").update({ calendly_url: calendlyUrl.trim() } as any).eq("id", cfg.id);
    }
  };

  const disconnect = (provider: Integration["provider"]) =>
    updateIntegration(provider, { status: "disconnected" });

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copied`);
  };

  if (loading) {
    return (
      <AppShell title="Integrations">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  const gmail = rows.find((r) => r.provider === "gmail");
  const slack = rows.find((r) => r.provider === "slack");
  const calendly = rows.find((r) => r.provider === "calendly");

  return (
    <AppShell title="Integrations">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Connect your tools</h2>
          <p className="text-sm text-muted-foreground">
            Bring your Gmail, Slack and Calendly into DentalAI. Patient emails arrive in your Inbox, urgent
            messages ping a Slack channel, and Calendly bookings show up automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* GMAIL */}
          <IntegrationCard
            icon={<Mail className="h-5 w-5" />}
            title="Gmail"
            description="Forward incoming patient emails to your Inbox."
            connected={gmail?.status === "connected"}
            tone="primary"
          >
            <div className="space-y-2">
              <Label htmlFor="gm-email">Your Gmail address</Label>
              <Input
                id="gm-email"
                type="email"
                placeholder="reception@yourclinic.com"
                value={gmailEmail}
                onChange={(e) => setGmailEmail(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Demo mode: full Gmail OAuth requires a Google Cloud project. To send a real email into your inbox
                today, POST it to your private webhook below.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveGmail} disabled={savingId === gmail?.id} className="flex-1">
                {savingId === gmail?.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                {gmail?.status === "connected" ? "Update" : "Connect"}
              </Button>
              {gmail?.status === "connected" && (
                <Button variant="ghost" onClick={() => disconnect("gmail")}>Disconnect</Button>
              )}
            </div>
            {gmail?.status === "connected" && (
              <div className="rounded-md border bg-muted/40 p-2">
                <p className="text-[11px] font-medium">Email-in webhook</p>
                <div className="mt-1 flex items-center gap-1">
                  <code className="flex-1 truncate rounded bg-background px-1.5 py-1 text-[10px]">
                    {GMAIL_INGEST_URL}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => copy(GMAIL_INGEST_URL, "URL")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  POST JSON: {`{ "from_email", "from_name", "subject", "body" }`}
                </p>
              </div>
            )}
          </IntegrationCard>

          {/* SLACK — real connector */}
          <IntegrationCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Slack"
            description="Post high-urgency alerts to a Slack channel."
            connected={slack?.status === "connected" && slackConnectorLinked}
            tone="accent"
          >
            {!slackConnectorLinked ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Slack workspace not connected yet. Ask the AI in chat to "connect Slack" — Lovable will
                  open the secure connection flow.
                </p>
                <Button onClick={loadSlackChannels} variant="outline" size="sm">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> I've connected — refresh
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Alerts channel</Label>
                    <Button variant="ghost" size="sm" onClick={loadSlackChannels} disabled={loadingChannels}>
                      {loadingChannels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                  <Select value={slackChannelId} onValueChange={setSlackChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingChannels ? "Loading channels…" : "Pick a channel"} />
                    </SelectTrigger>
                    <SelectContent>
                      {slackChannels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.is_private ? "🔒" : "#"} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    For private channels, invite <strong>@DentalAI</strong> first.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveSlackChannel} disabled={savingId === slack?.id} className="flex-1">
                    {savingId === slack?.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                    {slack?.status === "connected" ? "Update channel" : "Save channel"}
                  </Button>
                  {slack?.status === "connected" && (
                    <Button variant="outline" onClick={testSlack}>Test</Button>
                  )}
                  {slack?.status === "connected" && (
                    <Button variant="ghost" onClick={() => disconnect("slack")}>Disconnect</Button>
                  )}
                </div>
              </>
            )}
          </IntegrationCard>

          {/* CALENDLY */}
          <IntegrationCard
            icon={<CalendarDays className="h-5 w-5" />}
            title="Calendly"
            description="Share booking link + receive new bookings in Inbox."
            connected={calendly?.status === "connected"}
            tone="success"
          >
            <div className="space-y-2">
              <Label htmlFor="cv-url">Your Calendly link</Label>
              <Input
                id="cv-url"
                placeholder="https://calendly.com/your-clinic/30min"
                value={calendlyUrl}
                onChange={(e) => setCalendlyUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                AI will paste this link when patients want to book.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveCalendly} disabled={savingId === calendly?.id} className="flex-1">
                {savingId === calendly?.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                {calendly?.status === "connected" ? "Update" : "Connect"}
              </Button>
              {calendly?.status === "connected" && calendlyUrl && (
                <Button variant="outline" asChild>
                  <a href={calendlyUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {calendly?.status === "connected" && (
                <Button variant="ghost" onClick={() => disconnect("calendly")}>Disconnect</Button>
              )}
            </div>
            {calendly?.status === "connected" && (
              <div className="rounded-md border bg-muted/40 p-2">
                <p className="text-[11px] font-medium">Calendly webhook URL</p>
                <div className="mt-1 flex items-center gap-1">
                  <code className="flex-1 truncate rounded bg-background px-1.5 py-1 text-[10px]">
                    {CALENDLY_WEBHOOK_URL}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => copy(CALENDLY_WEBHOOK_URL, "URL")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  In Calendly: Integrations → Webhooks → New webhook → paste URL → events:
                  invitee.created, invitee.canceled.
                </p>
              </div>
            )}
          </IntegrationCard>
        </div>

        <Card className="surface-card border-warning/30 bg-warning-soft/40">
          <CardHeader>
            <CardTitle className="text-base">How each integration works</CardTitle>
            <CardDescription>What happens once connected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Slack (live):</span> when a patient message is
              flagged high-urgency, the AI sends a draft to your chosen channel via the Lovable Slack connector.
            </p>
            <p>
              <span className="font-semibold text-foreground">Calendly (live webhook):</span> every new booking
              and cancellation lands in the External-emails tab of your Inbox automatically.
            </p>
            <p>
              <span className="font-semibold text-foreground">Gmail (demo + webhook):</span> use the email-in
              webhook to forward emails into the inbox today. Real Gmail OAuth (one-click sign-in) is the next
              upgrade — it needs a Google Cloud project.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function IntegrationCard({
  icon, title, description, connected, tone, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  tone: "primary" | "accent" | "success";
  children: React.ReactNode;
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
  };
  return (
    <Card className="surface-card flex flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClass[tone])}>
            {icon}
          </div>
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Not connected
            </span>
          )}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between space-y-3">{children}</CardContent>
    </Card>
  );
}
