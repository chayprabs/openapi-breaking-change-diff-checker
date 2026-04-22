import { Badge } from "@/components/ui/badge";

export type Severity = "breaking" | "dangerous" | "info" | "neutral" | "safe";

type SeverityBadgeProps = {
  severity: Severity;
};

const severityLabelMap: Record<Severity, string> = {
  breaking: "Breaking",
  dangerous: "Dangerous",
  info: "Info",
  neutral: "Neutral",
  safe: "Safe",
};

const severityVariantMap = {
  breaking: "breaking",
  dangerous: "dangerous",
  info: "info",
  neutral: "neutral",
  safe: "safe",
} as const;

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return <Badge variant={severityVariantMap[severity]}>{severityLabelMap[severity]}</Badge>;
}
