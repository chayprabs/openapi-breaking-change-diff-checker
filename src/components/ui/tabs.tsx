"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type TabsContextValue = {
  baseId: string;
  setValue: (value: string) => void;
  value: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("Tabs components must be used within <Tabs>.");
  }

  return context;
}

type TabsProps = {
  children: ReactNode;
  className?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

export function Tabs({
  children,
  className,
  defaultValue,
  onValueChange,
  value: valueProp,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = valueProp ?? uncontrolledValue;
  const baseId = useId();

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      baseId,
      setValue: (nextValue: string) => {
        if (valueProp === undefined) {
          setUncontrolledValue(nextValue);
        }

        onValueChange?.(nextValue);
      },
      value,
    }),
    [baseId, onValueChange, value, valueProp],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabsListProps = HTMLAttributes<HTMLDivElement> & {
  "aria-label": string;
};

export function TabsList({ children, className, onKeyDown, ...props }: TabsListProps) {
  return (
    <div
      {...props}
      className={cn(
        "border-line bg-panel-muted inline-flex flex-wrap gap-2 rounded-2xl border p-2",
        className,
      )}
      onKeyDown={(event) => {
        const list = event.currentTarget;
        const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const activeIndex = tabs.findIndex((tab) => tab === document.activeElement);

        if (!tabs.length) {
          onKeyDown?.(event);
          return;
        }

        const focusTab = (index: number) => {
          const tab = tabs[index];
          tab?.focus();
          tab?.click();
        };

        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusTab((activeIndex + 1 + tabs.length) % tabs.length);
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusTab((activeIndex - 1 + tabs.length) % tabs.length);
        }

        if (event.key === "Home") {
          event.preventDefault();
          focusTab(0);
        }

        if (event.key === "End") {
          event.preventDefault();
          focusTab(tabs.length - 1);
        }

        onKeyDown?.(event);
      }}
      role="tablist"
    >
      {children}
    </div>
  );
}

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function TabsTrigger({ children, className, value, ...props }: TabsTriggerProps) {
  const { baseId, setValue, value: activeValue } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <button
      {...props}
      aria-controls={`${baseId}-${value}-panel`}
      aria-selected={isActive}
      className={cn(
        "focus-visible:ring-accent/30 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:ring-2",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:bg-panel hover:text-foreground",
        className,
      )}
      id={`${baseId}-${value}-tab`}
      onClick={() => setValue(value)}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  forceMount?: boolean;
  value: string;
};

export function TabsContent({
  children,
  className,
  forceMount = false,
  value,
  ...props
}: TabsContentProps) {
  const { baseId, value: activeValue } = useTabsContext();
  const isActive = activeValue === value;

  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      {...props}
      aria-labelledby={`${baseId}-${value}-tab`}
      className={cn(isActive ? "block" : "hidden", className)}
      id={`${baseId}-${value}-panel`}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
