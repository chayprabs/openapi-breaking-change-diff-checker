"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyboardShortcut } from "@/components/ui/keyboard-shortcut";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Modal } from "@/components/ui/modal";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { SplitPane } from "@/components/ui/split-pane";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { CodeBlock } from "@/components/devtools/code-block";
import { InlineError } from "@/components/devtools/inline-error";
import { MetricCard } from "@/components/devtools/metric-card";
import { PrivacyBadge } from "@/components/devtools/privacy-badge";
import { SeverityBadge } from "@/components/devtools/severity-badge";
import { Toolbar } from "@/components/devtools/toolbar";
import { Section } from "@/components/ui/section";

export function DevComponentsShowcase() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { notify } = useToast();

  return (
    <div className="space-y-10">
      <Toolbar
        label="Component lab toolbar"
        leading={
          <>
            <Badge variant="info">Dev only</Badge>
            <PrivacyBadge mode="local-first" />
          </>
        }
        trailing={
          <Button
            onClick={() =>
              notify({
                title: "Toast ready",
                description: "The notification system is wired into the app shell.",
                variant: "success",
              })
            }
            variant="secondary"
          >
            Trigger toast
          </Button>
        }
      >
        <span className="text-muted text-sm">
          This page exists only in development as a lightweight component lab.
        </span>
      </Toolbar>

      <Section
        eyebrow="Primitives"
        title="Buttons, badges, and feedback"
        description="These are the shared building blocks that other tool pages can reuse."
      >
        <Card>
          <CardHeader>
            <CardTitle>Buttons and labels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
              <Button loading variant="secondary">
                Loading
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="breaking">Breaking</Badge>
              <Badge variant="dangerous">Dangerous</Badge>
              <Badge variant="safe">Safe</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="neutral">Neutral</Badge>
              <SeverityBadge severity="breaking" />
              <PrivacyBadge mode="no-upload" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Alert title="Info alert" variant="info">
                Alerts use semantic roles and consistent token-based coloring.
              </Alert>
              <Alert title="Success alert" variant="success">
                Success and warning states are ready for validation and workflow messaging.
              </Alert>
              <Alert title="Warning alert" variant="warning">
                Use warnings for risky but non-fatal conditions.
              </Alert>
              <Alert title="Error alert" variant="error">
                Errors can call attention to blocking issues.
              </Alert>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section
        eyebrow="Interactive"
        title="Tabs, overlays, tooltips, and toasts"
        description="The more interactive primitives are collected here so they can evolve without cluttering the main product route."
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="one">
                <TabsList aria-label="Development component tabs">
                  <TabsTrigger value="one">Overview</TabsTrigger>
                  <TabsTrigger value="two">States</TabsTrigger>
                  <TabsTrigger value="three">Layout</TabsTrigger>
                </TabsList>
                <TabsContent value="one">
                  <p className="text-muted mt-4 text-sm leading-6">
                    This accessible tab component supports keyboard navigation with arrow keys,
                    Home, and End.
                  </p>
                </TabsContent>
                <TabsContent value="two">
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={() => setIsModalOpen(true)} variant="outline">
                      Open modal
                    </Button>
                    <Button onClick={() => setIsDrawerOpen(true)} variant="secondary">
                      Open drawer
                    </Button>
                    <Tooltip content="Tooltips open on hover or focus.">
                      <Button variant="ghost">Focus me</Button>
                    </Tooltip>
                  </div>
                </TabsContent>
                <TabsContent value="three">
                  <div className="mt-4 space-y-4">
                    <div className="text-muted flex items-center gap-2 text-sm">
                      <LoadingSpinner size="sm" />
                      Spinner
                    </div>
                    <div className="text-muted flex items-center gap-2 text-sm">
                      <KeyboardShortcut keys={["Ctrl", "K"]} />
                      Keyboard shortcut helper
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications and copy helpers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    notify({
                      title: "Manual notification",
                      description: "You can trigger contextual toasts from any client component.",
                      variant: "info",
                    })
                  }
                >
                  Show toast
                </Button>
                <CopyButton value="pnpm typecheck" />
              </div>
              <InlineError message="Inline errors stay compact for field-level or local workflow problems." />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow="Developer components"
        title="Tooling-oriented display components"
        description="These helpers are intentionally generic enough to reuse across future developer tools."
      >
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                description="Use for counts, scores, or comparisons."
                label="Breaking changes"
                severity="breaking"
                value="4"
              />
              <MetricCard
                description="Works for privacy or delivery signals too."
                label="Docs-only changes"
                severity="neutral"
                value="6"
              />
              <MetricCard
                description="Badges and footnotes can be composed in."
                label="Safe additions"
                meta={<PrivacyBadge mode="browser-only" />}
                severity="safe"
                value="9"
              />
            </div>

            <CodeBlock
              code={`diff --semantic\nreport: contract-risk\nprivacy: local-first`}
              language="txt"
              title="Code block"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Split layouts and progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SplitPane
                primary={
                  <div className="border-line bg-panel-muted rounded-2xl border p-4 text-sm leading-6">
                    Left pane content for editors, source inputs, or configuration forms.
                  </div>
                }
                primaryLabel="Primary"
                secondary={
                  <div className="border-line bg-panel-muted rounded-2xl border p-4 text-sm leading-6">
                    Right pane content for reports, diffs, or auxiliary details.
                  </div>
                }
                secondaryLabel="Secondary"
                split="equal"
                stackAt="xl"
              />

              <ProgressSteps
                steps={[
                  {
                    id: "prepare",
                    label: "Prepare input",
                    description: "Initial state is complete.",
                    status: "complete",
                  },
                  {
                    id: "compare",
                    label: "Compare changes",
                    description: "Current active step.",
                    status: "current",
                  },
                  {
                    id: "publish",
                    label: "Publish result",
                    description: "Upcoming step.",
                    status: "upcoming",
                  },
                ]}
              />

              <EmptyState
                action={<Button variant="outline">Example action</Button>}
                description="Empty states give feature areas a consistent placeholder while behavior is still being wired in."
                title="No comparison history yet"
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Modal
        description="Use the modal for confirmations or focused blocking actions."
        footer={
          <>
            <Button onClick={() => setIsModalOpen(false)} variant="ghost">
              Cancel
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>Confirm</Button>
          </>
        }
        onOpenChange={setIsModalOpen}
        open={isModalOpen}
        title="Example modal"
      >
        <p className="text-muted text-sm leading-6">
          This modal is intentionally simple, accessible, and reusable across tool flows that need a
          confirmation step.
        </p>
      </Modal>

      <Drawer
        description="Use the drawer for secondary detail views, settings, or inspector-style panels."
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setIsDrawerOpen(false)} variant="secondary">
              Close panel
            </Button>
          </div>
        }
        onOpenChange={setIsDrawerOpen}
        open={isDrawerOpen}
        title="Example drawer"
      >
        <p className="text-muted text-sm leading-6">
          The drawer is better suited for settings, detail panes, or supporting information that
          should not fully interrupt the current page flow.
        </p>
      </Drawer>
    </div>
  );
}
