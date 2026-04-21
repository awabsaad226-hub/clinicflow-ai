import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, CalendarDays, CheckCircle2, Loader2, Plug, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  provider: "gmail" | "slack" | "calendly";
  status: "connected" | "disconnected";
  config: Record<string, any>;
  connected_at: string | null;
}

export default function Integrations() {
  const [rows, setRows] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // editable local state
  const [gmailEmail, setGmailEmail] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("integrations").select("*").order("provider");
    const list = (data ?? []) as unknown as Integration[];
    setRows(list);
    setGmailEmail(list.find((r) => r.provider === "gmail")?.config?.email ?? "");
    setSlackWebhook(list.find((r) => r.provider === "slack")?.config?.webhook_url ?? "");
    setCalendlyUrl(list.find((r) => r.provider === "calendly")?.config?.url ?? "");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateIntegration = async (
    provider: Integration["provider"],
    patch: { status?: "connected" | "disconnected"; config?: Record<string, any> }
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${provider} updated`);
    load();
  };

  const saveGmail = async () => {
    if (!gmailEmail.trim()) {
      toast.error("Enter a Gmail address first");
      return;
    }
    await updateIntegration("gmail", {
      status: "connected",
      config: { email: gmailEmail.trim() },
    });
  };

  const saveSlack = async () => {
    if (!slackWebhook.trim() || !slackWebhook.startsWith("https://hooks.slack.com/")) {
      toast.error("Paste a valid Slack incoming-webhook URL (https://hooks.slack.com/...)");
      return;
    }
    await updateIntegration("slack", {
      status: "connected",
      config: { webhook_url: slackWebhook.trim() },
    });
  };

  const saveCalendly = async () => {
    if (!calendlyUrl.trim() || !calendlyUrl.includes("calendly.com")) {
      toast.error("Paste your Calendly URL (https://calendly.com/...)");
      return;
    }
    await updateIntegration("calendly", {
      status: "connected",
      config: { url: calendlyUrl.trim() },
    });
    // also mirror into ai_config so the AI sees it
    const { data: cfg } = await supabase.from("ai_config").select("id").limit(1).maybeSingle();
    if (cfg?.id) {
      await supabase.from("ai_config").update({ calendly_url: calendlyUrl.trim() } as any).eq("id", cfg.id);
    }
  };

  const testSlack = async () => {
    if (!slackWebhook.trim()) {
      toast.error("Save your Slack webhook first");
      return;
    }
    const { data, error } = await supabase.functions.invoke("slack-alert", {
      body: {
        webhook_url: slackWebhook.trim(),
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
      toast.success("Test alert sent to Slack");
    }
  };

  const disconnect = (provider: Integration["provider"]) =>
    updateIntegration(provider, { status: "disconnected" });

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
            Bring your Gmail, Slack and Calendly into DentalAI. Patient emails arrive in your Inbox, urgent messages
            ping Slack, and your AI proposes Calendly slots when patients want to book.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* GMAIL */}
          <IntegrationCard
            icon={<Mail className="h-5 w-5" />}
            title="Gmail"
            description="Receive incoming patient emails inside the Inbox."
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
                Demo mode: emails are stored locally so you can see how the inbox feels. Full Gmail OAuth (real-time sync)
                can be added later — see "Going live" below.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveGmail} disabled={savingId === gmail?.id} className="flex-1">
                {savingId === gmail?.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                {gmail?.status === "connected" ? "Update" : "Connect"}
              </Button>
              {gmail?.status === "connected" && (
                <Button variant="ghost" onClick={() => disconnect("gmail")}>
                  Disconnect
                </Button>
              )}
            </div>
          </IntegrationCard>

          {/* SLACK */}
          <IntegrationCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Slack"
            description="Get pinged in Slack when a patient message is high-urgency."
            connected={slack?.status === "connected"}
            tone="accent"
          >
            <div className="space-y-2">
              <Label htmlFor="sl-hook">Slack incoming-webhook URL</Label>
              <Input
                id="sl-hook"
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                In Slack: <em>Apps → Incoming Webhooks → Add to Slack → pick channel → copy URL</em> and paste here.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSlack} disabled={savingId === slack?.id} className="flex-1">
                {savingId === slack?.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                {slack?.status === "connected" ? "Update" : "Connect"}
              </Button>
              {slack?.status === "connected" && (
                <Button variant="outline" onClick={testSlack}>
                  Test
                </Button>
              )}
              {slack?.status === "connected" && (
                <Button variant="ghost" onClick={() => disconnect("slack")}>
                  Disconnect
                </Button>
              )}
            </div>
          </IntegrationCard>

          {/* CALENDLY */}
          <IntegrationCard
            icon={<CalendarDays className="h-5 w-5" />}
            title="Calendly"
            description="AI shares your Calendly link when patients want to book."
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
                The AI will paste this link into messages whenever it suggests booking — and respect your clinic hours.
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
                <Button variant="ghost" onClick={() => disconnect("calendly")}>
                  Disconnect
                </Button>
              )}
            </div>
          </IntegrationCard>
        </div>

        <Card className="surface-card border-warning/30 bg-warning-soft/40">
          <CardHeader>
            <CardTitle className="text-base">Going live (production)</CardTitle>
            <CardDescription>What changes when you move past the demo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Slack:</span> already production-ready — incoming
              webhooks are how Slack apps push alerts.
            </p>
            <p>
              <span className="font-semibold text-foreground">Calendly:</span> link mode works today. To let the AI
              read real free slots, add a Calendly Personal Token (we'd add a "Calendly token" field here and call
              their API).
            </p>
            <p>
              <span className="font-semibold text-foreground">Gmail:</span> for real two-way email, we'd swap this
              field for Google OAuth (one-click sign-in) so patient replies land in this Inbox automatically. Lovable
              Cloud manages Google OAuth for you.
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
