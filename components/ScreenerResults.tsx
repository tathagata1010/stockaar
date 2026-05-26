import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UniverseRow } from "@/lib/universe";
import type { SortKey } from "@/app/(app)/screener/page";
import { ScreenerRowsLazy } from "./ScreenerRowsLazy";

type ColumnDef = {
  key: SortKey;
  label: string;
  align?: "left" | "right";
};

const COLUMNS: ColumnDef[] = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "change", label: "% Chg", align: "right" },
  { key: "marketCap", label: "Mkt Cap", align: "right" },
  { key: "pe", label: "P/E", align: "right" },
  { key: "pb", label: "P/B", align: "right" },
  { key: "divY", label: "Div Y", align: "right" },
  { key: "roe", label: "ROE", align: "right" },
  { key: "pm", label: "PM", align: "right" },
  { key: "revGrow", label: "Rev G", align: "right" },
  { key: "pos", label: "52W %", align: "right" },
  { key: "valuation", label: "Val", align: "right" },
  { key: "growth", label: "Grw", align: "right" },
  { key: "quality", label: "Qul", align: "right" },
  { key: "momentum", label: "Mom", align: "right" },
  { key: "score", label: "Score", align: "right" },
];

function buildSortHref(
  searchParams: Record<string, string | undefined>,
  key: SortKey,
  currentSort: SortKey,
  currentDir: "asc" | "desc",
): string {
  const nextDir: "asc" | "desc" = currentSort === key && currentDir === "desc" ? "asc" : "desc";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined && k !== "sort" && k !== "dir") params.set(k, v);
  }
  params.set("sort", key);
  params.set("dir", nextDir);
  return `/screener?${params.toString()}`;
}

export function ScreenerResults({
  rows, sort, dir, searchParams,
}: {
  rows: UniverseRow[];
  sort: SortKey;
  dir: "asc" | "desc";
  searchParams: Record<string, string | undefined>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted">
        No stocks match these filters. Try widening criteria or resetting.
      </p>
    );
  }
  return (
    <div className="surface overflow-hidden rounded-2xl shadow-soft">
      <div className="overflow-x-auto sticky-thead max-h-[78vh]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-left text-[10px] uppercase tracking-[0.12em] text-muted">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 py-3 font-semibold",
                      c.align === "right" && "text-right",
                    )}
                  >
                    <Link
                      href={buildSortHref(searchParams, c.key, sort, dir)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-fg",
                        active && "text-brand",
                      )}
                    >
                      {c.label}
                      {active && (dir === "desc" ? <span>↓</span> : <span>↑</span>)}
                    </Link>
                  </th>
                );
              })}
              <th className="px-3 py-3 text-right font-semibold">Signal</th>
            </tr>
          </thead>
          <ScreenerRowsLazy rows={rows} />
        </table>
      </div>
    </div>
  );
}
