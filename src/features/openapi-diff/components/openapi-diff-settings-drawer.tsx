"use client";

import type { ChangeEvent } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer } from "@/components/ui/drawer";
import {
  consumerProfileOptions,
  remoteRefPolicyOptions,
} from "@/features/openapi-diff/lib/analysis-settings";
import {
  createDeprecatedEndpointIgnoreRule,
  createDocsOnlyIgnoreRule,
  createMethodIgnoreRule,
  createOperationIdIgnoreRule,
  createPathPatternIgnoreRule,
  createRuleIdIgnoreRule,
  createTagIgnoreRule,
  getIgnoreRuleLabel,
} from "@/features/openapi-diff/lib/ignore-rules";
import { ruleCatalog } from "@/features/openapi-diff/data/rule-catalog";
import {
  ruleIds,
  type AnalysisSettings,
  type ConsumerProfile,
  type IgnoreRule,
  type OpenApiHttpMethod,
  type RemoteRefPolicy,
  type RuleId,
} from "@/features/openapi-diff/types";

type OpenApiDiffSettingsDrawerProps = {
  onAddIgnoreRule: (ignoreRule: IgnoreRule) => void;
  onClearLocalData: () => void;
  onImportSettingsJson: (settingsJson: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveIgnoreRule: (ignoreRuleId: string) => void;
  onResetSettings: () => void;
  onSetConsumerProfile: (consumerProfile: ConsumerProfile) => void;
  onSetRememberEditorContents: (enabled: boolean) => void;
  onSetRemoteRefPolicy: (policy: RemoteRefPolicy) => void;
  onSetTreatEnumAdditionsAsDangerous: (enabled: boolean) => void;
  open: boolean;
  rememberEditorContents: boolean;
  settings: AnalysisSettings;
  settingsJson: string;
};

const HTTP_METHODS: readonly OpenApiHttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const;

function RuleChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="border-line bg-panel-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      <button
        aria-label={`Remove ${label}`}
        className="text-muted transition hover:text-foreground"
        onClick={onRemove}
        type="button"
      >
        Remove
      </button>
    </span>
  );
}

export function OpenApiDiffSettingsDrawer({
  onAddIgnoreRule,
  onClearLocalData,
  onImportSettingsJson,
  onOpenChange,
  onRemoveIgnoreRule,
  onResetSettings,
  onSetConsumerProfile,
  onSetRememberEditorContents,
  onSetRemoteRefPolicy,
  onSetTreatEnumAdditionsAsDangerous,
  open,
  rememberEditorContents,
  settings,
  settingsJson,
}: OpenApiDiffSettingsDrawerProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pathPattern, setPathPattern] = useState("");
  const [tag, setTag] = useState("");
  const [operationIdValue, setOperationIdValue] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState<RuleId | "">("");
  const [importText, setImportText] = useState("");
  const activeIgnoreRules = useMemo(
    () => [...settings.ignoreRules].sort((left, right) => left.id.localeCompare(right.id)),
    [settings.ignoreRules],
  );

  const docsOnlyEnabled = settings.ignoreRules.some((rule) => rule.id === "docsOnly");
  const deprecatedEndpointsExcluded = settings.ignoreRules.some(
    (rule) => rule.id === "deprecatedEndpoint",
  );

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const nextText = await file.text();
    setImportText(nextText);
    onImportSettingsJson(nextText);
    event.currentTarget.value = "";
  };

  return (
    <Drawer
      className="max-w-3xl"
      description="Adjust noise-reduction controls without losing auditability. Ignored findings stay available in the Ignored tab."
      footer={
        <div className="flex flex-wrap gap-3">
          <Button onClick={onResetSettings} variant="outline">
            Reset settings
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title="Analysis settings"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Compatibility profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-foreground">Profile</span>
              <select
                aria-label="Compatibility profile"
                className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                onChange={(event) =>
                  onSetConsumerProfile(event.currentTarget.value as ConsumerProfile)
                }
                value={settings.consumerProfile}
              >
                {consumerProfileOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-muted text-sm leading-6">
              {
                consumerProfileOptions.find(
                  (option) => option.value === settings.consumerProfile,
                )?.description
              }
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => onSetConsumerProfile("sdkStrict")} variant="secondary">
                Strict SDK mode
              </Button>
              <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                <input
                  checked={settings.treatEnumAdditionsAsDangerous}
                  onChange={(event) =>
                    onSetTreatEnumAdditionsAsDangerous(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>Treat enum additions as dangerous</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Reference resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-foreground">Remote $ref policy</span>
              <select
                aria-label="Remote ref policy"
                className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                onChange={(event) =>
                  onSetRemoteRefPolicy(event.currentTarget.value as RemoteRefPolicy)
                }
                value={settings.remoteRefPolicy}
              >
                {remoteRefPolicyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-muted text-sm leading-6">
              {
                remoteRefPolicyOptions.find(
                  (option) => option.value === settings.remoteRefPolicy,
                )?.description
              }
            </p>
            <p className="text-muted text-sm leading-6">
              Authenticated URLs, localhost targets, private networks, and cloud metadata
              endpoints stay blocked even when public remote refs are enabled.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Local persistence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
              <input
                checked={rememberEditorContents}
                onChange={(event) => onSetRememberEditorContents(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>Remember editor contents on this device</span>
            </label>
            <p className="text-muted text-sm leading-6">
              Off by default. When enabled, the current Base and Revision editor contents are saved
              to this browser so the workspace restores after a refresh. Leave it off on shared or
              untrusted devices.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onClearLocalData} variant="outline">
                Clear local data
              </Button>
            </div>
            <p className="text-muted text-sm leading-6">
              Clearing local data removes saved settings and any remembered editor contents from
              this browser.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Common ignore controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                <input
                  checked={docsOnlyEnabled}
                  onChange={(event) => {
                    if (event.currentTarget.checked) {
                      onAddIgnoreRule(createDocsOnlyIgnoreRule());
                    } else {
                      onRemoveIgnoreRule("docsOnly");
                    }
                  }}
                  type="checkbox"
                />
                <span>Ignore docs-only changes</span>
              </label>
              <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                <input
                  checked={!deprecatedEndpointsExcluded}
                  onChange={(event) => {
                    if (event.currentTarget.checked) {
                      onRemoveIgnoreRule("deprecatedEndpoint");
                    } else {
                      onAddIgnoreRule(createDeprecatedEndpointIgnoreRule());
                    }
                  }}
                  type="checkbox"
                />
                <span>Include deprecated endpoints</span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="block font-medium text-foreground">Ignore path pattern</span>
                <div className="flex gap-3">
                  <input
                    className="border-line bg-panel min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
                    onChange={(event) => setPathPattern(event.currentTarget.value)}
                    placeholder="/internal/*"
                    value={pathPattern}
                  />
                  <Button
                    onClick={() => {
                      const nextValue = pathPattern.trim();

                      if (!nextValue) {
                        return;
                      }

                      onAddIgnoreRule(createPathPatternIgnoreRule(nextValue));
                      setPathPattern("");
                    }}
                    variant="secondary"
                  >
                    Add
                  </Button>
                </div>
              </label>

              <label className="space-y-2 text-sm">
                <span className="block font-medium text-foreground">Ignore tag</span>
                <div className="flex gap-3">
                  <input
                    className="border-line bg-panel min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
                    onChange={(event) => setTag(event.currentTarget.value)}
                    placeholder="internal"
                    value={tag}
                  />
                  <Button
                    onClick={() => {
                      const nextValue = tag.trim();

                      if (!nextValue) {
                        return;
                      }

                      onAddIgnoreRule(createTagIgnoreRule(nextValue));
                      setTag("");
                    }}
                    variant="secondary"
                  >
                    Add
                  </Button>
                </div>
              </label>

              <label className="space-y-2 text-sm">
                <span className="block font-medium text-foreground">Ignore operationId</span>
                <div className="flex gap-3">
                  <input
                    className="border-line bg-panel min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
                    onChange={(event) => setOperationIdValue(event.currentTarget.value)}
                    placeholder="listUsers"
                    value={operationIdValue}
                  />
                  <Button
                    onClick={() => {
                      const nextValue = operationIdValue.trim();

                      if (!nextValue) {
                        return;
                      }

                      onAddIgnoreRule(createOperationIdIgnoreRule(nextValue));
                      setOperationIdValue("");
                    }}
                    variant="secondary"
                  >
                    Add
                  </Button>
                </div>
              </label>

              <label className="space-y-2 text-sm">
                <span className="block font-medium text-foreground">Ignore rule ID</span>
                <div className="flex gap-3">
                  <select
                    aria-label="Ignore rule ID"
                    className="border-line bg-panel min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
                    onChange={(event) => setSelectedRuleId(event.currentTarget.value as RuleId | "")}
                    value={selectedRuleId}
                  >
                    <option value="">Select a rule...</option>
                    {ruleIds.map((ruleId) => (
                      <option key={ruleId} value={ruleId}>
                        {ruleId} - {ruleCatalog[ruleId].title}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => {
                      if (!selectedRuleId) {
                        return;
                      }

                      onAddIgnoreRule(createRuleIdIgnoreRule(selectedRuleId));
                      setSelectedRuleId("");
                    }}
                    variant="secondary"
                  >
                    Add
                  </Button>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Ignore methods</p>
              <div className="flex flex-wrap gap-2">
                {HTTP_METHODS.map((method) => {
                  const ruleId = `method:${method}`;
                  const enabled = settings.ignoreRules.some((rule) => rule.id === ruleId);

                  return (
                    <Button
                      key={method}
                      onClick={() =>
                        enabled
                          ? onRemoveIgnoreRule(ruleId)
                          : onAddIgnoreRule(createMethodIgnoreRule(method))
                      }
                      variant={enabled ? "primary" : "outline"}
                    >
                      {method.toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Active ignore rules</CardTitle>
              <Badge variant="neutral">{activeIgnoreRules.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeIgnoreRules.length ? (
              <div className="flex flex-wrap gap-2">
                {activeIgnoreRules.map((ignoreRule) => (
                  <RuleChip
                    key={ignoreRule.id}
                    label={getIgnoreRuleLabel(ignoreRule)}
                    onRemove={() => onRemoveIgnoreRule(ignoreRule.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm leading-6">
                No ignore rules are active. Findings will stay fully visible until you add one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Import and export settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <CopyButton label="Copy settings JSON" value={settingsJson} variant="secondary" />
              <input
                accept=".json,application/json,text/plain"
                className="hidden"
                id={fileInputId}
                onChange={handleFileImport}
                ref={fileInputRef}
                type="file"
              />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                Load JSON file
              </Button>
            </div>
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-foreground">Paste settings JSON</span>
              <textarea
                className="border-line bg-panel min-h-40 w-full rounded-2xl border px-4 py-3 font-mono text-xs leading-6"
                onChange={(event) => setImportText(event.currentTarget.value)}
                placeholder="Paste exported settings JSON here."
                value={importText}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => onImportSettingsJson(importText)}
                variant="secondary"
              >
                Apply pasted JSON
              </Button>
              <Button onClick={() => setImportText("")} variant="ghost">
                Clear pasted JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Drawer>
  );
}
