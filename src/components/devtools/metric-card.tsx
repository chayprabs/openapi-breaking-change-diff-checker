import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge, type Severity } from "@/components/devtools/severity-badge";

type MetricCardProps = {
  description?: string;
  label: string;
  meta?: ReactNode;
  severity?: Severity;
  testId?: string;
  value: ReactNode;
};

export function MetricCard({
  description,
  label,
  meta,
  severity = "neutral",
  testId,
  value,
}: MetricCardProps) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{label}</CardTitle>
          <SeverityBadge severity={severity} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {description ? <p className="text-muted mt-2 text-sm leading-6">{description}</p> : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </CardContent>
    </Card>
  );
}
