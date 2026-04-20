import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { label: string; cls: string }> = {
  new_lead: { label: "New Lead", cls: "bg-primary-soft text-primary border-primary/20" },
  booked: { label: "Booked", cls: "bg-accent-soft text-accent border-accent/20" },
  treated: { label: "Treated", cls: "bg-success-soft text-success border-success/20" },
  follow_up: { label: "Follow-up", cls: "bg-warning-soft text-warning-foreground border-warning/30" },
  inactive: { label: "Inactive", cls: "bg-muted text-muted-foreground border-border" },
};

export function PatientStatusBadge({ status, className }: { status: string; className?: string }) {
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("font-medium", v.cls, className)}>
      {v.label}
    </Badge>
  );
}

const urgencyMap: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning-soft text-warning-foreground border-warning/30",
  high: "bg-destructive-soft text-destructive border-destructive/30",
};
export function UrgencyBadge({ urgency }: { urgency: string | null | undefined }) {
  if (!urgency) return null;
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", urgencyMap[urgency] ?? urgencyMap.low)}>
      {urgency}
    </Badge>
  );
}

const intentMap: Record<string, string> = {
  booking: "bg-accent-soft text-accent border-accent/20",
  inquiry: "bg-primary-soft text-primary border-primary/20",
  emergency: "bg-destructive-soft text-destructive border-destructive/30",
  casual: "bg-muted text-muted-foreground border-border",
};
export function IntentBadge({ intent }: { intent: string | null | undefined }) {
  if (!intent) return null;
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", intentMap[intent] ?? intentMap.casual)}>
      {intent}
    </Badge>
  );
}
