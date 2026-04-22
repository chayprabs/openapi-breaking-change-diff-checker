import { Badge } from "@/components/ui/badge";

export type PrivacyMode = "browser-only" | "local-first" | "login-free" | "networked" | "no-upload";

type PrivacyBadgeProps = {
  mode: PrivacyMode;
};

const privacyConfig = {
  "browser-only": { label: "Browser only", variant: "safe" },
  "local-first": { label: "Local first", variant: "safe" },
  "login-free": { label: "Login free", variant: "info" },
  networked: { label: "Networked", variant: "neutral" },
  "no-upload": { label: "No upload", variant: "safe" },
} as const;

export function PrivacyBadge({ mode }: PrivacyBadgeProps) {
  const config = privacyConfig[mode];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
