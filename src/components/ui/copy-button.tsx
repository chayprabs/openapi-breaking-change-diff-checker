"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type CopyButtonProps = {
  className?: string;
  label?: string;
  successLabel?: string;
  value: string;
  variant?: ButtonVariant;
};

export function CopyButton({
  className,
  label = "Copy",
  successLabel = "Copied",
  value,
  variant = "ghost",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify({
        title: successLabel,
        description: "The selected content was copied to your clipboard.",
        variant: "success",
      });
    } catch {
      notify({
        title: "Copy failed",
        description: "Clipboard access was not available in this browser context.",
        variant: "error",
      });
    }
  };

  return (
    <Button
      aria-label={copied ? successLabel : label}
      className={className}
      onClick={handleCopy}
      variant={variant}
    >
      {copied ? successLabel : label}
    </Button>
  );
}
