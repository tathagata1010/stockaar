import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "surface rounded-2xl border border-border bg-card/60 p-4 shadow-soft",
        className,
      )}
    >
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function RailSection({
  label,
  icon,
  action,
  children,
}: {
  label?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      {(label || action) && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {icon}
            {label && <span>{label}</span>}
          </div>
          {action}
        </div>
      )}
      <div className="space-y-2">{children}</div>
    </section>
  );
}
