import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";

type CodeBlockProps = {
  actions?: ReactNode;
  className?: string;
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  title?: string;
};

export function CodeBlock({
  actions,
  className,
  code,
  language = "text",
  showLineNumbers = false,
  title,
}: CodeBlockProps) {
  const lines = code.split("\n");

  return (
    <div className={cn("border-line bg-panel-muted overflow-hidden rounded-2xl border", className)}>
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          <p className="text-muted font-mono text-[0.68rem] tracking-[0.18em] uppercase">
            {language}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
          <CopyButton value={code} />
        </div>
      </div>
      <pre className="overflow-x-auto p-4">
        {showLineNumbers ? (
          <code className="grid gap-1 font-mono text-xs leading-6">
            {lines.map((line, index) => (
              <span key={`${index + 1}-${line}`} className="grid grid-cols-[auto_1fr] gap-4">
                <span className="text-muted text-right select-none">{index + 1}</span>
                <span>{line || " "}</span>
              </span>
            ))}
          </code>
        ) : (
          <code className="font-mono text-xs leading-6 whitespace-pre-wrap">{code}</code>
        )}
      </pre>
    </div>
  );
}
