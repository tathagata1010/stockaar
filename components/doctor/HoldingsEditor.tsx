"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Holding } from "@/lib/doctor/schema";

type Props = {
  value: Holding[];
  unresolvedRows?: string[];
  onChange: (holdings: Holding[]) => void;
};

export function HoldingsEditor({ value, unresolvedRows = [], onChange }: Props) {
  const updateRow = (idx: number, patch: Partial<Holding>) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => onChange([...value, { symbol: "", qty: 0, avg: 0 }]);
  const removeRow = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const validCount = useMemo(
    () => value.filter((r) => r.symbol && r.qty > 0 && r.avg > 0).length,
    [value],
  );

  return (
    <section className="surface rounded-2xl p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Review holdings</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Fix any mis-read rows before diagnosing — the AI uses exactly what you confirm here.
          </p>
        </div>
        <span className="chip chip-brand text-[11px]">{validCount} valid</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-2 border-b border-border px-2 pb-2 text-[10px] uppercase tracking-wider text-muted">
            <div>Symbol</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Avg ₹</div>
            <div />
          </div>
          {value.map((r, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-2 border-b border-border/50 px-2 py-2",
              )}
            >
              <input
                value={r.symbol}
                onChange={(e) =>
                  updateRow(i, { symbol: e.target.value.toUpperCase().trim() })
                }
                placeholder="RELIANCE"
                className="rounded-md border border-border bg-bg/40 px-2 py-1 text-sm font-mono uppercase focus:border-brand focus:outline-none"
              />
              <input
                type="number"
                value={r.qty || ""}
                onChange={(e) => updateRow(i, { qty: Number(e.target.value) })}
                min={0}
                step="any"
                className="rounded-md border border-border bg-bg/40 px-2 py-1 text-right font-mono text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="number"
                value={r.avg || ""}
                onChange={(e) => updateRow(i, { avg: Number(e.target.value) })}
                min={0}
                step="any"
                className="rounded-md border border-border bg-bg/40 px-2 py-1 text-right font-mono text-sm focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => removeRow(i)}
                aria-label="Remove row"
                className="flex h-7 w-7 items-center justify-center self-center rounded-md text-muted hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={addRow} className="btn-ghost mt-3 inline-flex items-center gap-2 text-xs">
        <Plus className="h-3.5 w-3.5" />
        Add row
      </button>

      {unresolvedRows.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[11px]">
          <p className="font-semibold text-warning">Could not auto-parse:</p>
          <ul className="mt-1 space-y-0.5 text-warning/90">
            {unresolvedRows.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
