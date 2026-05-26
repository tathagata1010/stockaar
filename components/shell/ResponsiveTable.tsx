import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ResponsiveColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Primary column shown emphasized on mobile card view. */
  primary?: boolean;
  /** Hide on mobile card view. */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
};

/**
 * Renders a `<table>` on `md+` and a stacked card list on `<md`.
 * Each row becomes a card; columns marked `primary` are shown prominently,
 * others appear as labeled rows underneath, except those marked `hideOnMobile`.
 */
export function ResponsiveTable<T>({
  rows,
  columns,
  rowKey,
  emptyState,
  className,
}: {
  rows: T[];
  columns: ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
  emptyState?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && emptyState) {
    return <div className={cn("p-6 text-center text-sm text-muted", className)}>{emptyState}</div>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className={cn("hidden md:block overflow-x-auto rounded-2xl border border-border bg-card/60", className)}>
        <table className="min-w-full text-sm">
          <thead className="bg-bg-2/40 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2.5 font-semibold",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.align !== "right" && c.align !== "center" && "text-left",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-bg-2/30">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-3",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className={cn("space-y-2.5 md:hidden", className)}>
        {rows.map((row) => {
          const primary = columns.filter((c) => c.primary);
          const rest = columns.filter((c) => !c.primary && !c.hideOnMobile);
          return (
            <div key={rowKey(row)} className="rounded-2xl border border-border bg-card/60 p-4 shadow-soft">
              {primary.length > 0 && (
                <div className="mb-3 flex items-start justify-between gap-3">
                  {primary.map((c) => (
                    <div key={c.key} className="min-w-0">
                      {c.cell(row)}
                    </div>
                  ))}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wider text-muted">{c.header}</dt>
                    <dd className="mt-0.5">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </>
  );
}
