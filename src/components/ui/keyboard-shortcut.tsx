import { cn } from "@/lib/cn";

type KeyboardShortcutProps = {
  className?: string;
  keys: string[] | string;
};

export function KeyboardShortcut({ className, keys }: KeyboardShortcutProps) {
  const parts = Array.isArray(keys) ? keys : [keys];

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {parts.map((part) => (
        <kbd
          key={part}
          className="border-line bg-panel-muted min-w-7 rounded-md border px-2 py-1 text-center font-mono text-[0.7rem] uppercase"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
