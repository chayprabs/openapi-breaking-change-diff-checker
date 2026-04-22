import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
};

export function PageIntro({ eyebrow, title, description, actions, className }: PageIntroProps) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-black/10 bg-[var(--panel-strong)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10",
        className,
      )}
    >
      <p className="font-mono text-xs tracking-[0.3em] text-zinc-500 uppercase">{eyebrow}</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">{description}</p>
      {actions ? <div className="mt-8">{actions}</div> : null}
    </section>
  );
}
