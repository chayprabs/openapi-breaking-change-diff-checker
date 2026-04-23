"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import {
  createCustomRedactionRule,
  formatCustomRedactionRuleLabel,
} from "@/features/openapi-diff/lib/redaction";
import type {
  AnalysisSettings,
  CustomRedactionRule,
  RedactionResult,
} from "@/features/openapi-diff/types";

type OpenApiDiffPrivacyDrawerProps = {
  inspection: RedactionResult;
  onAddCustomRedactionRule: (rule: CustomRedactionRule) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveCustomRedactionRule: (ruleId: string) => void;
  onSetRedactExamples: (enabled: boolean) => void;
  onSetRedactServerUrls: (enabled: boolean) => void;
  open: boolean;
  settings: AnalysisSettings;
};

export function OpenApiDiffPrivacyDrawer({
  inspection,
  onAddCustomRedactionRule,
  onOpenChange,
  onRemoveCustomRedactionRule,
  onSetRedactExamples,
  onSetRedactServerUrls,
  open,
  settings,
}: OpenApiDiffPrivacyDrawerProps) {
  const [customRuleLabel, setCustomRuleLabel] = useState("");
  const [customRulePattern, setCustomRulePattern] = useState("");
  const [customRuleFlags, setCustomRuleFlags] = useState("");
  const activeCustomRules = useMemo(
    () =>
      [...settings.customRedactionRules].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    [settings.customRedactionRules],
  );

  return (
    <Drawer
      className="max-w-4xl"
      description="Core analysis runs locally in your browser when possible. Review what is stored, what gets redacted, and what would leave the page when you export."
      footer={
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title="Privacy and redaction"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Current workspace scan</CardTitle>
              <Badge variant={inspection.detectedSecrets ? "dangerous" : "safe"}>
                {inspection.detectedSecrets ? "Secret-like values detected" : "No secret-like values found"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted leading-6">
              {inspection.detectedSecrets
                ? `${inspection.matches.length} unique placeholder${inspection.matches.length === 1 ? "" : "s"} would be used across ${inspection.replacements} replacement${inspection.replacements === 1 ? "" : "s"} if you export with redaction enabled.`
                : "The current scan did not flag token-like strings, internal hosts, or other obvious secrets in the inspected sources."}
            </p>
            {inspection.matches.length ? (
              <div className="flex flex-wrap gap-2">
                {inspection.matches.map((match) => (
                  <span
                    key={match.placeholder}
                    className="border-line bg-panel-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium text-foreground">{match.placeholder}</span>
                    <span className="text-muted">{match.preview}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Privacy controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3">
                <input
                  checked={settings.redactExamples}
                  onChange={(event) => onSetRedactExamples(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Redact examples and defaults before export</span>
              </label>
              <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3">
                <input
                  checked={settings.redactServerUrls}
                  onChange={(event) => onSetRedactServerUrls(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Redact server URLs before export</span>
              </label>

              <div className="space-y-3">
                <p className="font-medium text-foreground">Custom regex redaction rules</p>
                <label className="space-y-2">
                  <span className="block text-muted">Label</span>
                  <input
                    className="border-line bg-panel w-full rounded-xl border px-3 py-2"
                    onChange={(event) => setCustomRuleLabel(event.currentTarget.value)}
                    placeholder="Partner tenant IDs"
                    value={customRuleLabel}
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-muted">Regex pattern</span>
                  <input
                    className="border-line bg-panel w-full rounded-xl border px-3 py-2 font-mono"
                    onChange={(event) => setCustomRulePattern(event.currentTarget.value)}
                    placeholder="tenant_[A-Za-z0-9]{12}"
                    value={customRulePattern}
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-muted">Flags</span>
                  <input
                    className="border-line bg-panel w-full rounded-xl border px-3 py-2 font-mono"
                    onChange={(event) => setCustomRuleFlags(event.currentTarget.value)}
                    placeholder="gi"
                    value={customRuleFlags}
                  />
                </label>
                <Button
                  onClick={() => {
                    if (!customRulePattern.trim()) {
                      return;
                    }

                    onAddCustomRedactionRule(
                      createCustomRedactionRule(customRulePattern, {
                        ...(customRuleFlags.trim() ? { flags: customRuleFlags.trim() } : {}),
                        ...(customRuleLabel.trim() ? { label: customRuleLabel.trim() } : {}),
                      }),
                    );
                    setCustomRuleLabel("");
                    setCustomRulePattern("");
                    setCustomRuleFlags("");
                  }}
                  variant="secondary"
                >
                  Add custom rule
                </Button>
              </div>

              <div className="space-y-3">
                <p className="font-medium text-foreground">Active custom rules</p>
                {activeCustomRules.length ? (
                  <div className="flex flex-wrap gap-2">
                    {activeCustomRules.map((rule) => (
                      <span
                        key={rule.id}
                        className="border-line bg-panel-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                      >
                        <span className="font-medium text-foreground">
                          {formatCustomRedactionRuleLabel(rule)}
                        </span>
                        <button
                          aria-label={`Remove ${formatCustomRedactionRuleLabel(rule)}`}
                          className="text-muted transition hover:text-foreground"
                          onClick={() => onRemoveCustomRedactionRule(rule.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted leading-6">
                    No custom regex rules are active.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What is and is not stored</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="border-line bg-panel-muted rounded-2xl border p-4">
                <p className="font-medium text-foreground">Stored locally</p>
                <p className="text-muted mt-2 leading-6">
                  Only workspace preferences such as the selected sample, active tab, compatibility profile, ignore rules, and redaction settings are written to local storage.
                </p>
              </div>
              <div className="border-line bg-panel-muted rounded-2xl border p-4">
                <p className="font-medium text-foreground">Not stored by default</p>
                <p className="text-muted mt-2 leading-6">
                  Pasted specs, uploaded file contents, and generated exports stay in memory unless you explicitly copy or download them.
                </p>
              </div>
              <div className="border-line bg-panel-muted rounded-2xl border p-4">
                <p className="font-medium text-foreground">Not sent to analytics</p>
                <p className="text-muted mt-2 leading-6">
                  Spec bodies are not sent to analytics, and raw spec text is not intentionally included in worker error messages.
                </p>
              </div>
              <div className="border-line bg-panel-muted rounded-2xl border p-4">
                <p className="font-medium text-foreground">Before you export</p>
                <p className="text-muted mt-2 leading-6">
                  Use the redacted export mode when the scan flags token-like values, internal hosts, or custom matches. Ignored findings stay visible either way.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {inspection.warnings.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Redaction warnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {inspection.warnings.map((warning, index) => (
                <p key={`${warning}-${index}`} className="leading-6">
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Redaction preview</CardTitle>
              <Badge variant="neutral">
                Showing {inspection.previews.length} snippet{inspection.previews.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {inspection.previews.length ? (
              <div className="space-y-4">
                {inspection.previews.map((preview) => (
                  <div
                    key={preview.id}
                    className="border-line bg-panel-muted rounded-2xl border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{preview.placeholder}</Badge>
                      <Badge variant="neutral">{preview.kind}</Badge>
                      <span className="text-muted text-xs">{preview.sourceLabel}</span>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                          Before
                        </p>
                        <pre className="border-line bg-panel overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                          {preview.before}
                        </pre>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                          After
                        </p>
                        <pre className="border-line bg-panel overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                          {preview.after}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm leading-6">
                No preview snippets are available yet. Open this panel after loading specs or running a report to inspect redaction candidates.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Drawer>
  );
}
